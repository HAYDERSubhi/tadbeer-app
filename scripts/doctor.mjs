#!/usr/bin/env node
/**
 * فاحص تدبير — تشخيص آلي شامل لكامل الكود.
 *
 *   npm run doctor            تقرير كامل
 *   npm run doctor -- --brief خلاصة فقط بلا تفاصيل
 *   npm run doctor -- --json  مخرَج JSON للأتمتة
 *   npm run doctor -- --no-lint  تخطّي lint (الأسرع)
 *   npm run doctor -- --changed  الملفات المعدَّلة فقط (تنظيف تدريجي)
 *
 * ⚠️ الفاحص يقرأ ولا يكتب — لا يعدّل أي ملف ولا يتصل بالشبكة.
 *
 * لماذا يوجد: أعطال هذا المشروع تتكرّر بأنماط ثابتة (اتجاه RTL، صياغة عربية
 * للأعداد، خلط أنواع في مقارنات التواريخ، نسيان المسار المزدوج). كل فحص هنا
 * وُلد من عطل حقيقي حدث فعلاً، لا من قائمة نظرية.
 *
 * الدرجات:
 *   🔴 عطل  — يصل أثره للمستخدم
 *   🟡 يستحق — خطأ حقيقي أثره محدود أو مؤجَّل
 *   🔵 تجميلي — نظافة كود واتساق
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const ARGS = process.argv.slice(2);
const BRIEF = ARGS.includes('--brief');
const AS_JSON = ARGS.includes('--json');
const CHANGED_ONLY = ARGS.includes('--changed');

/**
 * الملفات التي تختلف عمّا هو منشور فعلاً — تشمل غير المدفوع وغير المودَع.
 * فائدتها: بعض المخالفات (خصوصاً الاتجاه) واسعة جداً ولا تستحق حملة تنظيف
 * على تطبيق حيّ، لكنها تستحق التنظيف كلما لُمس الملف لسبب آخر. هذا الوضع
 * يجعل ذلك آلياً بدل الاعتماد على التذكّر.
 */
function changedFiles() {
  const run = cmd => {
    try {
      return execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })
        .split('\n').map(s => s.trim()).filter(Boolean);
    } catch { return null; }
  };
  // مقابل المنشور أولاً؛ وإن تعذّر (لا اتصال/لا مرجع بعيد) فمقابل آخر إيداع.
  const vsRemote = run('git diff --name-only origin/master');
  const vsHead = run('git diff --name-only HEAD') ?? [];
  const untracked = run('git ls-files --others --exclude-standard') ?? [];
  const all = new Set([...(vsRemote ?? []), ...vsHead, ...untracked]);
  return { list: [...all], comparedTo: vsRemote ? 'المنشور (origin/master)' : 'آخر إيداع محلي' };
}

// ملفات مقفلة بقرار صاحب المشروع — تُفحص ويُنبَّه عليها، لكن لا تُعدّ أعطالاً
// تستوجب إصلاحاً. راجع ملفات الذاكرة قبل المساس بها.
const LOCKED = [
  'src/app/(main)/tools/currency/page.tsx',
  'src/app/(main)/tools/worth-it/page.tsx',
  'src/app/(main)/tools/installment/page.tsx',
  'src/app/(main)/tools/habit-cost/page.tsx',
];

