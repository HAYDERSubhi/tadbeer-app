// src/lib/account-erasure.ts
// منطق المحو الكامل لحساب مستخدم — مفصول عن مسار الـ API عمداً.
//
// لماذا مفصول؟ لأن متغيّرات firebase-admin موجودة في Vercel وحدها (فخّ ٢ في
// CLAUDE.md)، فلا يمكن اختبار المسار محلياً إطلاقاً. وهذه أخطر شفرة في
// التطبيق: تمحو نهائياً وتمسّ بيانات أشخاص آخرين. بفصلها صار بالإمكان
// تشغيلها كاملةً على محاكي Firebase محلياً واختبار كل حالاتها قبل النشر —
// انظر scripts/test-account-erasure.mjs.
//
// ⛔ ما كان مكسوراً قبل 2026-09-06:
//   كان المحو يعمل على users/{uid} وحده. ومن كان في عائلة فمصاريفه وأهدافه
//   ودخله ليست هناك أصلاً بل تحت households/{id}/ — فتبقى كلها بعد الحذف،
//   ويبقى **اسمه وبريده الإلكتروني** مكتوبَين في قائمة أعضاء العائلة إلى
//   الأبد، أمام بقية أفرادها. ولم يكن أي سطر في التطبيق كلّه يحذف من التخزين،
//   فتبقى تواقيع «سلفتنا» المرسومة بيده وإثباتات الدفع. وهذا كلّه يخالف نصّ
//   شاشة الحذف («حسابك وجميع بياناتك») ونصّ سياسة الخصوصية صراحةً.
import type { Bucket } from '@google-cloud/storage';

type Db = FirebaseFirestore.Firestore;

const BATCH_SIZE = 400;

/** المجموعات المشتركة التي تحمل وثائقها اسم من أدخلها (uid). */
const OWNED_COLLECTIONS = ['expenses', 'goals', 'incomes'] as const;

/** كل مجموعة تُكتَب تحت households/{id}. تُحذف كلها حين تُحلّ العائلة. */
const HOUSEHOLD_COLLECTIONS = [...OWNED_COLLECTIONS, 'settings'] as const;

/**
 * كل مجموعة تُكتَب تحت users/{uid}.
 * ⚠️ أي أداة جديدة تحفظ هنا تُضاف إلى هذه القائمة، وإلا بقيت بياناتها بعد
 *    «حذف الحساب» — وهذا ما حدث فعلاً مع trips و badges (رُصد 2026-09-05).
 */
const USER_COLLECTIONS = [
  'expenses',
  'goals',
  'incomes',
  'installmentPlans',
  'debts',
  'silftna',
  'trips',    // أداة «سفراتي»
  'badges',   // مجموعة تحوي المستند earned
  'settings', // المستند main
  'wedding',  // المستند plan
] as const;

export type ErasureReport = {
  householdDocsDeleted: number;
  householdsDissolved: number;
  householdsHandedOver: number;
  membershipsRemoved: number;
  userDocsDeleted: number;
  referralsDeleted: number;
  feedbackAnonymized: number;
  storageFilesDeleted: number;
  /** يُملأ فقط لو تعذّر محو الملفات — ويُسجَّل أثره في deletionResidue. */
  storageError?: string;
};

/** يحذف مراجع وثائق على دفعات لا تتجاوز حدّ Firestore. */
async function deleteRefs(db: Db, refs: FirebaseFirestore.DocumentReference[]): Promise<number> {
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    refs.slice(i, i + BATCH_SIZE).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  return refs.length;
}

/** يحذف مجموعة فرعية كاملة تحت مسار مستند. */
async function deleteCollection(db: Db, basePath: string, col: string): Promise<number> {
  const snap = await db.collection(`${basePath}/${col}`).get();
  return snap.empty ? 0 : deleteRefs(db, snap.docs.map((d) => d.ref));
}

/** يحذف من مجموعة مشتركة ما هو منسوب إلى uid وحده، ويترك ما لغيره. */
async function deleteOwnedDocs(db: Db, basePath: string, col: string, uid: string): Promise<number> {
  const snap = await db.collection(`${basePath}/${col}`).where('uid', '==', uid).get();
  return snap.empty ? 0 : deleteRefs(db, snap.docs.map((d) => d.ref));
}

