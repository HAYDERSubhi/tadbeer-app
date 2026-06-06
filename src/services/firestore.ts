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
    Timestamp,
    serverTimestamp,
    getDoc,
    setDoc,
    writeBatch,
    updateDoc,
    arrayUnion,
    arrayRemove,
} from 'firebase/firestore';
import type { Expense, Goal, UserSettings, Income, RecurringPayment, AppTone, Category, Household, HouseholdMember } from '@/types';
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

export const getExpenses = async (uid: string, householdId?: string | null): Promise<Expense[]> => {
    if (!db) return [];
    const [p1, p2] = basePath(uid, householdId);
    const expensesCol = collection(db, p1, p2, 'expenses');
    const expenseSnapshot = await getDocs(expensesCol);
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

export const getIncomes = async (uid: string): Promise<Income[]> => {
    if (!db) return [];
    const incomesCol = collection(db, 'users', uid, 'incomes');
    const incomeSnapshot = await getDocs(incomesCol);
    const incomes: Income[] = [];
    incomeSnapshot.forEach((doc) => {
        const data = doc.data();
        incomes.push({
            id: doc.id,
            uid,
            ...data,
            date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : (data.date ? String(data.date) : new Date().toISOString()),
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as Income);
    });
    return incomes;
};

export const addIncome = async (uid: string, incomeData: Omit<Income, 'id' | 'createdAt' | 'uid'>) => {
    if (!db) throw new Error("Firestore is not initialized");
    const incomesCol = collection(db, 'users', uid, 'incomes');
    const docRef = await addDoc(incomesCol, {
        ...incomeData,
        date: new Date(incomeData.date),
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

export const updateIncome = async (uid: string, incomeId: string, incomeData: Partial<Omit<Income, 'id' | 'createdAt' | 'uid'>>) => {
    if (!db) throw new Error("Firestore is not initialized");
    const incomeDoc = doc(db, 'users', uid, 'incomes', incomeId);
    const dataToUpdate: { [key: string]: any } = { ...incomeData };
    if (incomeData.date) {
        dataToUpdate.date = new Date(incomeData.date);
    }
    await updateDoc(incomeDoc, dataToUpdate);
};

export const deleteIncome = async (uid: string, incomeId: string) => {
    if (!db) throw new Error("Firestore is not initialized");
    const incomeDoc = doc(db, 'users', uid, 'incomes', incomeId);
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