const C = {
  red: s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  blue: s => `\x1b[36m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  dim: s => `\x1b[2m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`,
};

/* ── جمع الملفات ─────────────────────────────────────────────────────────── */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const FILES = existsSync(SRC) ? walk(SRC) : [];
const rel = p => relative(ROOT, p).split(sep).join('/');
const ALL_SOURCES = FILES.map(p => ({ path: rel(p), lines: readFileSync(p, 'utf8').split('\n') }));

const changed = CHANGED_ONLY ? changedFiles() : null;
const changedSet = changed ? new Set(changed.list) : null;
const SOURCES = changedSet ? ALL_SOURCES.filter(f => changedSet.has(f.path)) : ALL_SOURCES;
const isLocked = p => LOCKED.includes(p);

/* ── إطار الفحوصات ───────────────────────────────────────────────────────── */
const findings = [];
function add(sev, check, file, line, message, hint) {
  findings.push({ sev, check, file, line, message, hint, locked: isLocked(file) });
}

/**
 * استثناء موثَّق: ضع `doctor-ok: السبب` في تعليق على السطر أو السطر الذي قبله.
 * كل استثناء يبقى مكتوباً في الكود ومقروناً بسببه، فلا يتراكم صمت مجهول.
 */
const OK_MARK = /doctor-ok/;
/** يسري الاستثناء على الكتلة التي يقدّمها التعليق — نرجع للأعلى حتى سطر فارغ. */
function suppressed(lines, i) {
  for (let j = i; j >= 0 && i - j <= 8; j--) {
    if (OK_MARK.test(lines[j])) return true;
    if (j < i && lines[j].trim() === '') break;
  }
  return false;
}

/** سطر تعليق خالص — لا يُنفَّذ، فمطابقته إنذار كاذب دائماً. */
const isComment = t => /^\s*(?:\/\/|\/\*|\*)/.test(t);

/** فحص قائم على تعبير نمطي يمرّ على كل سطر. */
function scan({ id, sev, title, hint, re, files = SOURCES, skip = () => false }) {
  for (const f of files) {
    f.lines.forEach((text, i) => {
      if (isComment(text)) return;
      if (suppressed(f.lines, i)) return;
      if (skip(text, f.path)) return;
      re.lastIndex = 0;
      const m = re.exec(text);
      if (m) add(sev, { id, title }, f.path, i + 1, m[0].trim().slice(0, 90), hint);
    });
  }
}

const TSX = SOURCES.filter(f => f.path.endsWith('.tsx'));

/** مكوّنات shadcn مستوردة كما هي، وتدعم الجانبين عمداً عبر خيار side. */
const VENDORED_SIDE_VARIANTS = ['components/ui/sheet.tsx', 'components/ui/sidebar.tsx'];

/* ══ ١. الاتجاه RTL ═══════════════════════════════════════════════════════ */
// قاعدة CLAUDE.md: الاتجاهات الفيزيائية ممنوعة، البديل المنطقي (ms/me/ps/pe/
// start/end) يتبع اتجاه اللغة تلقائياً. الفيزيائية تعمل «صدفةً» في العربية
// لكنها تنكسر في أي سياق LTR وتخفي نية المطوّر.
scan({
  id: 'rtl-physical',
  sev: 'blue',
  title: 'اتجاه فيزيائي بدل منطقي',
  hint: 'ml-→ms- · mr-→me- · pl-→ps- · pr-→pe- · text-left/right→text-start/end',
  re: /\b(?:ml|mr|pl|pr)-\d|\btext-(?:left|right)\b/,
  files: TSX,
});

// شريط تعبئة يبدأ من اليسار — عطل مرئي مباشر في واجهة عربية (حدث فعلاً).
// ملاحظة دقّة: `left-0 right-0` معاً تعني «العرض الكامل» وهي محايدة الاتجاه
// (شريط التنقّل والبانرات) — تُستثنى، وإلا أغرق الفاحص التقرير بإنذار كاذب.
scan({
  id: 'rtl-bar',
  sev: 'red',
  title: 'عنصر مثبَّت على اليسار أو تعبئة تُزاح فيزيائياً',
  hint: 'التعبئة تبدأ من start-0 بعرض نسبي — لا left-0 ولا translateX سالب',
  re: /\bleft-0\b|translateX\(-\$\{/,
  files: TSX,
  skip: (text, path) =>
    // `left-0 right-0` معاً = عرض كامل، محايد الاتجاه.
    (/\bleft-0\b/.test(text) && /\bright-0\b/.test(text)) ||
    // خرائط الجوانب في مكوّنات shadcn (side="left"/"right") — الجهة الفيزيائية
    // هي الغرض ذاته من الخيار، لا مخالفة.
    /(?:^\s*|[{,(]\s*)(?:left|right|start|end)\s*:/.test(text) ||
    VENDORED_SIDE_VARIANTS.some(v => path.endsWith(v)),
});

/* ══ ٢. الصياغة العربية للأعداد ══════════════════════════════════════════ */
// «2 أيام» و«1 شارة» ليستا عربية. القاعدة: 1 مفرد · 2 مثنّى · 3-10 جمع ·
// 11+ مفرد منصوب. تكرّر هذا العطل أربع مرات في نصوص يراها المستخدم.
scan({
  id: 'ar-plural',
  sev: 'yellow',
  title: 'رقم متغيّر متبوع بجمع ثابت',
  hint: 'استعمل دالة صياغة: 1 مفرد · 2 مثنّى · 3-10 جمع · 11+ مفرد منصوب',
  // ⚠️ لا تستعمل \b بعد حرف عربي — حدّ الكلمة يعرف [A-Za-z0-9_] فقط، فيفشل
  // دائماً بعد العربية ويعطّل الفحص بصمت. البديل: نفي حرف عربي تالٍ.
  re: /\$\{[^}]{1,40}\}\s*(?:أيام|شارات|أشهر|سنوات|مرات|مصاريف|عناصر|أصدقاء|أعضاء|أقساط)(?![؀-ۿ])/,
});

/* ══ ٣. التواريخ ═════════════════════════════════════════════════════════ */
// العطل الجذري لهذه الجلسة: حقل date يُخزَّن Timestamp، ومقارنته بنص ISO
// لا تطابق شيئاً أبداً لأن Firestore يرتّب حسب النوع أولاً.
scan({
  id: 'date-string-query',
  sev: 'red',
  title: 'استعلام Firestore يقارن التاريخ بنص',
  hint: "حقل date مخزَّن Timestamp — مرّر كائن Date لا toISOString()",
  re: /\.where\(\s*['"`]date['"`][^)]*toISOString\(\)/,
});

