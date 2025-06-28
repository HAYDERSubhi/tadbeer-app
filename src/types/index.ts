export type Expense = {
  id: string;
  uid: string;
  title: string;
  amount: number;
  category: string; // Category ID/key
  date: string; // ISO string format
  description?: string;
  isOutOfBudget?: boolean;
  outOfBudgetDetails?: string;
  createdAt: string; // ISO string format
  updatedAt: string; // ISO string format
};

export type Goal = {
  id: string;
  uid: string;
  name: string;
  targetAmount: number;
  targetDate: string; // ISO string format
  createdAt: string; // ISO string format
};

export type Income = {
  id: string;
  uid: string;
  title: string;
  amount: number;
  type: 'recurring' | 'one-time';
  date: string; // ISO string format, relevant for one-time income
  createdAt: string; // ISO string format
};

export type FamilyMember = {
  id: string;
  type: 'adult' | 'child';
  age: number;
}

export type UserProfile = {
  monthlyIncome: number;
  familyMembers: FamilyMember[];
};

export type UserBudgetSettings = {
    totalBudget: number;
    weeklyBudget: number;
    zeroSpendDaysTarget: number;
}

export type UserSettings = {
  budget: UserBudgetSettings;
  categoryBudgets: Record<string, number>;
  profile: UserProfile;
};
