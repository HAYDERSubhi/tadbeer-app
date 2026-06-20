'use client';

import Link from 'next/link';

const TOOLS = [
  {
    href: '/tools/currency',
    label: 'حاسبة العملات',
    sub: 'IQD · USD · AED · SAR',
    icon: null,
    image: '/tools/currency.png',
    gradient: 'linear-gradient(135deg, #60b8ff 0%, #1a6fd4 100%)',
    shimmer: 'linear-gradient(135deg, #7ecfff 0%, #3080e8 100%)',
  },
  {
    href: '/tools/worth-it',
    label: 'هل يستحق؟',
    sub: 'أيام العمل والنسب',
    icon: '⚡',
    image: '/tools/worth-it.png',
    gradient: 'linear-gradient(135deg, #b47fff 0%, #5b21b6 100%)',
    shimmer: 'linear-gradient(135deg, #c99fff 0%, #7034d0 100%)',
  },
  {
    href: '/tools/installment',
    label: 'أقساطي',
    sub: 'نقد أم تقسيط؟',
    icon: '📊',
    image: '/tools/installment.png',
    gradient: 'linear-gradient(135deg, #38bdf8 0%, #0369a1 100%)',
    shimmer: 'linear-gradient(135deg, #56d0ff 0%, #1580c0 100%)',
  },
  {
    href: '/tools/habit-cost',
    label: 'كم تكلفني عاداتي؟',
    sub: 'شهري · سنوي · 5 سنوات',
    icon: '☕',
    image: '/tools/habit-cost.png',
    gradient: 'linear-gradient(135deg, #facc15 0%, #b45309 100%)',
    shimmer: 'linear-gradient(135deg, #fde047 0%, #ca6a10 100%)',
  },
  {
    href: '/tools/wedding',
    label: 'حاسبة زواجي',
    sub: 'توزيع الميزانية',
    icon: '💍',
    image: '/tools/wedding.png',
    gradient: 'linear-gradient(135deg, #f472b6 0%, #9d174d 100%)',
    shimmer: 'linear-gradient(135deg, #f990cb 0%, #b52060 100%)',
  },
  {
    href: '/tools/debts',
    label: 'دفتر الديون',
    sub: 'لك وعليك',
    icon: '🤝',
    image: '/tools/debts.png',
    gradient: 'linear-gradient(135deg, #fb923c 0%, #b45309 100%)',
    shimmer: 'linear-gradient(135deg, #ffa55a 0%, #ca6a10 100%)',
  },
  {
    href: '/tools/silftna',
    label: 'سلفتنا',
    sub: 'السلف الدوّارة',
    icon: '🔄',
    image: '/tools/silftna.png',
    gradient: 'linear-gradient(135deg, #2dd4bf 0%, #0d9488 100%)',
    shimmer: 'linear-gradient(135deg, #5eead4 0%, #14b8a6 100%)',
  },
];

export default function ToolsPage() {
  return (
    <div className="pb-24">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">الأدوات المالية</h1>
        <p className="text-sm text-muted-foreground mt-1">أدوات سريعة لقرارات أذكى</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TOOLS.map(tool => (
          <Link
            key={tool.href}
            href={tool.href}
            className="block active:scale-[0.97] transition-transform"
          >
            <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center text-center gap-3 min-h-[160px] justify-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl select-none overflow-hidden"
                style={{ background: tool.image ? 'transparent' : tool.gradient }}
              >
                {tool.image ? (
                  <img src={tool.image} alt={tool.label} className="w-full h-full object-contain scale-[1.35]" />
                ) : (
                  <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
                    {tool.icon}
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground leading-tight">{tool.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tool.sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
