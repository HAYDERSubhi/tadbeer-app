

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
  savedAmount?: number; // manually logged savings toward this goal
  createdAt: string; // ISO string format
};

export type Income = {
  id: string;
  uid: string;
  title: string;
  amount: number;
  type: 'recurring' | 'one-time';
  date: string; // ISO string format, relevant for one-time income
  dayOfMonth?: number; // 1-31, relevant for recurring income
  createdAt: string; // ISO string format
  // Set at read time (not stored): which Firestore path this income lives in.
  // Household members may still have legacy incomes in their personal path;
  // update/delete must route to the correct path.
  scope?: 'personal' | 'household';
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
    icon: string;
    color: string; // Color index for charts, e.g., "1", "2"
    isDefault?: boolean; // To distinguish default from user-created
};

export type ReminderSlot = 'morning' | 'afternoon' | 'evening';

export type NotificationSettings = {
  dailyReminderEnabled?: boolean;
  reminderSlot?: ReminderSlot;
}

export type CurrencyCode = 'IQD' | 'SAR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'KWD' | 'EGP' | 'TRY';

export type UserSettings = {
  budget: UserBudgetSettings;
  categoryBudgets: Record<string, number>;
  profile: UserProfile;
  linkedCard?: LinkedCard | null;
  recurringPayments?: RecurringPayment[];
  appTone?: AppTone;
  categories?: Category[];
  notifications?: NotificationSettings;
  currency?: CurrencyCode;
  householdId?: string | null;
};

export type HouseholdMember = {
  uid: string;
  displayName: string;
  email: string;
  role: 'owner' | 'member';
  joinedAt: string;
};

export type Household = {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  members: HouseholdMember[];
  createdAt: string;
};

export type EarnedBadge = {
  id: string;
  earnedAt: string; // ISO string
};

export type InstallmentPlan = {
  id: string;
  uid: string;
  name: string;
  totalAmount: number;    // إجمالي ما ستدفعه (سعر التقسيط)
  downPayment: number;    // الدفعة الأولى
  months: number;         // عدد الأقساط
  monthlyPayment: number; // القسط الشهري المحسوب
  originalPrice?: number; // السعر النقدي (للمقارنة)
  paymentDay: number;     // يوم الاستحقاق من الشهر (1-28)
  startDate: string;      // تاريخ أول قسط YYYY-MM-DD
  paidCount: number;      // عدد الأقساط المدفوعة
  isCompleted: boolean;
  createdAt: string;
};

export type DebtPayment = {
  amount: number;
  date: string;
};

export type Debt = {
  id: string;
  uid: string;
  name: string;
  amount: number;
  direction: 'to-me' | 'from-me';
  reason?: string;
  date: string;
  dueDate?: string;
  phone?: string;
  isSettled: boolean;
  settledAt?: string;
  paidAmount?: number;
  payments?: DebtPayment[];
  createdAt: string;
};

export type WeddingResponsibility = 'groom' | 'bride' | 'shared';
export type WeddingTier = 'economy' | 'medium' | 'luxury';

// خطة زواج واحدة لكل مستخدم (محفوظة في users/{uid}/wedding/plan)
export type WeddingPlan = {
  amounts: Record<string, number>;                         // المبلغ المخطّط لكل بند
  responsibilities: Record<string, WeddingResponsibility>; // من يدفع كل بند
  disabled: Record<string, boolean>;                       // البنود المُستبعَدة
  guests: number;        // عدد المدعوين (للبوفيه)
  perGuest: number;      // تكلفة الفرد للبوفيه
  budget?: number;       // الميزانية التي رصدها المستخدم (اختيارية — عمود التخطيط)
  tier: WeddingTier | null; // آخر مستوى مُطبَّق
  updatedAt: string;
};

// ═══════════════ سلفتنا — الجمعية الدوارة ═══════════════
// المبدأ الحاكم: المدير قائم بذاته؛ انضمام الأعضاء إثراء اختياري لا يُعطّل أي خاصية.
// المرحلة 1: كل شيء يُدار بالمدير تحت users/{uid}/silftna/{id}

export type SilftnaPeriod = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type SilftnaMethod = 'lottery' | 'registration' | 'manual';
export type SilftnaStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type SilftnaMemberStatus = 'active' | 'late' | 'at-risk' | 'withdrawn' | 'excluded' | 'completed';
export type SilftnaPaymentStatus = 'unpaid' | 'partial' | 'paid';

// عضو في الجمعية (يديره المدير؛ uid اختياري إن انضم بالتطبيق لاحقاً)
export type SilftnaMember = {
  id: string;            // معرّف داخلي ثابت
  name: string;          // مطلوب
  phone?: string;        // لإشعارات واتساب
  shares: number;        // 1 افتراضياً؛ يُرفع في السهم المتعدد
  status: SilftnaMemberStatus;
  uid?: string;          // يُملأ إن انضم العضو بالتطبيق (مستقبلاً)
  note?: string;         // ملاحظة للمدير فقط
};

// دورة في الجدول (خانة استلام واحدة — صاحب الأسهم المتعددة يملك أكثر من خانة)
export type SilftnaCycle = {
  index: number;         // رقم الدورة (1..مجموع الأسهم)
  memberId: string;      // المستلم في هذه الدورة
  amount: number;        // المبلغ المستلَم = القسط × مجموع الأسهم
  date: string;          // تاريخ الاستلام المحسوب (ISO yyyy-mm-dd)
  delivered: boolean;    // هل سُلِّمت السلفة لهذا المستلم؟
  deliveredAt?: string;  // وقت التسليم الدقيق (توثيق)
  signatureUrl?: string; // توقيع المستلم الإلكتروني (إقرار الاستلام)
};

// دفعة عضو في دورة معيّنة
export type SilftnaPayment = {
  memberId: string;
  cycleIndex: number;
  status: SilftnaPaymentStatus;
  paidAmount: number;    // المبلغ المسدَّد فعلاً (للدفع الجزئي)
  method?: string;       // نقدي / تحويل / زين كاش ...
  proofUrl?: string;     // إثبات (مرحلة لاحقة)
  recordedAt: string;
};

export type Silftna = {
  id: string;
  uid: string;           // مالك/مدير الجمعية
  name: string;
  installment: number;   // قيمة القسط الواحد
  currency: string;      // IQD افتراضياً
  period: SilftnaPeriod;
  startDate: string;     // تاريخ أول دفعة (ISO)
  method: SilftnaMethod; // طريقة تحديد الأدوار
  reservePercent: number;// نسبة الصندوق الاحتياطي (0 = معطّل)
  inviteCode?: string;   // لانضمام الأعضاء بالتطبيق لاحقاً
  status: SilftnaStatus;
  members: SilftnaMember[];
  schedule: SilftnaCycle[];     // يُولَّد عند اعتماد الأدوار
  payments: SilftnaPayment[];   // سجل الدفعات
  reserveSpends?: SilftnaReserveSpend[]; // مصروفات الصندوق الاحتياطي
  createdAt: string;
  updatedAt: string;
};

// صرف من الصندوق الاحتياطي
export type SilftnaReserveSpend = {
  id: string;
  amount: number;
  reason: string;
  date: string;
};
