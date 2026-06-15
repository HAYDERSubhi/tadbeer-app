// src/services/firestore.ts
import { db } from '@/lib/firebase';
import {
    collection,
    addDoc,
    getDocs,
    doc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp,
    getDoc,
    setDoc,
    writeBatch,
    updateDoc,
    arrayUnion,
    arrayRemove,
} from 'firebase/firestore';
import type { Expense, Goal, UserSettings, Income, RecurringPayment, AppTone, Category, Household, HouseholdMember, Debt, WeddingPlan, Silftna } from '@/types';
import { DEFAULT_CATEGORIES } from '@/lib/constants';

// ─── Path helper: household or personal ────────────────────────────────────
function basePath(uid: string, householdId?: string | null): [string, string] {
  if (householdId) return ['households', householdId];
  return ['users', uid];
}

// ─── Invite code generator ──────────────────────────────────────────────────
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// =================================
// Expenses Service
// =================================

export const getExpenses = async (
    uid: string,
    householdId?: string | null,
    options?: { startDate?: Date }
): Promise<Expense[]> => {
    if (!db) return [];
    const [p1, p2] = basePath(uid, householdId);
    const expensesCol = collection(db, p1, p2, 'expenses');

    // When a startDate is provided we use a Firestore index query (fast).
    // Without startDate we fetch all documents (needed by stats/expenses pages).
    const q = options?.startDate
        ? query(expensesCol, where('date', '>=', Timestamp.fromDate(options.startDate)), orderBy('date', 'desc'))
        : query(expensesCol, orderBy('date', 'desc'));

    const expenseSnapshot = await getDocs(q);
    const expenses: Expense[] = [];
    expenseSnapshot.forEach((doc) => {
        const data = doc.data();
        expenses.push({
            id: doc.id,
            uid,
            ...data,
            date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : (data.date ? String(data.date) : new Date().toISOString()),
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
        } as Expense);
    });
    return expenses;
};

