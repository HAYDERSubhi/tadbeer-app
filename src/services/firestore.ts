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
    updateDoc
} from 'firebase/firestore';
import type { Expense, Goal, UserSettings, Income } from '@/types';

// =================================
// Expenses Service
// =================================

export const getExpenses = async (uid: string): Promise<Expense[]> => {
    const expensesCol = collection(db, `users/${uid}/expenses`);
    const expenseSnapshot = await getDocs(expensesCol);
    const expenses: Expense[] = [];
    expenseSnapshot.forEach((doc) => {
        const data = doc.data();
        expenses.push({
            id: doc.id,
            uid,
            ...data,
            // Convert Firestore Timestamp to ISO string for client-side date handling
            date: (data.date as Timestamp).toDate().toISOString(),
            createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as Expense);
    });
    return expenses;
};

export const addExpense = async (uid: string, expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>) => {
    const expensesCol = collection(db, `users/${uid}/expenses`);
    const docRef = await addDoc(expensesCol, {
        ...expenseData,
        date: new Date(expenseData.date), // Store as Firestore Timestamp
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
};

export const updateExpense = async (uid: string, expenseId: string, expenseData: Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>>) => {
    const expenseDoc = doc(db, `users/${uid}/expenses`, expenseId);
    const dataToUpdate: { [key: string]: any } = { 
        ...expenseData,
        updatedAt: serverTimestamp()
    };
    if (expenseData.date) {
        dataToUpdate.date = new Date(expenseData.date);
    }
    await updateDoc(expenseDoc, dataToUpdate);
};

export const deleteExpense = async (uid: string, expenseId: string) => {
    const expenseDoc = doc(db, `users/${uid}/expenses`, expenseId);
    await deleteDoc(expenseDoc);
};

// =================================
// Goals Service
// =================================

export const getGoals = async (uid: string): Promise<Goal[]> => {
    const goalsCol = collection(db, `users/${uid}/goals`);
    const goalSnapshot = await getDocs(goalsCol);
    const goals: Goal[] = [];
    goalSnapshot.forEach((doc) => {
        const data = doc.data();
        goals.push({
            id: doc.id,
            uid,
            ...data,
            targetDate: (data.targetDate as Timestamp).toDate().toISOString(),
            createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as Goal);
    });
    return goals;
};

export const addGoal = async (uid: string, goalData: Omit<Goal, 'id' | 'createdAt' | 'uid'>) => {
    const goalsCol = collection(db, `users/${uid}/goals`);
    const docRef = await addDoc(goalsCol, {
        ...goalData,
        targetDate: new Date(goalData.targetDate),
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

export const deleteGoal = async (uid: string, goalId: string) => {
    const goalDoc = doc(db, `users/${uid}/goals`, goalId);
    await deleteDoc(goalDoc);
};

// =================================
// Income Service
// =================================

export const getIncomes = async (uid: string): Promise<Income[]> => {
    const incomesCol = collection(db, `users/${uid}/incomes`);
    const incomeSnapshot = await getDocs(incomesCol);
    const incomes: Income[] = [];
    incomeSnapshot.forEach((doc) => {
        const data = doc.data();
        incomes.push({
            id: doc.id,
            uid,
            ...data,
            date: (data.date as Timestamp).toDate().toISOString(),
            createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as Income);
    });
    return incomes;
};

export const addIncome = async (uid: string, incomeData: Omit<Income, 'id' | 'createdAt' | 'uid'>) => {
    const incomesCol = collection(db, `users/${uid}/incomes`);
    const docRef = await addDoc(incomesCol, {
        ...incomeData,
        date: new Date(incomeData.date),
        createdAt: serverTimestamp(),
    });
    return docRef.id;
};

export const updateIncome = async (uid: string, incomeId: string, incomeData: Partial<Omit<Income, 'id' | 'createdAt' | 'uid'>>) => {
    const incomeDoc = doc(db, `users/${uid}/incomes`, incomeId);
    const dataToUpdate: { [key: string]: any } = { ...incomeData };
    if (incomeData.date) {
        dataToUpdate.date = new Date(incomeData.date);
    }
    await updateDoc(incomeDoc, dataToUpdate);
};

export const deleteIncome = async (uid: string, incomeId: string) => {
    const incomeDoc = doc(db, `users/${uid}/incomes`, incomeId);
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
};

export const getUserSettings = async (uid: string): Promise<UserSettings> => {
    const settingsDocRef = doc(db, `users/${uid}/settings`, 'main');
    const docSnap = await getDoc(settingsDocRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        // Deep merge with defaults to prevent crashes if parts of the settings are missing
        const mergedSettings: UserSettings = {
            budget: { ...defaultSettings.budget, ...data.budget },
            categoryBudgets: { ...defaultSettings.categoryBudgets, ...data.categoryBudgets },
            profile: {
                ...defaultSettings.profile,
                ...data.profile
            }
        };
        return mergedSettings;
    } else {
        // Document doesn't exist, just return the default object.
        // The first save from the settings page will create the document.
        return defaultSettings;
    }
};

export const updateUserSettings = async (uid: string, settingsData: Partial<UserSettings>) => {
    const settingsDocRef = doc(db, `users/${uid}/settings`, 'main');
    // Use set with merge: true to update or create if it doesn't exist
    await setDoc(settingsDocRef, settingsData, { merge: true });
};

// =================================
// Data Management Service
// =================================

// Generic function to delete all documents in a collection
export const deleteCollection = async (uid: string, collectionName: string) => {
    const collectionRef = collection(db, `users/${uid}/${collectionName}`);
    const q = query(collectionRef);
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
};
