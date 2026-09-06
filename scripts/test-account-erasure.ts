// scripts/test-account-erasure.ts
// اختبار محو الحساب على محاكي Firebase — لا يمسّ الإنتاج إطلاقاً.
//
// لماذا موجود؟ متغيّرات firebase-admin في Vercel وحدها (فخّ ٢ في CLAUDE.md)،
// فمسار حذف الحساب لا يعمل على npm run dev أصلاً. وهو أخطر شفرة في التطبيق:
// تمحو نهائياً وتمسّ بيانات أشخاص آخرين. هذا الملف يبني الحالات الأربع على
// نسخة وهمية كاملة ثم يعدّ ما بقي فعلاً — لا «يبدو صحيحاً».
//
// التشغيل:
//   firebase emulators:exec --only firestore,storage,auth "npx tsx scripts/test-account-erasure.ts"
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { eraseAccountData } from '../src/lib/account-erasure';

const PROJECT = 'tadbeer-erasure-test';
const BUCKET = `${PROJECT}.appspot.com`;

process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= 'localhost:9199';

let failures = 0;
const results: string[] = [];

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  results.push(`${ok ? '  ✅' : '  ❌'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (المتوقَّع ${JSON.stringify(expected)})`}`);
}

type Db = FirebaseFirestore.Firestore;

const member = (uid: string, joinedAt: string, role: 'owner' | 'member') => ({
  uid,
  displayName: `اسم ${uid}`,
  email: `${uid}@example.com`,
  role,
  joinedAt,
});

/** يبني عائلة بأعضائها وبمصروف ودخل وهدف لكل عضو. */
async function seedHousehold(db: Db, hhId: string, members: ReturnType<typeof member>[]) {
  await db.doc(`households/${hhId}`).set({
    name: 'عائلة الاختبار',
    ownerId: members.find((m) => m.role === 'owner')!.uid,
    inviteCode: 'ABC123',
    members,
    memberUids: members.map((m) => m.uid),
    createdAt: new Date().toISOString(),
  });
  await db.doc(`households/${hhId}/settings/main`).set({ totalBudget: 500000 });
  for (const m of members) {
    for (const col of ['expenses', 'goals', 'incomes']) {
      await db.collection(`households/${hhId}/${col}`).add({ uid: m.uid, title: `${col} ${m.uid}` });
    }
  }
  // وثيقة قديمة بلا uid — من قبل ختم صاحب السجل. يجب ألّا تُنسب لأحد.
  await db.collection(`households/${hhId}/expenses`).add({ title: 'قديمة بلا صاحب' });
}

/** يبني بيانات المستخدم الشخصية كاملةً كما يكتبها التطبيق فعلاً. */
async function seedUser(db: Db, uid: string) {
  await db.doc(`users/${uid}`).set({ createdAt: new Date().toISOString() });
  await db.doc(`users/${uid}/settings/main`).set({ appTone: 'formal' });
  await db.doc(`users/${uid}/wedding/plan`).set({ budget: 1000 });
  await db.doc(`users/${uid}/badges/earned`).set({ badges: ['first_expense'] });
  for (const col of ['expenses', 'goals', 'incomes', 'installmentPlans', 'debts', 'silftna', 'trips']) {
    await db.collection(`users/${uid}/${col}`).add({ uid, title: col });
  }
  await db.doc(`pushSubscriptions/${uid}`).set({ endpoint: 'https://example.test/x' });
  await db.collection('feedback').add({ uid, subject: 'ملاحظة', details: 'التطبيق ممتاز' });
  await db.collection('referrals').add({ referrerUid: uid, referredUid: 'someone-else' });
  await db.collection('referrals').add({ referrerUid: 'someone-else', referredUid: uid });
}

/** يرفع توقيعاً وإثبات دفع كما ترفعهما «سلفتنا». */
async function seedStorage(bucket: ReturnType<typeof getStorage>['bucket'] extends never ? never : any, uid: string) {
  await bucket.file(`users/${uid}/silftna/s1/signatures/sig.png`).save(Buffer.from('png'));
  await bucket.file(`users/${uid}/silftna/s1/proofs/proof.jpg`).save(Buffer.from('jpg'));
}

async function countCollection(db: Db, path: string): Promise<number> {
  return (await db.collection(path).get()).size;
}

async function main() {
  const app: App = initializeApp({ projectId: PROJECT, storageBucket: BUCKET });
  const db = getFirestore(app);
  const bucket = getStorage(app).bucket(BUCKET);

  console.log('\n══════════ اختبار محو الحساب على المحاكي ══════════\n');

  // ───────────── الحالة ١: عضو عادي في عائلة فيها آخرون ─────────────
  {
    const [me, other] = ['case1-member', 'case1-owner'];
    await seedUser(db, me);
    await seedStorage(bucket, me);
    await seedHousehold(db, 'hh1', [
      member(other, '2026-01-01T00:00:00Z', 'owner'),
      member(me, '2026-02-01T00:00:00Z', 'member'),
    ]);

    const report = await eraseAccountData(db, bucket, me);
    const hh = (await db.doc('households/hh1').get()).data()!;

    console.log('الحالة ١ — عضو عادي يحذف حسابه:');
    check('وثائقه في العائلة مُحيت', report.householdDocsDeleted, 3);
    check('لم يبقَ له مصروف في العائلة', await countCollection(db, 'households/hh1/expenses'), 2); // مصروف المالك + القديمة بلا صاحب
    check('اسمه وبريده رُفعا من الأعضاء', hh.members.map((m: any) => m.uid), [other]);
    check('معرّفه رُفع من memberUids', hh.memberUids, [other]);
    check('العائلة لم تُحلّ', (await db.doc('households/hh1').get()).exists, true);
    check('المالك لم يتغيّر', hh.ownerId, other);
    check('بياناته الشخصية مُحيت', await countCollection(db, `users/${me}/expenses`), 0);
    check('مستند المستخدم مُحي', (await db.doc(`users/${me}`).get()).exists, false);
    check('اشتراك الإشعارات مُحي', (await db.doc(`pushSubscriptions/${me}`).get()).exists, false);
    check('إحالاته مُحيت (الطرفان)', report.referralsDeleted, 2);
    check('ملاحظته بقيت بلا هوية', report.feedbackAnonymized, 1);
    check('ملفاته مُحيت من التخزين', report.storageFilesDeleted, 2);
    check('لا ملفات باقية', (await bucket.getFiles({ prefix: `users/${me}/` }))[0].length, 0);
    check('بيانات العضو الآخر سليمة', await countCollection(db, 'households/hh1/goals'), 1);
    console.log(results.splice(0).join('\n'));
  }

  // ───────────── الحالة ٢: صاحب العائلة ومعه آخرون ─────────────
  {
    const [me, older, newer] = ['case2-owner', 'case2-older', 'case2-newer'];
    await seedUser(db, me);
    await seedHousehold(db, 'hh2', [
      member(me, '2026-01-01T00:00:00Z', 'owner'),
      member(newer, '2026-03-01T00:00:00Z', 'member'),
      member(older, '2026-02-01T00:00:00Z', 'member'),
    ]);

    const report = await eraseAccountData(db, bucket, me);
    const hh = (await db.doc('households/hh2').get()).data()!;

    console.log('\nالحالة ٢ — صاحب العائلة يحذف حسابه ومعه أعضاء:');
    check('الملكية انتقلت لأقدم عضو', hh.ownerId, older);
    check('التاج انتقل معها (role)', hh.members.find((m: any) => m.uid === older).role, 'owner');
    check('العضو الأحدث بقي عضواً', hh.members.find((m: any) => m.uid === newer).role, 'member');
    check('اسمه وبريده رُفعا', hh.members.some((m: any) => m.uid === me), false);
    check('العائلة لم تُحلّ', (await db.doc('households/hh2').get()).exists, true);
    check('وثائقه وحدها مُحيت', report.householdDocsDeleted, 3);
    check('وثائق الباقين سليمة', await countCollection(db, 'households/hh2/expenses'), 3); // عضوان + القديمة بلا صاحب
    check('سُجِّل انتقال ملكية واحد', report.householdsHandedOver, 1);
    console.log(results.splice(0).join('\n'));
  }

  // ───────────── الحالة ٣: آخر عضو في العائلة ─────────────
  {
    const me = 'case3-solo';
    await seedUser(db, me);
    await seedHousehold(db, 'hh3', [member(me, '2026-01-01T00:00:00Z', 'owner')]);

    const report = await eraseAccountData(db, bucket, me);

    console.log('\nالحالة ٣ — آخر عضو يحذف حسابه:');
    check('العائلة حُلّت', (await db.doc('households/hh3').get()).exists, false);
    check('سُجِّل حلّ واحد', report.householdsDissolved, 1);
    check('مصاريف العائلة مُحيت', await countCollection(db, 'households/hh3/expenses'), 0);
    check('أهداف العائلة مُحيت', await countCollection(db, 'households/hh3/goals'), 0);
    check('دخل العائلة مُحي', await countCollection(db, 'households/hh3/incomes'), 0);
    check('إعدادات العائلة مُحيت', await countCollection(db, 'households/hh3/settings'), 0);
    console.log(results.splice(0).join('\n'));
  }

  // ───────────── الحالة ٤: مستخدم بلا عائلة إطلاقاً ─────────────
  {
    const me = 'case4-personal';
    await seedUser(db, me);
    await seedStorage(bucket, me);

    const report = await eraseAccountData(db, bucket, me);

    console.log('\nالحالة ٤ — مستخدم شخصي بلا عائلة:');
    check('لم تُمسّ أي عائلة', report.membershipsRemoved, 0);
    check('كل بياناته الشخصية مُحيت', report.userDocsDeleted, 10); // 7 مجموعات + settings + wedding + badges
    check('«سفراتي» مُحيت', await countCollection(db, `users/${me}/trips`), 0);
    check('الأوسمة مُحيت', await countCollection(db, `users/${me}/badges`), 0);
    check('خطة الزواج مُحيت', await countCollection(db, `users/${me}/wedding`), 0);
    check('ملفاته مُحيت', report.storageFilesDeleted, 2);
    console.log(results.splice(0).join('\n'));
  }

  // ───────────── الحالة ٥: إعادة التنفيذ على حساب مُحي سلفاً ─────────────
  {
    const me = 'case4-personal';
    console.log('\nالحالة ٥ — إعادة المحاولة على حساب مُحي (يجب ألّا تنفجر):');
    try {
      const report = await eraseAccountData(db, bucket, me);
      check('نُفِّذت بلا خطأ وبلا أثر', report.userDocsDeleted + report.membershipsRemoved, 0);
    } catch (e) {
      check('نُفِّذت بلا خطأ', `انفجرت: ${(e as Error).message}`, 'بلا خطأ');
    }
    console.log(results.splice(0).join('\n'));
  }

  console.log(`\n══════════ ${failures === 0 ? '✅ كل الفحوصات نجحت' : `❌ ${failures} فحصاً فشل`} ══════════\n`);
  await deleteApp(app);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('الاختبار انفجر:', e);
  process.exit(1);
});
