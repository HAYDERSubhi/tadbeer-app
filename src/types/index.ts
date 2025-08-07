

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

export type RecurringPayment = {
  id: string;
  title: string;
  amount: number;
  category: string;
  frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time';
  startDate: string; // ISO string format for the first payment
};

export type UserProfile = {
  monthlyIncome: number;
  familyMembers?: FamilyMember[];
};

export type UserBudgetSettings = {
    totalBudget: number;
    weeklyBudget: number;
    zeroSpendDaysTarget: number;
}

export type LinkedCard = {
  name: string;
  last4: string;
}

export type AppTone = 'formal' | 'colloquial';

export type Category = {
    id: string;
    name: string;
    icon: string; // Emoji
    isDefault?: boolean; // To distinguish default from user-created
};

export type NotificationSettings = {
  dailyReminderEnabled?: boolean;
}

export type UserSettings = {
  budget: UserBudgetSettings;
  categoryBudgets: Record<string, number>;
  profile: UserProfile;
  linkedCard?: LinkedCard | null;
  recurringPayments?: RecurringPayment[];
  appTone?: AppTone;
  categories?: Category[];
  notifications?: NotificationSettings;
};