export const addExpense = async (uid: string, expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>, householdId?: string | null) => {
    if (!db) throw new Error("Firestore is not initialized");
    const [p1, p2] = basePath(uid, householdId);
    const expensesCol = collection(db, p1, p2, 'expenses');
    const docRef = await addDoc(expensesCol, {
        ...expenseData,
        date: new Date(expenseData.date), // Store as Firestore Timestamp
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
};

export const updateExpense = async (uid: string, expenseId: string, expenseData: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>>, householdId?: string | null) => {
    if (!db) throw new Error("Firestore is not initialized");
    const [p1, p2] = basePath(uid, householdId);
    const expenseDoc = doc(db, p1, p2, 'expenses', expenseId);
    const dataToUpdate: { [key: string]: any } = { 
        ...expenseData,
        updatedAt: serverTimestamp()
    };
    if (expenseData.date) {
        dataToUpdate.date = new Date(expenseData.date);
    }
    await updateDoc(expenseDoc, dataToUpdate);
};

export const deleteExpense = async (uid: string, expenseId: string, householdId?: string | null) => {
    if (!db) throw new Error("Firestore is not initialized");
    const [p1, p2] = basePath(uid, householdId);
    const expenseDoc = doc(db, p1, p2, 'expenses', expenseId);
    await deleteDoc(expenseDoc);
};

// ─── Atomic batch operations ────────────────────────────────────────────────
// Firestore limits a single batch to 500 writes. We chunk at 450 to leave
// headroom. Within one chunk the write is all-or-nothing, which prevents the
// partial-save → retry → duplicates failure mode of per-document Promise.all.

const BATCH_CHUNK_SIZE = 450;

export const addExpensesBatch = async (
    uid: string,
    expensesData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>[],
    householdId?: string | null
): Promise<number> => {
    if (!db) throw new Error("Firestore is not initialized");
    const [p1, p2] = basePath(uid, householdId);
    const expensesCol = collection(db, p1, p2, 'expenses');

    for (let i = 0; i < expensesData.length; i += BATCH_CHUNK_SIZE) {
        const chunk = expensesData.slice(i, i + BATCH_CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(expenseData => {
            const newDocRef = doc(expensesCol); // auto-generated ID
            batch.set(newDocRef, {
                ...expenseData,
                date: new Date(expenseData.date),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });
        await batch.commit();
    }
    return expensesData.length;
};

export const deleteExpensesBatch = async (
    uid: string,
    expenseIds: string[],
    householdId?: string | null
): Promise<number> => {
    if (!db) throw new Error("Firestore is not initialized");
    const [p1, p2] = basePath(uid, householdId);

    for (let i = 0; i < expenseIds.length; i += BATCH_CHUNK_SIZE) {
        const chunk = expenseIds.slice(i, i + BATCH_CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(id => {
            batch.delete(doc(db!, p1, p2, 'expenses', id));
        });
        await batch.commit();
    }
    return expenseIds.length;
};

// =================================
// Goals Service
// =================================

export const getGoals = async (uid: string, householdId?: string | null): Promise<Goal[]> => {
    if (!db) return [];
    const [p1, p2] = basePath(uid, householdId);
    const goalsCol = collection(db, p1, p2, 'goals');
    const goalSnapshot = await getDocs(goalsCol);
    const goals: Goal[] = [];
    goalSnapshot.forEach((doc) => {
        const data = doc.data();
        goals.push({
            id: doc.id,
            uid,
            ...data,
            targetDate: data.targetDate instanceof Timestamp ? data.targetDate.toDate().toISOString() : (data.targetDate ? String(data.targetDate) : new Date().toISOString()),
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as Goal);
    });
    return goals;
};

export const addGoal = async (uid: string, goalData: Omit<Goal, 'id' | 'createdAt' | 'uid'>, householdId?: string | null) => {
    if (!db) throw new Error("Firestore is not initialized");
    const [p1, p2] = basePath(uid, householdId);
    const goalsCol = collection(db, p1, p2, 'goals');
    const docRef = await addDoc(goalsCol, {
        ...goalData,
        targetDate: new Date(goalData.targetDate),
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

export const deleteGoal = async (uid: string, goalId: string, householdId?: string | null) => {
    if (!db) throw new Error("Firestore is not initialized");
    const [p1, p2] = basePath(uid, householdId);
    const goalDoc = doc(db, p1, p2, 'goals', goalId);
    await deleteDoc(goalDoc);
};

export const updateGoalSavedAmount = async (uid: string, goalId: string, savedAmount: number, householdId?: string | null) => {
    if (!db) throw new Error("Firestore is not initialized");
    const [p1, p2] = basePath(uid, householdId);
    const goalDoc = doc(db, p1, p2, 'goals', goalId);
    await updateDoc(goalDoc, { savedAmount });
};

// =================================
// Income Service
// =================================

// Reads incomes from the household path (when in a household) PLUS the user's
// personal path, so legacy incomes recorded before joining a household never
// disappear. Each income is tagged with its `scope` so update/delete can
// route to the correct path.
export const getIncomes = async (uid: string, householdId?: string | null): Promise<Income[]> => {
    if (!db) return [];

    const readCollection = async (p1: string, p2: string, scope: 'personal' | 'household'): Promise<Income[]> => {
        const snapshot = await getDocs(collection(db!, p1, p2, 'incomes'));
        const result: Income[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            result.push({
                id: doc.id,
                uid: (data.uid as string) || uid,
                ...data,
                date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : (data.date ? String(data.date) : new Date().toISOString()),
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
                scope,
            } as Income);
        });
        return result;
    };

    if (householdId) {
        const [household, personal] = await Promise.all([
            readCollection('households', householdId, 'household'),
            readCollection('users', uid, 'personal'),
        ]);
        return [...household, ...personal];
    }
    return readCollection('users', uid, 'personal');
};

export const addIncome = async (uid: string, incomeData: Omit<Income, 'id' | 'createdAt' | 'uid' | 'scope'>, householdId?: string | null) => {
    if (!db) throw new Error("Firestore is not initialized");
    const [p1, p2] = basePath(uid, householdId);
    const incomesCol = collection(db, p1, p2, 'incomes');
    const docRef = await addDoc(incomesCol, {
        ...incomeData,
        uid, // record who added it (useful for shared household incomes)
        date: new Date(incomeData.date),
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

// `scope` decides which path the income lives in; legacy personal incomes of
// household members must still be updated in the personal path.
export const updateIncome = async (uid: string, incomeId: string, incomeData: Partial<Omit<Income, 'id' | 'createdAt' | 'uid' | 'scope'>>, householdId?: string | null, scope?: 'personal' | 'household') => {
    if (!db) throw new Error("Firestore is not initialized");
    const [p1, p2] = scope === 'personal' ? ['users', uid] : basePath(uid, householdId);
    const incomeDoc = doc(db, p1, p2, 'incomes', incomeId);
    const dataToUpdate: { [key: string]: any } = { ...incomeData };
    if (incomeData.date) {
        dataToUpdate.date = new Date(incomeData.date);
    }
    await updateDoc(incomeDoc, dataToUpdate);
};

export const deleteIncome = async (uid: string, incomeId: string, householdId?: string | null, scope?: 'personal' | 'household') => {
    if (!db) throw new Error("Firestore is not initialized");
    const [p1, p2] = scope === 'personal' ? ['users', uid] : basePath(uid, householdId);
    const incomeDoc = doc(db, p1, p2, 'incomes', incomeId);
    await deleteDoc(incomeDoc);
};

// =================================
// User Settings Service
// =================================

const defaultSettings: UserSettings = {
    budget: { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 },
    categoryBudgets: {},
    profile: {
        monthlyIncome: 0,
        familyMembers: [],
    },
    recurringPayments: [],
    appTone: 'formal',
    categories: Object.values(DEFAULT_CATEGORIES).map(({isDefault, ...rest}) => rest), // Initialize with default categories
    notifications: { dailyReminderEnabled: false },
};

function parseRecurringPayments(raw: RecurringPayment[] = []): RecurringPayment[] {
    return raw.map(p => ({
        ...p,
        startDate: (p.startDate as unknown as Timestamp)?.toDate?.().toISOString() || new Date().toISOString(),
    }));
}

export const getUserSettings = async (uid: string): Promise<UserSettings> => {
    if (!db) return defaultSettings;

    // Always fetch user's personal doc (contains householdId + personal prefs)
    const userDocRef = doc(db, 'users', uid, 'settings', 'main');
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
        await setDoc(userDocRef, defaultSettings);
        return defaultSettings;
    }

    const userData = userSnap.data() as Partial<UserSettings>;
    const householdId = userData.householdId || null;

    if (householdId) {
        // Fetch shared household settings
        const hhRef = doc(db, 'households', householdId, 'settings', 'main');
        const hhSnap = await getDoc(hhRef);
        const hhData = hhSnap.exists() ? (hhSnap.data() as Partial<UserSettings>) : {};

        return {
            // Shared from household
            budget: { ...defaultSettings.budget, ...hhData.budget },
            categoryBudgets: { ...hhData.categoryBudgets },
            categories: hhData.categories && hhData.categories.length > 0 ? hhData.categories : defaultSettings.categories,
            recurringPayments: parseRecurringPayments(hhData.recurringPayments),
            profile: { ...defaultSettings.profile, ...hhData.profile },
            // Personal from user
            appTone: userData.appTone || 'formal',
            notifications: { ...defaultSettings.notifications, ...userData.notifications },
            currency: userData.currency,
            linkedCard: userData.linkedCard,
            householdId,
        };
    }

    // No household — original behaviour
    return {
        budget: { ...defaultSettings.budget, ...userData.budget },
        categoryBudgets: { ...userData.categoryBudgets },
        profile: { ...defaultSettings.profile, ...userData.profile },
        recurringPayments: parseRecurringPayments(userData.recurringPayments),
        appTone: userData.appTone || 'formal',
        categories: userData.categories && userData.categories.length > 0 ? userData.categories : defaultSettings.categories,
        notifications: { ...defaultSettings.notifications, ...userData.notifications },
        currency: userData.currency,
        linkedCard: userData.linkedCard,
        householdId: null,
    };
};

export const updateUserSettings = async (uid: string, settingsData: Partial<UserSettings>, householdId?: string | null) => {
    if (!db) throw new Error("Firestore is not initialized");

    const dataToSave = JSON.parse(JSON.stringify(settingsData));
    if (dataToSave.recurringPayments) {
        dataToSave.recurringPayments = dataToSave.recurringPayments.map((p: RecurringPayment) => ({
            ...p,
            startDate: new Date(p.startDate),
        }));
    }

    // Personal-only fields always go to user's own doc
    const PERSONAL_KEYS: (keyof UserSettings)[] = ['appTone', 'notifications', 'currency', 'linkedCard', 'householdId'];
    const personalData: Record<string, unknown> = {};
    const sharedData: Record<string, unknown> = {};

    Object.entries(dataToSave).forEach(([k, v]) => {
        if (PERSONAL_KEYS.includes(k as keyof UserSettings)) {
            personalData[k] = v;
        } else {
            sharedData[k] = v;
        }
    });

    const promises: Promise<void>[] = [];

    // Personal settings always to user doc
    if (Object.keys(personalData).length > 0) {
        promises.push(setDoc(doc(db, 'users', uid, 'settings', 'main'), personalData, { merge: true }));
    }

    // Shared settings: to household if in one, else to user doc
    if (Object.keys(sharedData).length > 0) {
        if (householdId) {
            promises.push(setDoc(doc(db, 'households', householdId, 'settings', 'main'), sharedData, { merge: true }));
        } else {
            promises.push(setDoc(doc(db, 'users', uid, 'settings', 'main'), sharedData, { merge: true }));
        }
    }

    await Promise.all(promises);
};

// =================================
// Data Management Service
// =================================

// Generic function to delete all documents in a collection
export const deleteCollection = async (uid: string, collectionName: string) => {
    if (!db) throw new Error("Firestore is not initialized");
    const collectionRef = collection(db, 'users', uid, collectionName);
    const q = query(collectionRef);
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
};

// =================================
// Backup & Restore Service
// =================================

export const exportUserData = async (uid: string) => {
    if (!db) throw new Error("Firestore is not initialized");
    const [expenses, goals, incomes, settings] = await Promise.all([
        getDocs(collection(db, 'users', uid, 'expenses')),
        getDocs(collection(db, 'users', uid, 'goals')),
        getDocs(collection(db, 'users', uid, 'incomes')),
        getDoc(doc(db, 'users', uid, 'settings', 'main')),
    ]);

    return {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        uid,
        expenses: expenses.docs.map(d => ({ id: d.id, ...d.data() })),
        goals: goals.docs.map(d => ({ id: d.id, ...d.data() })),
        incomes: incomes.docs.map(d => ({ id: d.id, ...d.data() })),
        settings: settings.exists() ? settings.data() : {},
    };
};

export const importUserData = async (
    uid: string,
    data: { expenses: any[]; goals: any[]; incomes: any[]; settings: any }
) => {
    if (!db) throw new Error("Firestore is not initialized");

    const BATCH_SIZE = 400;

    const allWrites: (() => Promise<void>)[] = [];

    // Restore settings
    if (data.settings) {
        allWrites.push(() =>
            setDoc(doc(db!, 'users', uid, 'settings', 'main'), data.settings, { merge: true })
        );
    }

    // Helper to batch-write a collection
    const batchWrite = async (items: any[], colName: string) => {
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = writeBatch(db!);
            items.slice(i, i + BATCH_SIZE).forEach(item => {
                const { id, ...rest } = item;
                const ref = id
                    ? doc(db!, 'users', uid, colName, id)
                    : doc(collection(db!, 'users', uid, colName));
                batch.set(ref, rest, { merge: true });
            });
            await batch.commit();
        }
    };

    await Promise.all([
        batchWrite(data.expenses || [], 'expenses'),
        batchWrite(data.goals || [], 'goals'),
        batchWrite(data.incomes || [], 'incomes'),
        ...allWrites.map(fn => fn()),
    ]);
};

// =================================
// Household / Family Sharing Service
// =================================

export const getHousehold = async (householdId: string): Promise<Household | null> => {
    if (!db) return null;
    const ref = doc(db, 'households', householdId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
        id: snap.id,
        name: d.name,
        ownerId: d.ownerId,
        inviteCode: d.inviteCode,
        createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate().toISOString() : String(d.createdAt),
        members: (d.members || []).map((m: any) => ({
            ...m,
            joinedAt: m.joinedAt instanceof Timestamp ? m.joinedAt.toDate().toISOString() : String(m.joinedAt || ''),
        })),
    };
};

export const createHousehold = async (
    uid: string,
    displayName: string,
    email: string,
    householdName: string
): Promise<string> => {
    if (!db) throw new Error("Firestore is not initialized");

    const inviteCode = generateInviteCode();
    const member: HouseholdMember = { uid, displayName, email, role: 'owner', joinedAt: new Date().toISOString() };

    // 1. Create household doc (memberUids is a flat array for easy Rules checking)
    const hhRef = doc(collection(db, 'households'));
    await setDoc(hhRef, {
        name: householdName,
        ownerId: uid,
        inviteCode,
        members: [member],
        memberUids: [uid],
        createdAt: serverTimestamp(),
    });

    // 2. Copy user's existing data to household
    const [expenses, goals, settingsSnap] = await Promise.all([
        getDocs(collection(db, 'users', uid, 'expenses')),
        getDocs(collection(db, 'users', uid, 'goals')),
        getDoc(doc(db, 'users', uid, 'settings', 'main')),
    ]);

    const BATCH_SIZE = 400;
    const migrateSnap = async (snap: typeof expenses, col: string) => {
        const items = snap.docs;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = writeBatch(db!);
            items.slice(i, i + BATCH_SIZE).forEach(d => {
                batch.set(doc(db!, 'households', hhRef.id, col, d.id), d.data());
            });
            await batch.commit();
        }
    };

    await Promise.all([
        migrateSnap(expenses, 'expenses'),
        migrateSnap(goals, 'goals'),
    ]);

    // Copy settings (shared portion) to household
    if (settingsSnap.exists()) {
        const { appTone, notifications, currency, householdId: _, ...shared } = settingsSnap.data() as any;
        await setDoc(doc(db, 'households', hhRef.id, 'settings', 'main'), shared, { merge: true });
    }

    // 3. Link user to household
    await setDoc(doc(db, 'users', uid, 'settings', 'main'), { householdId: hhRef.id }, { merge: true });

    return hhRef.id;
};

export const joinHouseholdByCode = async (
    uid: string,
    displayName: string,
    email: string,
    code: string
): Promise<Household> => {
    if (!db) throw new Error("Firestore is not initialized");

    const q = query(collection(db, 'households'), where('inviteCode', '==', code.toUpperCase().trim()));
    const snap = await getDocs(q);

    if (snap.empty) throw new Error('كود الدعوة غير صحيح أو منتهي الصلاحية');

    const hhDoc = snap.docs[0];
    const hhId = hhDoc.id;

    // Check not already a member
    const existing = hhDoc.data().members || [];
    if (existing.some((m: any) => m.uid === uid)) throw new Error('أنت بالفعل عضو في هذه العائلة');

    const member: HouseholdMember = { uid, displayName, email, role: 'member', joinedAt: new Date().toISOString() };

    // Add to members array + memberUids
    await updateDoc(hhDoc.ref, { members: arrayUnion(member), memberUids: arrayUnion(uid) });

    // Link user to household
    await setDoc(doc(db, 'users', uid, 'settings', 'main'), { householdId: hhId }, { merge: true });

    return getHousehold(hhId) as Promise<Household>;
};

export const leaveHousehold = async (uid: string, household: Household): Promise<void> => {
    if (!db) throw new Error("Firestore is not initialized");

    const isOwner = household.ownerId === uid;

    if (isOwner && household.members.length > 1) {
        throw new Error('لا يمكنك مغادرة العائلة وهناك أعضاء آخرون. قم بنقل الملكية أو إزالتهم أولاً.');
    }

    if (isOwner && household.members.length <= 1) {
        // Last member — delete the whole household
        const hhRef = doc(db, 'households', household.id);
        // Delete sub-collections expenses + goals + settings
        for (const col of ['expenses', 'goals']) {
            const snap = await getDocs(collection(db, 'households', household.id, col));
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            if (snap.docs.length > 0) await batch.commit();
        }
        await deleteDoc(hhRef);
    } else {
        // Just remove member from array
        const member = household.members.find(m => m.uid === uid);
        if (member) {
            await updateDoc(doc(db, 'households', household.id), {
                members: arrayRemove(member),
                memberUids: arrayRemove(uid),
            });
        }
    }

    // Remove householdId from user settings
    await setDoc(doc(db, 'users', uid, 'settings', 'main'), { householdId: null }, { merge: true });
};

export const removeMemberFromHousehold = async (
    ownerUid: string,
    household: Household,
    memberUid: string
): Promise<void> => {
    if (!db) throw new Error("Firestore is not initialized");
    if (household.ownerId !== ownerUid) throw new Error('فقط المالك يمكنه إزالة الأعضاء');

    const member = household.members.find(m => m.uid === memberUid);
    if (!member) return;

    await updateDoc(doc(db, 'households', household.id), {
        members: arrayRemove(member),
        memberUids: arrayRemove(memberUid),
    });
    await setDoc(doc(db, 'users', memberUid, 'settings', 'main'), { householdId: null }, { merge: true });
};

// =================================
// Badges Service
// =================================

export const getUserBadges = async (uid: string): Promise<import('@/types').EarnedBadge[]> => {
    if (!db) return [];
    const snap = await getDoc(doc(db, 'users', uid, 'badges', 'earned'));
    if (!snap.exists()) return [];
    const data = snap.data();
    return Object.entries(data).map(([id, val]: [string, any]) => ({
        id,
        earnedAt: val instanceof Timestamp ? val.toDate().toISOString() : String(val),
    }));
};

export const saveBadge = async (uid: string, badgeId: string): Promise<void> => {
    if (!db) return;
    await setDoc(
        doc(db, 'users', uid, 'badges', 'earned'),
        { [badgeId]: serverTimestamp() },
        { merge: true }
    );
};

// =================================
// Referral Service
// =================================

export const recordReferral = async (referrerUid: string, referredUid: string): Promise<void> => {
    if (!db) return;
    // Guard: don't self-refer
    if (referrerUid === referredUid) return;
    await addDoc(collection(db, 'referrals'), {
        referrerUid,
        referredUid,
        createdAt: serverTimestamp(),
    });
    // Mark on new user's settings so we don't double-count
    await setDoc(doc(db, 'users', referredUid, 'settings', 'main'), { referredBy: referrerUid }, { merge: true });
};

export const getReferralCount = async (uid: string): Promise<number> => {
    if (!db) return 0;
    const q = query(collection(db, 'referrals'), where('referrerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.size;
};

// =================================
// Installment Plans Service
// =================================
import type { InstallmentPlan } from '@/types';

export const getInstallmentPlans = async (uid: string): Promise<InstallmentPlan[]> => {
  if (!db) throw new Error("Firestore is not initialized");
  const col = collection(db, 'users', uid, 'installmentPlans');
  const q = query(col, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InstallmentPlan));
};

export const addInstallmentPlan = async (uid: string, data: Omit<InstallmentPlan,'id'|'uid'|'createdAt'>): Promise<string> => {
  if (!db) throw new Error("Firestore is not initialized");
  const ref = await addDoc(collection(db, 'users', uid, 'installmentPlans'), {
    ...data, uid, createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const payInstallment = async (uid: string, planId: string, newPaidCount: number, isCompleted: boolean): Promise<void> => {
  if (!db) throw new Error("Firestore is not initialized");
  await updateDoc(doc(db, 'users', uid, 'installmentPlans', planId), { paidCount: newPaidCount, isCompleted });
};

export const deleteInstallmentPlan = async (uid: string, planId: string): Promise<void> => {
  if (!db) throw new Error("Firestore is not initialized");
  await deleteDoc(doc(db, 'users', uid, 'installmentPlans', planId));
};

// =================================
// Debts Service
// =================================

export const getDebts = async (uid: string): Promise<Debt[]> => {
    if (!db) return [];
    const debtsCol = collection(db, 'users', uid, 'debts');
    const q = query(debtsCol, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            uid,
            name: data.name,
            amount: data.amount,
            direction: data.direction,
            reason: data.reason,
            date: data.date,
            isSettled: data.isSettled ?? false,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as Debt;
    });
};

export const addDebt = async (uid: string, data: Omit<Debt, 'id' | 'uid' | 'createdAt'>): Promise<string> => {
    if (!db) throw new Error("Firestore is not initialized");
    const debtsCol = collection(db, 'users', uid, 'debts');
    const ref = await addDoc(debtsCol, { ...data, createdAt: serverTimestamp() });
    return ref.id;
};

export const settleDebt = async (uid: string, debtId: string): Promise<void> => {
    if (!db) throw new Error("Firestore is not initialized");
    await updateDoc(doc(db, 'users', uid, 'debts', debtId), { isSettled: true, settledAt: new Date().toISOString() });
};

export const unsettleDebt = async (uid: string, debtId: string): Promise<void> => {
    if (!db) throw new Error("Firestore is not initialized");
    await updateDoc(doc(db, 'users', uid, 'debts', debtId), { isSettled: false, settledAt: null });
};

// ── خطة الزواج (مستند واحد لكل مستخدم) ──────────────────────────
export const getWeddingPlan = async (uid: string): Promise<WeddingPlan | null> => {
    if (!db) throw new Error("Firestore is not initialized");
    const snap = await getDoc(doc(db, 'users', uid, 'wedding', 'plan'));
    return snap.exists() ? (snap.data() as WeddingPlan) : null;
};

export const saveWeddingPlan = async (uid: string, plan: WeddingPlan): Promise<void> => {
    if (!db) throw new Error("Firestore is not initialized");
    await setDoc(doc(db, 'users', uid, 'wedding', 'plan'), plan);
};

// ── سلفتنا (سلف دوّارة — مستندات تحت users/{uid}/silftna) ──────────
export const getSilftnaList = async (uid: string): Promise<Silftna[]> => {
    if (!db) throw new Error("Firestore is not initialized");
    const snap = await getDocs(collection(db, 'users', uid, 'silftna'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Silftna))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

export const getSilftna = async (uid: string, id: string): Promise<Silftna | null> => {
    if (!db) throw new Error("Firestore is not initialized");
    const snap = await getDoc(doc(db, 'users', uid, 'silftna', id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Silftna) : null;
};

export const addSilftna = async (uid: string, data: Omit<Silftna, 'id' | 'uid' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    if (!db) throw new Error("Firestore is not initialized");
    const now = new Date().toISOString();
    const ref = await addDoc(collection(db, 'users', uid, 'silftna'), { ...data, uid, createdAt: now, updatedAt: now });
    return ref.id;
};

export const updateSilftna = async (uid: string, id: string, patch: Partial<Silftna>): Promise<void> => {
    if (!db) throw new Error("Firestore is not initialized");
    await updateDoc(doc(db, 'users', uid, 'silftna', id), { ...patch, updatedAt: new Date().toISOString() });
};

export const deleteSilftna = async (uid: string, id: string): Promise<void> => {
    if (!db) throw new Error("Firestore is not initialized");
    await deleteDoc(doc(db, 'users', uid, 'silftna', id));
};

export const deleteDebt = async (uid: string, debtId: string): Promise<void> => {
    if (!db) throw new Error("Firestore is not initialized");
    await deleteDoc(doc(db, 'users', uid, 'debts', debtId));
};

export const addFeedback = async (uid: string, feedback: { subject: string; details: string; email?: string }) => {
    if (!db) throw new Error("Firestore is not initialized");
    // Feedback is stored in a top-level collection, but we still link it to the user
    const feedbackCol = collection(db, 'feedback');
    await addDoc(feedbackCol, {
        ...feedback,
        uid: uid,
        createdAt: serverTimestamp(),
    });
};
