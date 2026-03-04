import type { DailyRoutineStatus } from "../backend.d";

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
