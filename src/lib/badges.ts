// src/lib/badges.ts

export type BadgeId =
  | 'first_expense'   // أول مصروف
  | 'week_logger'     // 7 أيام متتالية بتسجيل
  | 'month_saver'     // أنهى شهراً تحت الميزانية
  | 'zero_day'        // يوم كامل بدون مصاريف
  | 'family_leader'   // أنشأ/انضم لحساب عائلي
  | 'report_viewer'   // فتح التقرير الشهري
  | 'big_saver'       // وفّر 20%+ من الميزانية
  | 'social_pro';     // دعا 3 أصدقاء أو أكثر

export type BadgeDef = {
  id: BadgeId;
  name: string;
  description: string;
  icon: string;
  color: string; // tailwind bg color
  textColor: string;
};

export const BADGES: BadgeDef[] = [
  {
    id: 'first_expense',
    name: 'الخطوة الأولى',
    description: 'سجّلت أول مصروف في تدبير',
    icon: '🥇',
    color: 'bg-amber-100 dark:bg-amber-900/30',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  {
    id: 'week_logger',
    name: 'مستمر لاسبوع',
    description: 'سجّلت مصاريفك 7 أيام متتالية',
    icon: '🔥',
    color: 'bg-orange-100 dark:bg-orange-900/30',
    textColor: 'text-orange-700 dark:text-orange-300',
  },
  {
    id: 'month_saver',
    name: 'موفّر الشهر',
    description: 'أنهيت شهراً كاملاً ضمن الميزانية',
    icon: '💰',
    color: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
  },
  {
    id: 'zero_day',
    name: 'يوم الصفر',
    description: 'مررت بيوم كامل بدون أي مصروف',
    icon: '🎯',
    color: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
  },
  {
    id: 'family_leader',
    name: 'قائد العائلة',
    description: 'أنشأت أو انضممت لحساب عائلي',
    icon: '👨‍👩‍👧',
    color: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-700 dark:text-purple-300',
  },
  {
    id: 'report_viewer',
    name: 'محلّل ذكي',
    description: 'فتحت التقرير الشهري',
    icon: '📊',
    color: 'bg-indigo-100 dark:bg-indigo-900/30',
    textColor: 'text-indigo-700 dark:text-indigo-300',
  },
  {
    id: 'big_saver',
    name: 'موفر كبير',
    description: 'وفّرت 20% أو أكثر من ميزانيتك في شهر واحد',
    icon: '💎',
    color: 'bg-cyan-100 dark:bg-cyan-900/30',
    textColor: 'text-cyan-700 dark:text-cyan-300',
  },
  {
    id: 'social_pro',
    name: 'ناشر تدبير',
    description: 'دعوت 3 أصدقاء لاستخدام تدبير',
    icon: '🌟',
    color: 'bg-yellow-100 dark:bg-yellow-900/30',
    textColor: 'text-yellow-700 dark:text-yellow-300',
  },
];

export const getBadgeDef = (id: BadgeId): BadgeDef | undefined =>
  BADGES.find(b => b.id === id);
