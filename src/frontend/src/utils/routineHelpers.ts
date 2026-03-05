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