// مقارنة نص ISO (بتوقيت غرينتش) مع تاريخ محلي تُسقِط مصاريف ما بعد منتصف
// الليل في بغداد (UTC+3) — حدث فعلاً في تذكير التسجيل.
scan({
  id: 'date-string-compare',
  sev: 'yellow',
  title: 'مقارنة تاريخ نصّية قد تتجاهل المنطقة الزمنية',
  hint: 'حوّل أولاً: format(parseISO(iso), "yyyy-MM-dd") ثم قارن',
  re: /\.date\.(?:startsWith|slice)\(|\bdate\.slice\(\s*0\s*,\s*10\s*\)/,
});

// حساب «اليوم» بتوقيت الخادم — خوادم Vercel بتوقيت UTC لا بغداد.
scan({
  id: 'date-server-tz',
  sev: 'yellow',
  title: 'حدود يوم/شهر بتوقيت الخادم لا بغداد',
  hint: 'في كود الخادم استعمل مساعدات lib/push-server (baghdadDayRange…)',
  re: /\b(?:startOfDay|endOfDay|startOfMonth|endOfMonth)\s*\(\s*new Date\(\)\s*\)/,
  files: SOURCES.filter(f => f.path.includes('/api/') || f.path.includes('push-server')),
});

/* ══ ٤. المسار المزدوج (شخصي / عائلي) ═══════════════════════════════════ */
// من ينضم لعائلة تنتقل بياناته إلى households/{id}. أي مسار يفترض
// users/{uid} وحده يفوّت بيانات كل أعضاء العائلة.
scan({
  id: 'dual-path',
  sev: 'red',
  title: 'مسار بيانات يفترض الحساب الشخصي فقط',
  hint: 'مرّر householdId وفرّع المسار — راجع basePath في services/firestore',
  re: /`users\/\$\{[^}]+\}\/(?:expenses|goals|incomes)\b/,
  skip: text => /householdId\s*\?/.test(text), // السطر يفرّع فعلاً
});

// نداء دالة مزدوجة المسار بلا تمرير householdId — شكل ثانٍ من العطل نفسه،
// لا يمسكه الفحص أعلاه لأنه لا يكتب المسار نصّاً بل يُسقِط وسيطاً.
// حدث فعلاً: صفحة الأهداف كانت تحفظ في المسار الشخصي بينما تقرأ من مسار
// العائلة، فيختفي الهدف بلا أي رسالة خطأ (2026-09-03).
scan({
  id: 'dual-path-arg',
  sev: 'red',
  title: 'نداء دالة مزدوجة المسار بلا householdId',
  hint: 'مرّر householdId وسيطاً أخيراً — القراءة تمرّره، فإسقاطه عند الكتابة يفصل المسارين',
  re: /\b(?:addGoal|deleteGoal|updateGoalSavedAmount|addExpense|updateExpense|deleteExpense|addExpensesBatch|deleteExpensesBatch|addIncome|updateIncome|deleteIncome|getGoals|getExpenses|getIncomes)\s*\([^)]*\)/,
  skip: (text, path) =>
    path.endsWith('services/firestore.ts') ||   // ملف التعريف نفسه
    /householdId/.test(text) ||                  // يمرّره فعلاً
    /^\s*(?:import|export)\b/.test(text),        // سطر استيراد/تصدير لا نداء
});

/* ══ ٥. العملة والأرقام ══════════════════════════════════════════════════ */
// المستخدم يستطيع تغيير عملته، وكل الشاشات تحترم اختياره — عدا النصوص التي
// تكتب «د.ع» ثابتة.
scan({
  id: 'hardcoded-currency',
  sev: 'yellow',
  title: 'رمز عملة ثابت بدل عملة المستخدم',
  hint: 'استعمل useCurrency().format في الواجهة أو formatMoney في الخادم',
  re: /['"`][^'"`]*د\.ع(?![؀-ۿ])/, // بلا \b — انظر الملاحظة في فحص الصياغة العربية
  skip: (_t, p) => p.includes('lib/constants') || p.includes('use-currency'),
});

// الأرقام العربية-الهندية (١٢٣) تخالف بقية شاشات التطبيق التي تعرض 123.
scan({
  id: 'arabic-indic',
  sev: 'blue',
  title: 'أرقام عربية-هندية بدل اللاتينية',
  hint: "التطبيق يعرض 125,000 لا ١٢٥٬٠٠٠ — استعمل 'en-US' أو لاحقة -u-nu-latn",
  // ‏-u-nu-latn تُخرج أرقاماً لاتينية مع إبقاء أسماء الأشهر والصباح/المساء
  // بالعربية — مقيسة: ar-IQ ⇒ ٥/٩/٢٠٢٦ · ar-IQ-u-nu-latn ⇒ 5/9/2026.
  // بلا هذا الاستثناء كانت القاعدة ترصد الحلّ الصحيح مخالفةً (2026-09-05).
  re: /toLocaleString\(\s*['"`]ar(?![\w-]*-u-nu-latn)/,
});

/* ══ ٦. نظافة الكود ═════════════════════════════════════════════════════ */
scan({
  id: 'console-log',
  sev: 'blue',
  title: 'console.log متروك في الكود',
  hint: 'احذفه أو حوّله console.error إن كان تشخيصاً مقصوداً',
  re: /(?<!\/\/\s*)\bconsole\.log\(/,
});

scan({
  id: 'todo',
  sev: 'blue',
  title: 'علامة TODO/FIXME',
  hint: 'أنجِزها أو انقلها إلى خارطة الطريق',
  re: /\b(?:TODO|FIXME|HACK|XXX)\b[:\s]/,
});

/* ── فحوصات على مستوى المشروع ────────────────────────────────────────── */
const projectChecks = [];
function project(sev, title, detail, hint) {
  projectChecks.push({ sev, title, detail, hint });
}

/* أخطاء الأنواع — مكبوتة بالبناء، فلا تظهر أبداً بلا فحص صريح. */
let tsErrors = [];
try {
  execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
} catch (e) {
  const out = `${e.stdout || ''}${e.stderr || ''}`;
  tsErrors = out.split('\n').filter(l => /error TS/.test(l) && l.startsWith('src/'));
  // في وضع الملفات المعدَّلة: أخطاء الملفات الأخرى ليست من شغل هذه الجلسة.
  if (changedSet) tsErrors = tsErrors.filter(l => changedSet.has(l.split('(')[0]));
}
if (tsErrors.length) {
  project(
    'yellow',
    `${tsErrors.length} خطأ أنواع في كود التطبيق`,
    tsErrors.slice(0, 12).map(l => '     ' + l.trim()).join('\n'),
    'next.config يكبتها (ignoreBuildErrors) فلا توقف البناء — راجعها واحداً واحداً'
  );
}

/* أداة lint — تكشف فئة لا يكشفها الفحص النصّي (اعتماديات الخطّافات،
 * الوصولية، قواعد React/Next). تُتخطّى بـ --no-lint لأنها الأبطأ. */
const LINT_CONFIGS = ['.eslintrc.json', '.eslintrc.js', '.eslintrc', 'eslint.config.js', 'eslint.config.mjs'];
if (!LINT_CONFIGS.some(f => existsSync(join(ROOT, f)))) {
  project('yellow', 'أداة lint غير مهيّأة',
    '     npm run lint يطلب إعداداً تفاعلياً ولا يعمل',
    'تهيئتها تفتح فئة كاملة من الفحوصات مجاناً');
} else if (!ARGS.includes('--no-lint') && !CHANGED_ONLY) {
  // lint يفحص المشروع كاملاً ولا يقبل قصره على ملفات، فيُتخطّى في وضع
  // الملفات المعدَّلة حتى يبقى الوضع سريعاً ومقصوراً على شغل الجلسة.
  let lintOut = '';
  try {
    lintOut = execSync('npx next lint', { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', timeout: 180000 });
  } catch (e) {
    lintOut = `${e.stdout || ''}${e.stderr || ''}`;
  }
  const lines = lintOut.split('\n');
  const errs = lines.filter(l => /\bError:/.test(l));
  const warns = lines.filter(l => /\bWarning:/.test(l));
  const byRule = arr => {
    const m = new Map();
    for (const l of arr) {
      const r = l.trim().match(/([@a-z][\w@/-]*)\s*$/);
      const k = r ? r[1] : 'أخرى';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `     ${String(n).padStart(4)}  ${k}`).join('\n');
  };
  if (errs.length) {
    project('yellow', `lint: ${errs.length} خطأ`, byRule(errs), 'شغّل npm run lint للتفاصيل مع أرقام الأسطر');
  }
  if (warns.length) {
    project('blue', `lint: ${warns.length} تحذيراً`, byRule(warns), 'شغّل npm run lint للتفاصيل مع أرقام الأسطر');
  }
}

/* مكتبات مثبَّتة بلا استعمال — وزن وسطح هجوم بلا مقابل. */
// ⚠️ يقرأ من ALL_SOURCES لا SOURCES: الفحص طبيعته على مستوى المشروع، وقصره
// على الملفات المعدَّلة يجعله يظنّ كل المكتبات بلا استعمال.
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const allCode = ALL_SOURCES.map(f => f.lines.join('\n')).join('\n');
const IMPLICIT = new Set([ // تُستعمل بلا استيراد مباشر من الكود
  'next', 'react', 'react-dom', 'typescript', 'tailwindcss', 'postcss', 'autoprefixer',
  'tailwindcss-animate', 'eslint', 'eslint-config-next', '@types/node', '@types/react',
  '@types/react-dom', 'dotenv', 'patch-package', 'genkit-cli', 'tsx',
]);
const unused = Object.keys(pkg.dependencies || {}).filter(d =>
  !IMPLICIT.has(d) && !allCode.includes(`'${d}`) && !allCode.includes(`"${d}`) && !allCode.includes(`${d}/`)
);
if (unused.length && !CHANGED_ONLY) {
  project('blue', `${unused.length} مكتبة مثبَّتة بلا استعمال ظاهر`,
    '     ' + unused.join(' · '),
    'تحقّق يدوياً قبل الحذف — قد تُستعمل عبر إعداد لا استيراد');
}

/* حجم الشاشات — من مخرَج آخر بناء إن وُجد. */
const appBuildManifest = join(ROOT, '.next', 'app-build-manifest.json');
if (!existsSync(appBuildManifest) && !CHANGED_ONLY) {
  project('blue', 'لا يوجد بناء حديث لقياس أحجام الشاشات',
    '     شغّل npm run build ثم أعد الفاحص لقياس الأحجام', '');
}

/* ── التقرير ─────────────────────────────────────────────────────────────── */
const SEV = {
  red:    { icon: '🔴', label: 'عطل',    color: C.red },
  yellow: { icon: '🟡', label: 'يستحق',  color: C.yellow },
  blue:   { icon: '🔵', label: 'تجميلي', color: C.blue },
};
const ORDER = ['red', 'yellow', 'blue'];

if (AS_JSON) {
  console.log(JSON.stringify({ findings, projectChecks, scanned: SOURCES.length }, null, 2));
  process.exit(0);
}

const line = '─'.repeat(72);
console.log('');
console.log(C.bold('  فاحص تدبير — تقرير التشخيص'));
console.log(C.dim(`  ${SOURCES.length} ملفاً · ${SOURCES.reduce((n, f) => n + f.lines.length, 0).toLocaleString('en-US')} سطراً · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`));
if (changed) {
  console.log(C.yellow(`  ⟳ الملفات المعدَّلة فقط — مقارنةً بـ${changed.comparedTo}`));
  if (SOURCES.length === 0) console.log(C.green('    لا ملفات معدَّلة داخل src — لا شيء يُفحص.'));
}
console.log(line);

/* فحوصات المشروع أولاً */
if (projectChecks.length) {
  console.log('');
  console.log(C.bold('  على مستوى المشروع'));
  for (const p of projectChecks) {
    const s = SEV[p.sev];
    console.log(`\n  ${s.icon} ${s.color(p.title)}`);
    if (p.detail && !BRIEF) console.log(C.dim(p.detail));
    if (p.hint) console.log(C.dim(`     ↳ ${p.hint}`));
  }
  console.log('');
  console.log(line);
}

/* نتائج المسح مجمّعة حسب الفحص */
const byCheck = new Map();
for (const f of findings) {
  const k = f.check.id;
  if (!byCheck.has(k)) byCheck.set(k, { check: f.check, sev: f.sev, hint: f.hint, items: [] });
  byCheck.get(k).items.push(f);
}
const groups = [...byCheck.values()].sort(
  (a, b) => ORDER.indexOf(a.sev) - ORDER.indexOf(b.sev) || b.items.length - a.items.length
);

for (const g of groups) {
  const s = SEV[g.sev];
  const lockedCount = g.items.filter(i => i.locked).length;
  const active = g.items.length - lockedCount;
  console.log('');
  console.log(`  ${s.icon} ${s.color(C.bold(g.check.title))} ${C.dim(`— ${g.items.length} موضعاً`)}${lockedCount ? C.dim(` (منها ${lockedCount} في ملفات مقفلة)`) : ''}`);
  if (g.hint) console.log(C.dim(`     ↳ ${g.hint}`));

  if (!BRIEF) {
    const byFile = new Map();
    for (const it of g.items) {
      if (!byFile.has(it.file)) byFile.set(it.file, []);
      byFile.get(it.file).push(it);
    }
    const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [file, items] of sorted.slice(0, 8)) {
      const lock = items[0].locked ? C.dim(' [مقفل]') : '';
      const lines = items.slice(0, 3).map(i => i.line).join(',');
      const more = items.length > 3 ? `,+${items.length - 3}` : '';
      console.log(C.dim(`     ${file}:${lines}${more}  (${items.length})${lock}`));
    }
    if (sorted.length > 8) console.log(C.dim(`     … و${sorted.length - 8} ملفاً آخر`));
  }
}

/* الخلاصة */
const count = sev => findings.filter(f => f.sev === sev && !f.locked).length
                   + projectChecks.filter(p => p.sev === sev).length;
const red = count('red'), yellow = count('yellow'), blue = count('blue');

console.log('');
console.log(line);
console.log('');
console.log(C.bold('  الخلاصة'));
console.log(`     🔴 عطل    : ${red === 0 ? C.green('لا شيء') : C.red(red)}`);
console.log(`     🟡 يستحق  : ${yellow === 0 ? C.green('لا شيء') : C.yellow(yellow)}`);
console.log(`     🔵 تجميلي : ${blue === 0 ? C.green('لا شيء') : C.blue(blue)}`);
console.log('');
console.log(C.dim('     الفاحص يشير ولا يحكم — بعض النتائج مقصودة، تُراجَع قبل أي إصلاح.'));
console.log(C.dim('     الملفات المقفلة مستثناة من العدّ (تُعرض للعلم فقط).'));

/* ── تقرير HTML ──────────────────────────────────────────────────────────
 * طرفية ويندوز لا تشكّل العربية ولا تعكس اتجاهها، فتظهر الحروف مقلوبة
 * ومفكّكة — أي أن التقرير النصّي أعلاه غير مقروء لصاحب المشروع أصلاً.
 * لذلك المخرَج الأساسي صفحة تُفتح بالمتصفّح، وسطر المسار وحده لاتيني ليبقى
 * مقروءاً في كل الأحوال. */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SEV_HTML = { red: ['#dc2626', '🔴', 'عطل'], yellow: ['#d97706', '🟡', 'يستحق'], blue: ['#0891b2', '🔵', 'تجميلي'] };

const htmlGroups = groups.map(g => {
  const [color, icon, label] = SEV_HTML[g.sev];
  const byFile = new Map();
  for (const it of g.items) {
    if (!byFile.has(it.file)) byFile.set(it.file, []);
    byFile.get(it.file).push(it);
  }
  const rows = [...byFile.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([file, items]) => `<tr${items[0].locked ? ' class="locked"' : ''}>
        <td class="file">${esc(file)}${items[0].locked ? ' <span class="tag">مقفل</span>' : ''}</td>
        <td class="ln">${items.slice(0, 6).map(i => i.line).join('، ')}${items.length > 6 ? ` +${items.length - 6}` : ''}</td>
        <td class="n">${items.length}</td>
      </tr>`).join('');
  return `<section>
      <h3 style="border-color:${color}"><span>${icon}</span> ${esc(g.check.title)}
        <em>${g.items.length} موضعاً${g.items.filter(i => i.locked).length ? ` — منها ${g.items.filter(i => i.locked).length} في ملفات مقفلة` : ''}</em></h3>
      ${g.hint ? `<p class="hint">${esc(g.hint)}</p>` : ''}
      <div class="scroll"><table><tbody>${rows}</tbody></table></div>
    </section>`;
}).join('');

const htmlProject = projectChecks.map(p => {
  const [color, icon] = SEV_HTML[p.sev];
  return `<section>
      <h3 style="border-color:${color}"><span>${icon}</span> ${esc(p.title)}</h3>
      ${p.detail ? `<pre>${esc(p.detail.replace(/^ {5}/gm, ''))}</pre>` : ''}
      ${p.hint ? `<p class="hint">${esc(p.hint)}</p>` : ''}
    </section>`;
}).join('');

const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>فاحص تدبير — تقرير التشخيص</title>
<style>
  :root{--bg:#f7f8fa;--card:#fff;--tx:#111827;--mut:#6b7280;--line:#e5e7eb}
  @media(prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#171a21;--tx:#e5e7eb;--mut:#9ca3af;--line:#2b3039}}
  *{box-sizing:border-box}
  body{margin:0;padding:24px 16px;background:var(--bg);color:var(--tx);
       font:15px/1.7 "Segoe UI","Noto Naskh Arabic",system-ui,sans-serif}
  .wrap{max-width:860px;margin:0 auto}
  h1{font-size:22px;margin:0 0 4px}
  .meta{color:var(--mut);font-size:13px;margin-bottom:22px}
  .score{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:26px}
  .score div{flex:1;min-width:150px;background:var(--card);border:1px solid var(--line);
             border-radius:14px;padding:14px 16px}
  .score b{display:block;font-size:26px;line-height:1.2}
  .score span{color:var(--mut);font-size:13px}
  section{background:var(--card);border:1px solid var(--line);border-radius:14px;
          padding:14px 16px;margin-bottom:14px}
  h3{margin:0 0 6px;font-size:16px;border-right:4px solid;padding-right:10px;
     display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  h3 em{font-style:normal;font-weight:400;color:var(--mut);font-size:13px}
  .hint{margin:6px 0 10px;color:var(--mut);font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td{padding:5px 8px;border-top:1px solid var(--line);vertical-align:top}
  .scroll{overflow-x:auto}
  .file{font-family:ui-monospace,Consolas,monospace;direction:ltr;text-align:start;white-space:nowrap}
  .ln{color:var(--mut);direction:ltr;text-align:start;white-space:nowrap}
  .n{text-align:end;color:var(--mut);white-space:nowrap}
  tr.locked{opacity:.55}
  .tag{background:var(--line);border-radius:6px;padding:1px 6px;font-size:11px;font-family:inherit}
  pre{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px;
      overflow-x:auto;direction:ltr;text-align:start;font-size:12px;margin:6px 0}
  footer{color:var(--mut);font-size:12px;margin-top:22px;line-height:2}
</style>
<div class="wrap">
  <h1>فاحص تدبير — تقرير التشخيص</h1>
  <div class="meta">${changed ? "⟳ الملفات المعدَّلة فقط · " : ""}${SOURCES.length} ملفاً · ${SOURCES.reduce((n, f) => n + f.lines.length, 0).toLocaleString('en-US')} سطراً · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}</div>
  <div class="score">
    <div><b style="color:${SEV_HTML.red[0]}">${red || '—'}</b><span>🔴 عطل يصل أثره للمستخدم</span></div>
    <div><b style="color:${SEV_HTML.yellow[0]}">${yellow || '—'}</b><span>🟡 يستحق الإصلاح</span></div>
    <div><b style="color:${SEV_HTML.blue[0]}">${blue || '—'}</b><span>🔵 تجميلي</span></div>
  </div>
  ${htmlProject ? `<h2 style="font-size:15px;color:var(--mut);margin:0 0 10px">على مستوى المشروع</h2>${htmlProject}` : ''}
  ${htmlGroups ? `<h2 style="font-size:15px;color:var(--mut);margin:22px 0 10px">نتائج المسح</h2>${htmlGroups}` : ''}
  <footer>
    الفاحص يشير ولا يحكم — بعض النتائج مقصودة، تُراجَع قبل أي إصلاح.<br>
    الملفات المقفلة مستثناة من العدّ وتُعرض للعلم فقط.<br>
    لاستثناء موضع بعينه: ضع تعليق <code>doctor-ok: السبب</code> فوقه في الكود.
  </footer>
</div>`;

const REPORT = join(ROOT, 'doctor-report.html');
writeFileSync(REPORT, html, 'utf8');
console.log('');
console.log(C.bold(`  >> ${REPORT}`));
console.log(C.dim('     ^ open this file in your browser (terminals cannot render Arabic)'));
console.log('');

// دائماً 0 — الفاحص أداة تشخيص لا بوّابة نشر، فلا يوقف أي عملية.
process.exit(0);