/**
 * أقدم عضو باقٍ يرث ملكية العائلة.
 * joinedAt نصّ ISO؛ ومن لا تاريخ له يُعتبر الأحدث فلا يُقدَّم على من له تاريخ.
 */
function pickHeir<T extends { uid: string; joinedAt?: string }>(others: T[]): T {
  return [...others].sort((a, b) => (a.joinedAt || '￿').localeCompare(b.joinedAt || '￿'))[0];
}

/**
 * يفكّ ارتباط المستخدم بكل عائلة هو فيها، ويمحو ما أدخله فيها.
 *
 * ثلاث حالات:
 *   • عضو عادي  ⇒ تُمحى وثائقه، ويُرفع اسمه وبريده من قائمة الأعضاء.
 *   • آخر عضو   ⇒ تُحلّ العائلة كلها (مع مجموعاتها — حذف المستند وحده
 *                 لا يحذف مجموعاته الفرعية، وهذا مصدر أخطاء متكرّر).
 *   • مالك ومعه آخرون ⇒ تنتقل الملكية لأقدم عضو باقٍ ثم يُرفع هو.
 *                 (قرار صاحب المشروع 2026-09-06: العائلة تستمر، ولا يُمنع
 *                  أحد من حقّه في محو بياناته.)
 */
async function eraseHouseholdPresence(db: Db, uid: string, report: ErasureReport): Promise<void> {
  const snap = await db.collection('households').where('memberUids', 'array-contains', uid).get();

  for (const hhDoc of snap.docs) {
    const hh = hhDoc.data();
    const basePath = `households/${hhDoc.id}`;
    const members: Array<{ uid: string; role?: string; joinedAt?: string }> =
      Array.isArray(hh.members) ? hh.members : [];
    const others = members.filter((m) => m?.uid !== uid);

    if (others.length === 0) {
      // آخر عضو: تُحلّ العائلة بمجموعاتها كلها — لا حاجة لتصفية حسب uid.
      for (const col of HOUSEHOLD_COLLECTIONS) {
        report.householdDocsDeleted += await deleteCollection(db, basePath, col);
      }
      await hhDoc.ref.delete();
      report.householdsDissolved += 1;
      report.membershipsRemoved += 1;
      continue;
    }

    // تُمحى وثائقه أولاً وهو ما يزال عضواً — الترتيب يطابق remove-member:
    // لو انقطع التنفيذ هنا يبقى عضواً وبعض وثائقه، وهي حالة قابلة للإعادة
    // بلا فقدان. العكس يترك وثائقه بلا صاحب ولا أثر يدلّ عليها.
    for (const col of OWNED_COLLECTIONS) {
      report.householdDocsDeleted += await deleteOwnedDocs(db, basePath, col, uid);
    }

    // المعاملة تُعيد القراءة لحظة الكتابة، فلا يضيع عضو انضمّ أثناء المحو.
    const handedOver = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(hhDoc.ref);
      if (!fresh.exists) return false;
      const data = fresh.data()!;
      const freshMembers: Array<{ uid: string; role?: string; joinedAt?: string }> =
        Array.isArray(data.members) ? data.members : [];
      const freshOthers = freshMembers.filter((m) => m?.uid !== uid);
      const freshUids: string[] = Array.isArray(data.memberUids) ? data.memberUids : [];

      const patch: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        members: freshOthers,
        memberUids: freshUids.filter((u) => u !== uid),
      };

      let transferred = false;
      if (data.ownerId === uid && freshOthers.length > 0) {
        const heir = pickHeir(freshOthers);
        patch.ownerId = heir.uid;
        // التاج في شاشة العائلة يقرأ role لا ownerId — فلو تُرك، ظهرت
        // العائلة بلا مالك مرئي رغم انتقال الملكية فعلاً.
        patch.members = freshOthers.map((m) =>
          m.uid === heir.uid ? { ...m, role: 'owner' } : m
        );
        transferred = true;
      }

      tx.update(hhDoc.ref, patch);
      return transferred;
    });

    report.membershipsRemoved += 1;
    if (handedOver) report.householdsHandedOver += 1;
  }
}

