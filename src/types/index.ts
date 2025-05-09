export type Expense = {
  id: string;
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

export type Category = {
  id: string;
  name: string;
  icon: string; // Lucide icon name or emoji
  color: string; // Tailwind color class e.g. "bg-blue-500"
  budget?: number;
  createdAt: string; // ISO string format
  updatedAt: string; // ISO string format
};

export type UserSettings = {
  theme: 'light' | 'dark' | 'system';
  language: 'ar'; // For now, only Arabic
  currency: 'IQD';
  currencyFormat: string; // e.g., "#,##0.00"
  budgetPeriodStart: number; // Day of the month
  showThousandSeparator: boolean;
  cardSyncEnabled?: boolean;
  cardSyncInterval?: number; // in minutes
};
