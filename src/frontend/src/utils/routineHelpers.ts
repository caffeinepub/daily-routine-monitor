import type { DailyRoutineStatus, Routine } from "../backend.d";

export type RoutineGroup =
  | "overdue"
  | "due-soon"
  | "upcoming"
  | "completed"
  | "skipped";

/** Format today's date as YYYY-MM-DD */
export function getTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse HH:MM to today's Date object */
export function parseTimeToday(timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

/** Classify a routine based on scheduled time and status */
export function classifyRoutine(
  item: DailyRoutineStatus,
  now: Date,
): RoutineGroup {
  if (item.status === "completed") return "completed";
  if (item.status === "skipped") return "skipped";

  const scheduledTime = parseTimeToday(item.routine.scheduledTime);
  const diffMs = scheduledTime.getTime() - now.getTime();
  const diffMin = diffMs / 60000;

  if (diffMin < -5) return "overdue"; // more than 5 min past
  if (diffMin <= 30) return "due-soon"; // within next 30 min or slightly past
  return "upcoming";
}

/** Day of week labels */
export const DAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;
export const DAY_LABELS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Format repeat days as a readable string */
export function formatRepeatDays(days: bigint[]): string {
  if (days.length === 0) return "No days";
  const nums = days.map(Number).sort();
  if (nums.length === 7) return "Every day";
  if (nums.join(",") === "1,2,3,4,5") return "Weekdays";
  if (nums.join(",") === "0,6") return "Weekends";
  if (nums.join(",") === "1,3,5") return "Mon / Wed / Fri";
  if (nums.join(",") === "2,4") return "Tue / Thu";
  return nums.map((n) => DAY_LABELS[n]).join(" / ");
}

/** Format HH:MM to 12-hour with AM/PM */
export function formatTime12h(timeStr: string): string {
  const [hStr, mStr] = timeStr.split(":");
  const h = Number.parseInt(hStr ?? "0", 10);
  const m = mStr ?? "00";
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${period}`;
}

/** Format date string as "Tuesday, March 3, 2026" */
export function formatDateFull(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Format timestamp (bigint nanoseconds) to readable date+time */
export function formatTimestamp(ts: bigint): string {
  const ms = Number(ts / 1_000_000n);
  const date = new Date(ms);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Format log date string */
export function formatLogDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Calculate streak: consecutive days completed (most recent first) */
export function calculateStreak(
  logs: { date: string; status: string }[],
): number {
  const completedDates = new Set(
    logs.filter((l) => l.status === "completed").map((l) => l.date),
  );

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const dateStr = checkDate.toISOString().split("T")[0];
    if (completedDates.has(dateStr)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ─── Frequency Metadata Helpers ───────────────────────────────────────────────

const FREQ_PREFIX_RE = /^__freq:(\{.*?\})__/;
const CAT_PREFIX_RE = /__cat:([^_]*)__/;

/** Parse the __freq:{...}__ prefix from description */
export function parseFrequencyMeta(
  description: string,
): { count: number; period: "week" | "month" } | null {
  const match = FREQ_PREFIX_RE.exec(description);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]!) as {
      count: number;
      period: "week" | "month";
    };
    if (
      typeof parsed.count === "number" &&
      (parsed.period === "week" || parsed.period === "month")
    ) {
      return parsed;
    }
  } catch {
    // invalid JSON
  }
  return null;
}

/** Strip the __freq:{...}__ prefix from a description string */
export function stripFrequencyMeta(description: string): string {
  return description.replace(FREQ_PREFIX_RE, "");
}

/** Encode frequency metadata into the description */
export function encodeFrequencyMeta(
  count: number,
  period: "week" | "month",
  userDesc: string,
): string {
  return `__freq:${JSON.stringify({ count, period })}__${userDesc}`;
}

// ─── Category Metadata Helpers ─────────────────────────────────────────────────

/**
 * Parses __cat:CategoryName__ from a description string.
 * Returns the category name, or null if not present.
 */
export function parseCategoryMeta(description: string): string | null {
  const match = CAT_PREFIX_RE.exec(description);
  if (!match) return null;
  const name = match[1]?.trim();
  return name && name.length > 0 ? name : null;
}

/** Strips __cat:...__ from description */
export function stripCategoryMeta(description: string): string {
  return description.replace(CAT_PREFIX_RE, "");
}

/**
 * Encodes category into description.
 * Preserves existing __freq:...__ prefix if present.
 * Inserts __cat:Name__ right after the freq prefix (if any), before user text.
 * If category is empty/falsy, strips any existing __cat:...__ and returns description unchanged.
 */
export function encodeCategoryMeta(
  category: string,
  description: string,
): string {
  // First strip any existing cat meta from description
  const withoutCat = stripCategoryMeta(description);

  if (!category.trim()) {
    return withoutCat;
  }

  const catTag = `__cat:${category.trim()}__`;
  const freqMatch = FREQ_PREFIX_RE.exec(withoutCat);

  if (freqMatch) {
    // Insert after the freq prefix
    const freqTag = freqMatch[0];
    const rest = withoutCat.slice(freqTag.length);
    return `${freqTag}${catTag}${rest}`;
  }

  // No freq prefix — prepend cat tag
  return `${catTag}${withoutCat}`;
}

/**
 * Returns clean user-visible description
 * (strips both __freq:...__ and __cat:...__ meta prefixes).
 */
export function getCleanDescription(description: string): string {
  return stripCategoryMeta(stripFrequencyMeta(description));
}

/** Returns true if this routine uses flexible frequency scheduling */
export function isFrequencyRoutine(routine: Routine): boolean {
  if (parseFrequencyMeta(routine.description) === null) return false;
  // Also confirm all 7 days are set
  const nums = routine.repeatDays.map(Number).sort();
  return nums.join(",") === "0,1,2,3,4,5,6";
}

/** Returns true if this routine is scheduled every single day.
 *  - Specific-days mode: all 7 days selected (0–6)
 *  - Flexible-frequency mode: 7× per week
 */
export function isDailyRoutine(routine: Routine): boolean {
  const freqMeta = parseFrequencyMeta(routine.description);
  if (freqMeta !== null) {
    // Flexible frequency: daily only if 7× per week
    return freqMeta.period === "week" && freqMeta.count === 7;
  }
  // Specific days: daily only if all 7 days selected
  const nums = routine.repeatDays.map(Number).sort();
  return nums.join(",") === "0,1,2,3,4,5,6";
}

/** Format frequency as a readable label */
export function formatFrequencyLabel(
  count: number,
  period: "week" | "month",
): string {
  if (period === "week" && count === 7) return "Daily";
  if (period === "week" && count === 1) return "1× per week";
  if (period === "month" && count === 1) return "1× per month";
  return `${count}× per ${period}`;
}

/** Get start of current week (Monday) as YYYY-MM-DD */
export function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0]!;
}

export type WeekStartMode =
  | "rolling7" // past 7 days
  | "sun" // Sunday–Saturday (day 0)
  | "mon" // Monday–Sunday (day 1) — default
  | "tue" // Tuesday–Monday (day 2)
  | "wed" // Wednesday–Tuesday (day 3)
  | "thu" // Thursday–Wednesday (day 4)
  | "fri" // Friday–Thursday (day 5)
  | "sat"; // Saturday–Friday (day 6)

export const WEEK_MODE_LABELS: Record<WeekStartMode, string> = {
  rolling7: "Past 7 days (rolling)",
  sun: "Sunday – Saturday",
  mon: "Monday – Sunday",
  tue: "Tuesday – Monday",
  wed: "Wednesday – Tuesday",
  thu: "Thursday – Wednesday",
  fri: "Friday – Thursday",
  sat: "Saturday – Friday",
};

/** Get the start of the current week as YYYY-MM-DD based on the chosen mode */
export function getWeekStartWithMode(mode: WeekStartMode): string {
  const now = new Date();
  if (mode === "rolling7") {
    const d = new Date(now);
    d.setDate(now.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0]!;
  }
  const startDayMap: Record<WeekStartMode, number> = {
    rolling7: 1,
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  const startDay = startDayMap[mode];
  const todayDay = now.getDay(); // 0=Sun
  let diff = todayDay - startDay;
  if (diff < 0) diff += 7;
  const d = new Date(now);
  d.setDate(now.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0]!;
}

/** Get start of current month as YYYY-MM-DD */
export function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Count completed logs in the current week or month */
export function countCompletionsInPeriod(
  logs: { date: string; status: string }[],
  period: "week" | "month",
  weekStartOverride?: string,
): number {
  const periodStart =
    period === "week" ? (weekStartOverride ?? getWeekStart()) : getMonthStart();
  return logs.filter((l) => l.status === "completed" && l.date >= periodStart)
    .length;
}

/** Returns array of YYYY-MM-DD strings for the 7 days starting from weekStart */
export function getWeekDates(weekStart: string): string[] {
  const dates: string[] = [];
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(y!, (m ?? 1) - 1, d!);
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    dates.push(dt.toISOString().split("T")[0]!);
  }
  return dates;
}

/** Returns 0–6 day-of-week for a YYYY-MM-DD date string (0=Sun) */
export function getDayOfWeekForDate(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d!).getDay();
}

/** Count how many fixed-day routines are scheduled on a specific date */
export function countPlannedForDate(
  routines: Routine[],
  dateStr: string,
): number {
  const dow = getDayOfWeekForDate(dateStr);
  return routines.filter(
    (r) => !isFrequencyRoutine(r) && r.repeatDays.map(Number).includes(dow),
  ).length;
}

// ─── Category Weight Storage ───────────────────────────────────────────────────

export interface CategoryWeight {
  name: string;
  weight: number; // 0–100
}

const CATEGORY_WEIGHTS_KEY = "drm_category_weights";
const CATEGORIES_KEY = "drm_categories";

/**
 * Load category weights from localStorage.
 * Migrates from a plain string[] (drm_categories) if needed,
 * assigning equal weights that sum to 100.
 */
export function loadCategoryWeights(): CategoryWeight[] {
  try {
    const raw = localStorage.getItem(CATEGORY_WEIGHTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.every(
          (x): x is CategoryWeight =>
            typeof x === "object" &&
            x !== null &&
            typeof (x as Record<string, unknown>).name === "string" &&
            typeof (x as Record<string, unknown>).weight === "number",
        )
      ) {
        return parsed;
      }
    }
  } catch {
    // fall through to migration
  }

  // Migration from plain string[] in drm_categories
  try {
    const catRaw = localStorage.getItem(CATEGORIES_KEY);
    if (catRaw) {
      const cats = JSON.parse(catRaw) as unknown;
      if (Array.isArray(cats) && cats.length > 0) {
        const names = (cats as unknown[]).filter(
          (x): x is string => typeof x === "string",
        );
        if (names.length > 0) {
          return distributeEqualWeights(names);
        }
      }
    }
  } catch {
    // ignore
  }

  return [];
}

export function saveCategoryWeights(cats: CategoryWeight[]): void {
  localStorage.setItem(CATEGORY_WEIGHTS_KEY, JSON.stringify(cats));
}

/** Auto-distribute equal weights across n categories, with remainder on last */
export function distributeEqualWeights(names: string[]): CategoryWeight[] {
  if (names.length === 0) return [];
  const base = Math.floor(100 / names.length);
  const remainder = 100 - base * names.length;
  return names.map((name, i) => ({
    name,
    weight: i === names.length - 1 ? base + remainder : base,
  }));
}

// ─── Weighted Success Rate Calculations ───────────────────────────────────────

/**
 * Returns all fixed-day routines in a specific category that are planned for a
 * given date (dateStr: YYYY-MM-DD).
 */
export function getCategoryTasksForDate(
  routines: Routine[],
  categoryName: string,
  dateStr: string,
): Routine[] {
  const dow = getDayOfWeekForDate(dateStr);
  return routines.filter((r) => {
    if (isFrequencyRoutine(r)) return false;
    const cat = parseCategoryMeta(r.description) ?? "Uncategorised";
    if (cat !== categoryName) return false;
    return r.repeatDays.map(Number).includes(dow);
  });
}

/**
 * Returns all fixed-day routines in a specific category that are planned for
 * any day in the given week.
 */
export function getCategoryTasksForWeek(
  routines: Routine[],
  categoryName: string,
  weekDates: string[],
): Array<{ routine: Routine; dateStr: string }> {
  const result: Array<{ routine: Routine; dateStr: string }> = [];
  for (const dateStr of weekDates) {
    const dayRoutines = getCategoryTasksForDate(
      routines,
      categoryName,
      dateStr,
    );
    for (const r of dayRoutines) {
      result.push({ routine: r, dateStr });
    }
  }
  return result;
}

export interface RateResult {
  completions: number;
  planned: number;
  rate: number | null;
}

/**
 * Compute the success rate for a specific category.
 * scope='day': only looks at dateOrDates as a single date string
 * scope='week': looks at dateOrDates as an array of week date strings (up to today)
 */
export function computeCategoryRate(
  routines: Routine[],
  logs: Array<{ date: string; status: string; routineId?: string }>,
  categoryName: string,
  scope: "day" | "week",
  dateOrDates: string | string[],
  today: string,
): RateResult {
  const dates =
    scope === "day"
      ? [dateOrDates as string]
      : (dateOrDates as string[]).filter((d) => d <= today);

  let planned = 0;
  const completedSet = new Set<string>(); // "routineId:date"

  for (const dateStr of dates) {
    const dayRoutines = getCategoryTasksForDate(
      routines,
      categoryName,
      dateStr,
    );
    planned += dayRoutines.length;
    for (const r of dayRoutines) {
      const key = `${r.id.toString()}:${dateStr}`;
      completedSet.add(`__check__${key}`);
    }
  }

  // Count completions from logs
  let completions = 0;
  for (const log of logs) {
    if (log.status !== "completed") continue;
    if (!dates.includes(log.date)) continue;
    // Find if this log belongs to a routine in this category
    const routine = routines.find(
      (r) => r.id.toString() === (log as { routineId?: string }).routineId,
    );
    if (!routine) continue;
    if (isFrequencyRoutine(routine)) continue;
    const cat = parseCategoryMeta(routine.description) ?? "Uncategorised";
    if (cat !== categoryName) continue;
    const dow = getDayOfWeekForDate(log.date);
    if (!routine.repeatDays.map(Number).includes(dow)) continue;
    completions++;
  }

  if (planned === 0) return { completions: 0, planned: 0, rate: null };
  return {
    completions,
    planned,
    rate: Math.round((completions / planned) * 100),
  };
}

/**
 * Flat log format that includes a routineId field for matching.
 */
export interface FlatLog {
  date: string;
  status: string;
  routineId: string;
}

/**
 * Convert RoutineLog[] (from backend, with bigint routineId) to FlatLog[].
 */
export function toFlatLogs(
  logs: Array<{ date: string; status: string; routineId: bigint }>,
): FlatLog[] {
  return logs.map((l) => ({
    date: l.date,
    status: l.status,
    routineId: l.routineId.toString(),
  }));
}

/**
 * Compute weighted average success rate for all categories.
 * Categories with no planned tasks in the period are excluded from the average.
 * Returns null if no categories have any planned tasks.
 */
export function computeWeightedRate(
  routines: Routine[],
  logs: FlatLog[],
  categoryWeights: CategoryWeight[],
  scope: "day" | "week",
  dateOrDates: string | string[],
  today: string,
): number | null {
  if (categoryWeights.length === 0) return null;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const cw of categoryWeights) {
    const result = computeCategoryRate(
      routines,
      logs,
      cw.name,
      scope,
      dateOrDates,
      today,
    );
    if (result.planned === 0) continue;
    weightedSum += cw.weight * (result.rate ?? 0);
    totalWeight += cw.weight;
  }

  if (totalWeight === 0) return null;
  return Math.round(weightedSum / totalWeight);
}

/**
 * Compute daily weighted rates for each day in the current week.
 */
export function computeDailyWeightedRatesForWeek(
  routines: Routine[],
  logs: FlatLog[],
  categoryWeights: CategoryWeight[],
  weekDates: string[],
  today: string,
): Array<{ dateStr: string; rate: number | null }> {
  return weekDates.map((dateStr) => {
    if (dateStr > today) return { dateStr, rate: null };
    const rate = computeWeightedRate(
      routines,
      logs,
      categoryWeights,
      "day",
      dateStr,
      today,
    );
    return { dateStr, rate };
  });
}

/**
 * Compute per-category rates for the current week.
 */
export function computeCategoryWeeklyRates(
  routines: Routine[],
  logs: FlatLog[],
  categoryWeights: CategoryWeight[],
  weekDates: string[],
  today: string,
): Array<{
  name: string;
  weight: number;
  completions: number;
  planned: number;
  rate: number | null;
}> {
  const pastDates = weekDates.filter((d) => d <= today);
  return categoryWeights.map((cw) => {
    const result = computeCategoryRate(
      routines,
      logs,
      cw.name,
      "week",
      pastDates,
      today,
    );
    return {
      name: cw.name,
      weight: cw.weight,
      completions: result.completions,
      planned: result.planned,
      rate: result.rate,
    };
  });
}

/**
 * Compute per-task rates for a category for the current week.
 */
export function computeTaskWeeklyRates(
  routines: Routine[],
  logs: FlatLog[],
  categoryName: string,
  weekDates: string[],
  today: string,
): Array<{
  routine: Routine;
  completions: number;
  planned: number;
  rate: number | null;
}> {
  const pastDates = weekDates.filter((d) => d <= today);
  const categoryRoutines = routines.filter((r) => {
    if (isFrequencyRoutine(r)) return false;
    const cat = parseCategoryMeta(r.description) ?? "Uncategorised";
    return cat === categoryName;
  });

  return categoryRoutines.map((routine) => {
    let planned = 0;
    let completions = 0;
    for (const dateStr of pastDates) {
      const dow = getDayOfWeekForDate(dateStr);
      if (!routine.repeatDays.map(Number).includes(dow)) continue;
      planned++;
      const completed = logs.some(
        (l) =>
          l.routineId === routine.id.toString() &&
          l.date === dateStr &&
          l.status === "completed",
      );
      if (completed) completions++;
    }
    const rate =
      planned === 0 ? null : Math.round((completions / planned) * 100);
    return { routine, completions, planned, rate };
  });
}

/**
 * Compute the weighted success rate for each of the past N weeks.
 */
export function computePastNWeeksWeightedRates(
  routines: Routine[],
  logs: FlatLog[],
  categoryWeights: CategoryWeight[],
  weekMode: WeekStartMode,
  n: number,
): Array<{ weekLabel: string; weekStart: string; rate: number | null }> {
  const results: Array<{
    weekLabel: string;
    weekStart: string;
    rate: number | null;
  }> = [];

  const today = getTodayString();
  const currentWeekStart = getWeekStartWithMode(weekMode);

  for (let i = n - 1; i >= 0; i--) {
    // Compute the start of the week i weeks ago
    const [cy, cm, cd] = currentWeekStart.split("-").map(Number);
    const startDate = new Date(cy!, (cm ?? 1) - 1, cd!);
    startDate.setDate(startDate.getDate() - i * 7);
    const weekStart = startDate.toISOString().split("T")[0]!;

    // Get the 7 dates for this week
    const weekDates = getWeekDates(weekStart);
    const pastDates = weekDates.filter((d) => d <= today);

    const rate =
      pastDates.length > 0
        ? computeWeightedRate(
            routines,
            logs,
            categoryWeights,
            "week",
            pastDates,
            today,
          )
        : null;

    // Format week label as "MMM DD"
    const [wy, wm, wd] = weekStart.split("-").map(Number);
    const labelDate = new Date(wy!, (wm ?? 1) - 1, wd!);
    const weekLabel = labelDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    results.push({ weekLabel, weekStart, rate });
  }

  return results;
}

/**
 * Compute per-category rates for the past N weeks (for Level 2 category charts).
 */
export function computeCategoryPastNWeeksRates(
  routines: Routine[],
  logs: FlatLog[],
  categoryName: string,
  weekMode: WeekStartMode,
  n: number,
): Array<{ weekLabel: string; weekStart: string; rate: number | null }> {
  const results: Array<{
    weekLabel: string;
    weekStart: string;
    rate: number | null;
  }> = [];

  const today = getTodayString();
  const currentWeekStart = getWeekStartWithMode(weekMode);

  for (let i = n - 1; i >= 0; i--) {
    const [cy, cm, cd] = currentWeekStart.split("-").map(Number);
    const startDate = new Date(cy!, (cm ?? 1) - 1, cd!);
    startDate.setDate(startDate.getDate() - i * 7);
    const weekStart = startDate.toISOString().split("T")[0]!;

    const weekDates = getWeekDates(weekStart);
    const pastDates = weekDates.filter((d) => d <= today);

    const result =
      pastDates.length > 0
        ? computeCategoryRate(
            routines,
            logs,
            categoryName,
            "week",
            pastDates,
            today,
          )
        : { completions: 0, planned: 0, rate: null };

    const [wy, wm, wd] = weekStart.split("-").map(Number);
    const labelDate = new Date(wy!, (wm ?? 1) - 1, wd!);
    const weekLabel = labelDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    results.push({ weekLabel, weekStart, rate: result.rate });
  }

  return results;
}

/** Group daily routines into categories */
export function groupRoutines(items: DailyRoutineStatus[], now: Date) {
  const groups: Record<RoutineGroup, DailyRoutineStatus[]> = {
    overdue: [],
    "due-soon": [],
    upcoming: [],
    completed: [],
    skipped: [],
  };

  for (const item of items) {
    const group = classifyRoutine(item, now);
    groups[group].push(item);
  }

  // Sort each group by scheduled time
  const sortByTime = (a: DailyRoutineStatus, b: DailyRoutineStatus) => {
    return a.routine.scheduledTime.localeCompare(b.routine.scheduledTime);
  };

  for (const key of Object.keys(groups) as RoutineGroup[]) {
    groups[key].sort(sortByTime);
  }

  return groups;
}