/** يمحو سجلّات الإحالة التي يظهر فيها المستخدم بأي طرف. */
async function eraseReferrals(db: Db, uid: string): Promise<number> {
  const [asReferrer, asReferred] = await Promise.all([
    db.collection('referrals').where('referrerUid', '==', uid).get(),
    db.collection('referrals').where('referredUid', '==', uid).get(),
  ]);
  const refs = new Map<string, FirebaseFirestore.DocumentReference>();
  [...asReferrer.docs, ...asReferred.docs].forEach((d) => refs.set(d.id, d.ref));
  return deleteRefs(db, [...refs.values()]);
}

/**
 * ملاحظات «شاركنا رأيك»: يبقى نصّها ويُمحى ما يربطها بصاحبها.
 * (قرار صاحب المشروع 2026-09-06: الملاحظة تنفع التطبيق، والهوية لا تنفعه.)
 */
async function anonymizeFeedback(db: Db, uid: string): Promise<number> {
  const snap = await db.collection('feedback').where('uid', '==', uid).get();
  if (snap.empty) return 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    snap.docs.slice(i, i + BATCH_SIZE).forEach((d) => {
      batch.update(d.ref, { uid: 'deleted-user', anonymizedAt: new Date().toISOString() });
    });
    await batch.commit();
  }
  return snap.docs.length;
}

/**
 * يمحو ملفات المستخدم من التخزين: تواقيع «سلفتنا» وإثباتات الدفع.
 * لا يرمي: لو نقصت صلاحية التخزين على مفتاح الخدمة، مَنْعُ المستخدم من حذف
 * حسابه أسوأ من تأخّر محو ملفاته — فيُسجَّل الأثر ليُعاد لاحقاً، ولا يُبتلع.
 */
async function eraseStorage(bucket: Bucket | null, uid: string, report: ErasureReport): Promise<void> {
  if (!bucket) return;
  try {
    const [files] = await bucket.getFiles({ prefix: `users/${uid}/` });
    await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
    report.storageFilesDeleted = files.length;
  } catch (err) {
    report.storageError = err instanceof Error ? err.message : 'unknown storage error';
  }
}

/**
 * يمحو كل أثر للمستخدم في قاعدة البيانات والتخزين.
 * ⚠️ لا يمسّ حساب المصادقة — يحذفه المُنادي **بعد** نجاح هذه الدالة، كي يبقى
 *    الحساب قائماً وقابلاً لإعادة المحاولة لو تعثّر شيء في الطريق.
 */
export async function eraseAccountData(
  db: Db,
  bucket: Bucket | null,
  uid: string
): Promise<ErasureReport> {
  const report: ErasureReport = {
    householdDocsDeleted: 0,
    householdsDissolved: 0,
    householdsHandedOver: 0,
    membershipsRemoved: 0,
    userDocsDeleted: 0,
    referralsDeleted: 0,
    feedbackAnonymized: 0,
    storageFilesDeleted: 0,
  };

  // ١) العائلة أولاً: مسارها يُعرف بالبحث في العائلات نفسها لا من إعدادات
  //    المستخدم — فلو كانت إعداداته قديمة أو ناقصة، يبقى الأثر مرصوداً.
  await eraseHouseholdPresence(db, uid, report);

  // ٢) بياناته الشخصية.
  const basePath = `users/${uid}`;
  for (const col of USER_COLLECTIONS) {
    report.userDocsDeleted += await deleteCollection(db, basePath, col);
  }

  // ٣) وثائق مفردة خارج مسار المستخدم.
  //    اشتراك الإشعارات: بقاؤه يجعل كل مهمة مجدولة (٤ يومياً) تدفع قراءة
  //    مهدورة لحساب لم يعد موجوداً، للأبد.
  await Promise.all([
    db.doc(`pushSubscriptions/${uid}`).delete(),
    db.doc(basePath).delete(),
  ]);

  // ٤) ما يحمل معرّفه في المجموعات العامة.
  report.referralsDeleted = await eraseReferrals(db, uid);
  report.feedbackAnonymized = await anonymizeFeedback(db, uid);

  // ٥) ملفاته في التخزين.
  await eraseStorage(bucket, uid, report);

  // ٦) أثر ما تعذّر — سجلّ داخلي لا تقرؤه القواعد لأحد (الرفض هو الافتراضي).
  if (report.storageError) {
    await db.collection('deletionResidue').doc(uid).set({
      uid,
      kind: 'storage',
      prefix: `users/${uid}/`,
      error: report.storageError,
      at: new Date().toISOString(),
    });
  }

  return report;
}
