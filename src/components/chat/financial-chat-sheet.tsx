// src/components/chat/financial-chat-sheet.tsx
"use client";

import { useState, useRef, useEffect, useMemo, useCallback, Fragment } from 'react';
import { usePathname } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  Send,
  Loader2,
  X,
  AlertTriangle,
  Info,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
// financialChatAction replaced by direct /api/chat fetch — see handleSend below.
import { format, isThisMonth, parseISO, differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns';
import { useCurrency } from '@/hooks/use-currency';

/* ─────────────────────────────── Types ─────────────────────────────── */

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ProactiveAlert {
  type: 'warning' | 'info' | 'success';
  icon: React.ReactNode;
  message: string;
}

/* ─────────────────────────────── Quick suggestions ─────────────────── */

const BASE_SUGGESTIONS = [
  'كم صرفت هذا الشهر؟',
  'كم تبقى من ميزانيتي؟',
  'قارن هذا الشهر بالشهر الماضي',
  'أين يمكنني توفير أكثر؟',
];
const GOALS_SUGGESTION = 'ما وضع أهدافي؟';

/* ── Lightweight markdown renderer (no extra dependency) ──
   Handles: **bold**, numbered lists, bullet lists, line breaks.
   Used for AI replies only — user messages render as plain text. */
function renderMarkdown(text: string): React.ReactNode {
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((para, pi) => {
    const lines = para.split('\n');
    const isList = lines.every(l => /^(\d+\.\s|\*\s|-\s)/.test(l.trim()) || l.trim() === '');
    if (isList) {
      return (
        <ul key={pi} className="list-none space-y-1 my-1">
          {lines.filter(l => l.trim()).map((line, li) => (
            <li key={li} className="flex gap-1.5 items-start">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span>{inlineBold(line.replace(/^(\d+\.\s|\*\s|-\s)/, ''))}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={pi} className={pi > 0 ? 'mt-2' : undefined}>
        {lines.map((line, li) => (
          <Fragment key={li}>
            {li > 0 && <br />}
            {inlineBold(line)}
          </Fragment>
        ))}
      </p>
    );
  });
}

function inlineBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p);
}

/* ─────────────────────────── Main Component ────────────────────────── */

export function FinancialChatSheet() {
  const { expenses, goals, userSettings, isLoading } = useAppData();
  const hasGoals = goals.length > 0;
  const QUICK_SUGGESTIONS = hasGoals
    ? [...BASE_SUGGESTIONS.slice(0, 3), GOALS_SUGGESTION, BASE_SUGGESTIONS[3]]
    : BASE_SUGGESTIONS;
  const { categoryMap } = useCategories();
  const { format: formatCurrency } = useCurrency();
  const pathname = usePathname();

  // Hide the floating button on data-entry pages and all financial tools pages
  const HIDDEN_PATHS = ['/add-expense', '/add-expense/', '/tools'];
  const isHidden = HIDDEN_PATHS.some(p => pathname === p || pathname?.startsWith(p));

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = sessionStorage.getItem('advisor_messages');
      return saved ? (JSON.parse(saved) as ChatMessage[]) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [alertsDismissed, setAlertsDismissed] = useState(false);

  // Persist conversation across sheet open/close within the same browser session
  useEffect(() => {
    try { sessionStorage.setItem('advisor_messages', JSON.stringify(messages)); } catch { /* quota */ }
  }, [messages]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetContentRef = useRef<HTMLDivElement>(null);

  /* ── Respond to keyboard open/close via visualViewport ── */
  const updateSheetHeight = useCallback(() => {
    const vp = window.visualViewport;
    const vh = vp ? vp.height + vp.offsetTop : window.innerHeight;
    if (sheetContentRef.current) {
      const height = Math.max(vh - 12, 200);
      sheetContentRef.current.style.height = `${height}px`;
      sheetContentRef.current.style.maxHeight = `${height}px`;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // Small delay to let the sheet fully render before measuring
    const t = setTimeout(updateSheetHeight, 50);
    window.visualViewport?.addEventListener('resize', updateSheetHeight);
    return () => {
      clearTimeout(t);
      window.visualViewport?.removeEventListener('resize', updateSheetHeight);
    };
  }, [open, updateSheetHeight]);

  /* ── Auto-scroll to bottom on new message ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  /* ── Do NOT auto-focus on open — prevents keyboard from hiding content ── */

  /* ── Proactive alerts (computed client-side, no AI call) ── */
  const proactiveAlerts = useMemo((): ProactiveAlert[] => {
    if (isLoading || !expenses.length) return [];

    const alerts: ProactiveAlert[] = [];
    const totalBudget = userSettings?.budget?.totalBudget || 0;
    const now = new Date();

    // Current month expenses
    const thisMonthExpenses = expenses.filter(e => {
      try { return isThisMonth(parseISO(e.date)); } catch { return false; }
    });
    const totalSpent = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);
    const usagePercent = totalBudget ? Math.round((totalSpent / totalBudget) * 100) : 0;

    // 1. Budget over 75%
    if (totalBudget && usagePercent >= 75 && usagePercent < 100) {
      alerts.push({
        type: 'warning',
        icon: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
        message: `استهلكت ${usagePercent}% من ميزانيتك هذا الشهر — تبقى ${formatCurrency(totalBudget - totalSpent)} فقط`,
      });
    }

    // 2. Budget exceeded
    if (totalBudget && totalSpent > totalBudget) {
      alerts.push({
        type: 'warning',
        icon: <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />,
        message: `تجاوزت ميزانيتك بمقدار ${formatCurrency(totalSpent - totalBudget)} هذا الشهر`,
      });
    }

    // 3. Days without expense
    const sorted = [...expenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (sorted.length > 0) {
      try {
        const daysSince = differenceInCalendarDays(now, parseISO(sorted[0].date));
        if (daysSince >= 4) {
          alerts.push({
            type: 'info',
            icon: <Info className="h-4 w-4 text-blue-500 shrink-0" />,
            message: `مرّت ${daysSince} أيام بدون تسجيل مصروف — هل هناك مصاريف فائتة؟`,
          });
        }
      } catch { /* ignore */ }
    }

    // 4. Month start — show last month summary (days 1-3)
    if (now.getDate() <= 3 && thisMonthExpenses.length === 0) {
      const lastMonthExpenses = expenses.filter(e => {
        try {
          const d = parseISO(e.date);
          const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const end = new Date(now.getFullYear(), now.getMonth(), 0);
          return d >= last && d <= end;
        } catch { return false; }
      });
      if (lastMonthExpenses.length > 0) {
        const lastTotal = lastMonthExpenses.reduce((s, e) => s + e.amount, 0);
        alerts.push({
          type: 'info',
          icon: <TrendingDown className="h-4 w-4 text-teal-500 shrink-0" />,
          message: `بدأ شهر جديد! أنفقت ${formatCurrency(lastTotal)} الشهر الماضي — اسألني لتلخيص أدائك`,
        });
      }
    }

    return alerts;
  }, [expenses, userSettings, isLoading, formatCurrency]);

  const badgeCount = alertsDismissed ? 0 : proactiveAlerts.length;

  /* ── Compact financial context for AI ── */
  const financialContext = useMemo(() => {
    if (isLoading) return '{}';

    const now = new Date();

    const thisMonthExpenses = expenses.filter(e => {
      try { return isThisMonth(parseISO(e.date)); } catch { return false; }
    });
    const totalSpent = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);
    const totalBudget = userSettings?.budget?.totalBudget || 0;

    // Spending by category name
    const byCategory: Record<string, number> = {};
    thisMonthExpenses.forEach(e => {
      const name = categoryMap[e.category]?.name || e.category;
      byCategory[name] = (byCategory[name] || 0) + e.amount;
    });

    // Previous month — full breakdown by category (not just total)
    const prevMonthExpenses = expenses.filter(e => {
      try {
        const d = parseISO(e.date);
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return d >= start && d <= end;
      } catch { return false; }
    });
    const prevMonthTotal = prevMonthExpenses.reduce((s, e) => s + e.amount, 0);
    const prevByCategory: Record<string, number> = {};
    prevMonthExpenses.forEach(e => {
      const name = categoryMap[e.category]?.name || e.category;
      prevByCategory[name] = (prevByCategory[name] || 0) + e.amount;
    });

    // Recent 10 expenses (increased from 5 for richer context)
    const recent = [...expenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map(e => ({
        title: e.title,
        amount: e.amount,
        category: categoryMap[e.category]?.name || e.category,
        date: e.date.slice(0, 10),
      }));

    // Goals summary
    const goalsSummary = goals.map(g => {
      const monthsLeft = differenceInCalendarMonths(new Date(g.targetDate), now);
      return {
        name: g.name,
        target: g.targetAmount,
        monthsLeft: monthsLeft <= 0 ? 1 : monthsLeft,
        requiredMonthly: Math.round(g.targetAmount / (monthsLeft <= 0 ? 1 : monthsLeft)),
      };
    });

    // Category budgets (named, not by ID) — needed to answer "كم ميزانيتي للأكل؟"
    const categoryBudgetsNamed: Record<string, number> = {};
    Object.entries(userSettings?.categoryBudgets || {}).forEach(([id, amt]) => {
      const name = categoryMap[id]?.name || id;
      categoryBudgetsNamed[name] = amt as number;
    });

    return JSON.stringify({
      currentDate: format(now, 'yyyy-MM-dd'),
      dayOfMonth: now.getDate(),
      monthlyBudget: totalBudget,
      spentThisMonth: totalSpent,
      remainingBudget: totalBudget ? totalBudget - totalSpent : null,
      budgetUsagePercent: totalBudget ? Math.round((totalSpent / totalBudget) * 100) : null,
      categoryBudgets: Object.keys(categoryBudgetsNamed).length ? categoryBudgetsNamed : null,
      previousMonthTotal: prevMonthTotal,
      previousMonthByCategory: Object.keys(prevByCategory).length ? prevByCategory : null,
      monthlyIncome: userSettings?.profile?.monthlyIncome || 0,
      spendingByCategoryThisMonth: byCategory,
      recentExpenses: recent,
      goals: goalsSummary,
    });
  }, [expenses, goals, userSettings, categoryMap, isLoading]);

  /* ── Send message ── */
  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isSending) return;

    const userMsg: ChatMessage = { role: 'user', content };
    const updatedMessages = [...messages, userMsg];

    setMessages(updatedMessages);
    setInput('');
    setIsSending(true);

    try {
      // Use the dedicated /api/chat route instead of a server action so that
      // `export const maxDuration = 60` in route.ts is honoured directly by
      // Vercel — server actions inherit timeout from the layout hierarchy which
      // is unreliable when the closest layout is a Client Component.
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          financialContext,
          appTone: userSettings?.appTone ?? 'formal',
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const result: { ok: boolean; data?: { reply: string }; error?: string } =
        await res.json();

      if (result.ok && result.data?.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.data!.reply }]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'عذرًا، لم أتمكن من الإجابة. حاول مرة أخرى.' },
        ]);
      }
    } catch (err) {
      // Network error, timeout, or any other fetch failure — always unblock UI.
      console.error('[FinancialChat] fetch error:', err);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'انقطع الاتصال. تحقق من الإنترنت وحاول مرة أخرى.' },
      ]);
    } finally {
      // ALWAYS unblock — prevents the UI from freezing in loading state.
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setAlertsDismissed(true); // dismiss badge when opened
  };

  const isEmpty = messages.length === 0;

  const handleClearConversation = () => {
    setMessages([]);
    try { sessionStorage.removeItem('advisor_messages'); } catch { /* ignore */ }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <>
      {/* ── Floating Action Button — not rendered on data-entry pages ── */}
      {!isHidden && (
        <button
          onClick={handleOpen}
          aria-label="مستشار الجيب"
          className={cn(
            // Position — sits just above the nav bar, left side to avoid conflict with any right-side FABs
            'fixed bottom-20 left-4 z-40',
            // Size & shape
            'h-13 w-13 rounded-full shadow-lg',
            // Gold shimmer
            'animate-gold-shimmer',
            // Inner layout
            'flex items-center justify-center',
            // Interaction
            'transition-transform duration-200 active:scale-95',
            // Remove default button styles
            'border-0 outline-none focus-visible:ring-2 focus-visible:ring-yellow-400'
          )}
          style={{ width: 52, height: 52 }}
        >
          <Bot className="h-6 w-6 text-white drop-shadow" strokeWidth={2.2} />

          {/* Badge */}
          {badgeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
              {badgeCount}
            </span>
          )}
        </button>
      )}

      {/* ── Chat Sheet ── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          ref={sheetContentRef}
          side="bottom"
          className="rounded-t-2xl p-0 flex flex-col gap-0"
          style={{ height: '88dvh', maxHeight: '88dvh' }}
        >
          {/* Header */}
          <SheetHeader className="flex-row items-center justify-between px-4 py-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full animate-gold-shimmer shadow">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <SheetTitle className="text-sm font-bold leading-none">مستشار الجيب</SheetTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">اسألني عن مصروفاتك</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Clear conversation — only when there's history */}
              {!isEmpty && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                  onClick={handleClearConversation}
                  disabled={isSending}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  محادثة جديدة
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Messages area */}
          <ScrollArea className="flex-1 px-4 py-3">
            <div className="space-y-3">

              {/* Proactive alerts (shown when no conversation yet) */}
              {!alertsDismissed && proactiveAlerts.length > 0 && (
                <div className="space-y-2 mb-2">
                  {proactiveAlerts.map((alert, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-2 rounded-xl p-3 text-xs',
                        alert.type === 'warning' && 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700',
                        alert.type === 'info' && 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700',
                        alert.type === 'success' && 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700',
                      )}
                    >
                      {alert.icon}
                      <p className="leading-relaxed">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state — welcome + quick suggestions */}
              {isEmpty && (
                <div className="space-y-4">
                  <div className="rounded-2xl rounded-tr-sm bg-muted px-4 py-3 text-xs leading-relaxed max-w-[88%]">
                    مرحبًا! أنا مستشار الجيب 👋 أعرف كل شيء عن مصاريفك وميزانيتك وأهدافك.
                    <br />اسألني بلغتك الطبيعية وسأجيبك فورًا.
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-2 font-medium">اقتراحات سريعة:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {QUICK_SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSend(s)}
                          className="text-[11px] px-3 py-2.5 rounded-xl border border-border bg-background hover:bg-muted transition-colors text-center leading-snug"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Conversation messages */}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-end gap-2',
                    // RTL: user = right side (justify-end), AI = left side (justify-start)
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full animate-gold-shimmer shadow mt-0.5">
                      <Bot className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2.5 text-xs leading-relaxed max-w-[82%]',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    )}
                  >
                    {msg.role === 'assistant'
                      ? renderMarkdown(msg.content)
                      : msg.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isSending && (
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full animate-gold-shimmer shadow">
                    <Bot className="h-3 w-3 text-white" />
                  </div>
                  <div className="rounded-2xl rounded-tr-sm bg-muted px-4 py-2.5">
                    <div className="flex gap-1 items-center h-4">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input bar */}
          <div className="shrink-0 border-t px-4 py-3 flex gap-2 items-center bg-background">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب سؤالك..."
              className="flex-1 h-10 text-sm rounded-full bg-muted border-0 focus-visible:ring-1 focus-visible:ring-primary"
              disabled={isSending}
              dir="rtl"
            />
            <Button
              size="icon"
              className="h-10 w-10 rounded-full shrink-0"
              onClick={() => handleSend()}
              disabled={!input.trim() || isSending}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
