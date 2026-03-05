import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  BarChart2,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  RefreshCw,
  RotateCcw,
  Tag,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { DailyRoutineStatus, Routine } from "../backend.d";
import { useNWeeksPreference } from "../hooks/useNWeeksPreference";
import {
  useGetAllRoutineLogs,
  useGetAllRoutines,
  useGetDailyRoutinesWithStatus,
  useGetRoutineLogs,
  useLogRoutine,
  useUpdateRoutineLogStatus,
} from "../hooks/useQueries";
import { useReminders } from "../hooks/useReminders";
import { useWeekStartPreference } from "../hooks/useWeekStartPreference";
import type { WeekStartMode } from "../utils/routineHelpers";
import {
  DAY_LABELS,
  classifyRoutine,
  computeCategoryPastNWeeksRates,
  computeCategoryWeeklyRates,
  computeDailyWeightedRatesForWeek,
  computePastNWeeksWeightedRates,
  computeTaskWeeklyRates,
  computeWeightedRate,
  countCompletionsInPeriod,
  countPlannedForDate,
  formatDateFull,
  formatRepeatDays,
  formatTime12h,
  getCleanDescription,
  getDayOfWeekForDate,
  getTodayString,
  getWeekDates,
  getWeekStartWithMode,
  groupRoutines,
  isDailyRoutine,
  isFrequencyRoutine,
  loadCategoryWeights,
  parseCategoryMeta,
  parseFrequencyMeta,
  toFlatLogs,
} from "../utils/routineHelpers";

interface DashboardPageProps {
  onNavigateToRoutines: () => void;
  userName: string;
}

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = String(time.getHours() % 12 || 12).padStart(2, "0");
  const minutes = String(time.getMinutes()).padStart(2, "0");
  const seconds = String(time.getSeconds()).padStart(2, "0");
  const period = time.getHours() >= 12 ? "PM" : "AM";

  return (
    <div className="flex items-baseline gap-1 font-mono">
      <span className="text-5xl font-bold tracking-tight text-foreground">
        {hours}:{minutes}
      </span>
      <span
        className="text-2xl font-bold animate-blink-dot"
        style={{ color: "oklch(0.78 0.14 72)" }}
      >
        :{seconds}
      </span>
      <span className="text-base font-medium text-muted-foreground ml-1">
        {period}
      </span>
    </div>
  );
}

const GROUP_CONFIG = {
  overdue: {
    label: "Overdue",
    icon: AlertTriangle,
    className: "text-overdue",
    badgeStyle: {
      background: "oklch(0.65 0.2 28 / 0.15)",
      color: "oklch(0.65 0.2 28)",
    },
    cardClass: "border-overdue/40 bg-overdue/5 animate-urgent-pulse",
    dotStyle: { background: "oklch(0.65 0.2 28)" },
  },
  "due-soon": {
    label: "Due Soon",
    icon: Clock,
    className: "text-due-soon",
    badgeStyle: {
      background: "oklch(0.78 0.14 72 / 0.15)",
      color: "oklch(0.78 0.14 72)",
    },
    cardClass: "border-due-soon/40 bg-due-soon/5 animate-due-pulse",
    dotStyle: { background: "oklch(0.78 0.14 72)" },
  },
  upcoming: {
    label: "Upcoming",
    icon: ChevronRight,
    className: "text-muted-foreground",
    badgeStyle: {},
    cardClass: "border-border bg-card",
    dotStyle: { background: "oklch(0.58 0.015 255)" },
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "text-success",
    badgeStyle: {
      background: "oklch(0.72 0.16 150 / 0.15)",
      color: "oklch(0.72 0.16 150)",
    },
    cardClass: "border-border bg-card opacity-60",
    dotStyle: { background: "oklch(0.72 0.16 150)" },
  },
  skipped: {
    label: "Skipped",
    icon: XCircle,
    className: "text-muted-foreground",
    badgeStyle: {
      background: "oklch(0.28 0.015 255 / 0.5)",
      color: "oklch(0.58 0.015 255)",
    },
    cardClass: "border-border bg-card opacity-50",
    dotStyle: { background: "oklch(0.4 0.015 255)" },
  },
} as const;

type GroupKey = keyof typeof GROUP_CONFIG;

function formatReminderChip(value: bigint, unit: string): string {
  const n = Number(value);
  if (unit === "minutes") return `${n} min before`;
  if (unit === "hours") return `${n}h before`;
  if (unit === "days") return `${n} day${n !== 1 ? "s" : ""} before`;
  return "";
}

function RoutineCard({
  item,
  group,
  index,
  onDone,
  onSkip,
  onUndo,
  onMarkDone,
  isLogging,
}: {
  item: DailyRoutineStatus;
  group: GroupKey;
  index: number;
  onDone: () => void;
  onSkip: () => void;
  onUndo?: () => void;
  onMarkDone?: () => void;
  isLogging: boolean;
}) {
  const config = GROUP_CONFIG[group];
  const canAct = group !== "completed" && group !== "skipped";
  const displayDescription = getCleanDescription(item.routine.description);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className={`rounded-xl border p-4 flex items-start gap-3 shadow-card-lift ${config.cardClass}`}
    >
      {/* Status dot */}
      <div className="mt-1 shrink-0">
        <div className="w-2 h-2 rounded-full" style={config.dotStyle} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h3
              className={`font-semibold text-sm leading-tight ${
                group === "completed" || group === "skipped"
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {item.routine.name}
            </h3>
            {displayDescription && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                {displayDescription}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-mono font-medium text-muted-foreground">
              {formatTime12h(item.routine.scheduledTime)}
            </span>
            {item.status && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5"
                style={config.badgeStyle}
              >
                {item.status}
              </Badge>
            )}
          </div>
        </div>

        {/* Repeat schedule */}
        <p className="text-[11px] text-muted-foreground mt-1">
          {formatRepeatDays(item.routine.repeatDays)}
        </p>

        {/* Reminder chip */}
        {item.routine.reminderEnabled && (
          <div
            className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1.5 w-fit"
            style={{
              background: "oklch(0.78 0.14 72 / 0.12)",
              color: "oklch(0.78 0.14 72)",
            }}
          >
            <Bell className="w-2.5 h-2.5" />⏰{" "}
            {formatReminderChip(
              item.routine.reminderOffset.value,
              item.routine.reminderOffset.unit,
            )}
          </div>
        )}

        {/* Action buttons — active tasks */}
        {canAct && (
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              disabled={isLogging}
              onClick={onDone}
              className="h-7 text-xs px-3 font-semibold rounded-lg"
              style={{
                background: "oklch(0.78 0.14 72)",
                color: "oklch(0.12 0.008 260)",
              }}
              data-ocid={`routine.done_button.${index + 1}`}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Done
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isLogging}
              onClick={onSkip}
              className="h-7 text-xs px-3 rounded-lg text-muted-foreground hover:text-foreground"
              data-ocid={`routine.skip_button.${index + 1}`}
            >
              Skip
            </Button>
          </div>
        )}

        {/* Undo button — completed tasks */}
        {group === "completed" && onUndo && (
          <div className="flex items-center gap-2 mt-2.5">
            <Button
              size="sm"
              variant="outline"
              disabled={isLogging}
              onClick={onUndo}
              className="h-6 text-[11px] px-2.5 rounded-lg text-muted-foreground hover:text-foreground border-border/50 hover:border-border opacity-70 hover:opacity-100 transition-opacity"
              data-ocid={`routine.undo_button.${index + 1}`}
            >
              <RotateCcw className="w-2.5 h-2.5 mr-1" />
              Undo
            </Button>
          </div>
        )}

        {/* Undo + Mark Done buttons — skipped tasks */}
        {group === "skipped" && (
          <div className="flex items-center gap-2 mt-2.5">
            {onUndo && (
              <Button
                size="sm"
                variant="outline"
                disabled={isLogging}
                onClick={onUndo}
                className="h-6 text-[11px] px-2.5 rounded-lg text-muted-foreground hover:text-foreground border-border/50 hover:border-border opacity-70 hover:opacity-100 transition-opacity"
                data-ocid={`routine.undo_button.${index + 1}`}
              >
                <RotateCcw className="w-2.5 h-2.5 mr-1" />
                Undo
              </Button>
            )}
            {onMarkDone && (
              <Button
                size="sm"
                disabled={isLogging}
                onClick={onMarkDone}
                className="h-6 text-[11px] px-2.5 font-semibold rounded-lg"
                style={{
                  background: "oklch(0.78 0.14 72)",
                  color: "oklch(0.12 0.008 260)",
                }}
                data-ocid={`routine.done_button.${index + 1}`}
              >
                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                Mark Done
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Category Sub-Label ───────────────────────────────────────────────────────

function CategorySubLabel({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-1.5 mt-3 mb-1.5 first:mt-0">
      <Tag
        className="w-3 h-3 shrink-0"
        style={{ color: "oklch(0.72 0.14 280)" }}
      />
      <span
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "oklch(0.72 0.14 280)" }}
      >
        {name}
      </span>
      <div
        className="flex-1 h-px"
        style={{ background: "oklch(0.55 0.14 280 / 0.2)" }}
      />
    </div>
  );
}

// ─── Frequency Goal Card ───────────────────────────────────────────────────────

function FrequencyGoalCard({
  routineId,
  name,
  description,
  scheduledTime,
  reminderEnabled,
  reminderOffset,
  count,
  period,
  index,
  loggingIds,
  onLog,
  showWeeklyBadge = false,
  onLogsLoaded,
  weekStart,
}: {
  routineId: bigint;
  name: string;
  description: string;
  scheduledTime: string;
  reminderEnabled: boolean;
  reminderOffset: { value: bigint; unit: string };
  count: number;
  period: "week" | "month";
  index: number;
  loggingIds: Set<string>;
  onLog: (id: bigint) => void;
  showWeeklyBadge?: boolean;
  onLogsLoaded?: (
    routineId: bigint,
    completions: number,
    target: number,
  ) => void;
  weekStart?: string;
}) {
  const { data: logs = [] } = useGetRoutineLogs(routineId);
  const completions = countCompletionsInPeriod(
    logs,
    period,
    period === "week" ? weekStart : undefined,
  );
  const pct = Math.min(Math.round((completions / count) * 100), 100);
  const isComplete = completions >= count;
  const isLogging = loggingIds.has(routineId.toString());
  const today = getTodayString();
  const alreadyLoggedToday = logs.some(
    (l) => l.date === today && l.status === "completed",
  );
  const displayDescription = getCleanDescription(description);

  // Report completions up to parent section for aggregate summary
  useEffect(() => {
    if (onLogsLoaded) {
      onLogsLoaded(routineId, completions, count);
    }
  }, [onLogsLoaded, routineId, completions, count]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
      className="rounded-xl border p-4 bg-card shadow-card-lift"
      style={{
        borderColor: isComplete
          ? "oklch(0.72 0.16 150 / 0.4)"
          : "oklch(0.78 0.14 72 / 0.25)",
      }}
      data-ocid={`frequency.item.${index + 1}`}
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <RefreshCw
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: "oklch(0.78 0.14 72)" }}
            />
            <h3 className="font-semibold text-sm text-foreground truncate">
              {name}
            </h3>
            {/* Prominent weekly completion badge */}
            {showWeeklyBadge && (
              <span
                className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0"
                style={
                  isComplete
                    ? {
                        background: "oklch(0.72 0.16 150 / 0.15)",
                        color: "oklch(0.72 0.16 150)",
                      }
                    : {
                        background: "oklch(0.78 0.14 72 / 0.15)",
                        color: "oklch(0.78 0.14 72)",
                      }
                }
              >
                {isComplete && <CheckCircle2 className="w-3 h-3" />}
                {completions} / {count} this week
              </span>
            )}
          </div>
          {displayDescription && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs ml-5">
              {displayDescription}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground">
            {formatTime12h(scheduledTime)}
          </span>
          {isComplete && !showWeeklyBadge ? (
            <Badge
              className="text-[10px] px-2 py-0 h-5 ml-1"
              style={{
                background: "oklch(0.72 0.16 150 / 0.15)",
                color: "oklch(0.72 0.16 150)",
                border: "none",
              }}
            >
              ✓ Done for this {period}!
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Reminder chip */}
      {reminderEnabled && (
        <div
          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-2 w-fit"
          style={{
            background: "oklch(0.78 0.14 72 / 0.12)",
            color: "oklch(0.78 0.14 72)",
          }}
        >
          <Bell className="w-2.5 h-2.5" />⏰{" "}
          {formatReminderChip(reminderOffset.value, reminderOffset.unit)}
        </div>
      )}

      {/* Progress */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {completions} / {count} this {period}
          </span>
          <span
            className="text-xs font-semibold"
            style={{ color: "oklch(0.78 0.14 72)" }}
          >
            {pct}%
          </span>
        </div>
        <Progress
          value={pct}
          className="h-1.5 bg-muted"
          style={
            {
              "--progress-foreground": isComplete
                ? "oklch(0.72 0.16 150)"
                : "oklch(0.78 0.14 72)",
            } as React.CSSProperties
          }
        />
      </div>

      {/* Log button */}
      {!isComplete && (
        <div className="mt-3">
          <Button
            size="sm"
            disabled={isLogging || alreadyLoggedToday}
            onClick={() => onLog(routineId)}
            className="h-7 text-xs px-3 font-semibold rounded-lg"
            style={
              alreadyLoggedToday
                ? {
                    background: "oklch(0.72 0.16 150 / 0.15)",
                    color: "oklch(0.72 0.16 150)",
                  }
                : {
                    background: "oklch(0.78 0.14 72)",
                    color: "oklch(0.12 0.008 260)",
                  }
            }
            data-ocid={`frequency.log_button.${index + 1}`}
          >
            {isLogging ? (
              <>
                <Zap className="w-3 h-3 mr-1 animate-spin" />
                Logging...
              </>
            ) : alreadyLoggedToday ? (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Logged today
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Log it
              </>
            )}
          </Button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Success Rates Panel ──────────────────────────────────────────────────────

function getRateColor(rate: number | null): string {
  if (rate === null) return "oklch(0.55 0.012 255)";
  if (rate >= 80) return "oklch(0.72 0.16 150)";
  if (rate >= 40) return "oklch(0.78 0.14 72)";
  return "oklch(0.65 0.2 28)";
}

function RatePill({
  label,
  rate,
  ocid,
}: {
  label: string;
  rate: number | null;
  ocid: string;
}) {
  const color = getRateColor(rate);
  return (
    <div
      className="flex-1 rounded-xl border border-border/60 p-3 flex flex-col gap-1"
      style={{ background: "oklch(0.165 0.012 255 / 0.6)" }}
      data-ocid={ocid}
    >
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">
        {label}
      </span>
      <span
        className="text-2xl font-bold font-display leading-none"
        style={{ color }}
      >
        {rate === null ? "—" : `${rate}%`}
      </span>
      {rate !== null && (
        <div className="w-full h-1 rounded-full bg-muted mt-1 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${rate}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Shared Bar Chart ──────────────────────────────────────────────────────────

function WeekBarChart({
  bars,
  title,
}: {
  bars: Array<{
    label: string;
    subLabel?: string;
    rate: number | null;
    isHighlighted?: boolean;
    isEmpty?: boolean;
  }>;
  title: string;
}) {
  const BAR_AREA_H = 80;
  return (
    <div
      className="rounded-xl border border-border/50 p-3"
      style={{ background: "oklch(0.13 0.008 260 / 0.6)" }}
    >
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {title}
      </p>
      <div
        className="flex items-end gap-1"
        style={{ height: `${BAR_AREA_H + 36}px` }}
      >
        {bars.map((bar, i) => {
          const barColor = bar.isHighlighted
            ? "oklch(0.78 0.14 72)"
            : bar.rate === null
              ? "oklch(0.28 0.015 255 / 0.4)"
              : getRateColor(bar.rate);
          const barHeight =
            bar.isEmpty || bar.rate === null
              ? 6
              : Math.max(6, Math.round((bar.rate / 100) * BAR_AREA_H));

          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: bar labels can repeat
              key={i}
              className="flex-1 flex flex-col items-center gap-0.5"
            >
              <div
                className="text-center leading-none"
                style={{
                  height: "20px",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
              >
                {bar.isHighlighted ? (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                    style={{
                      background: "oklch(0.78 0.14 72 / 0.2)",
                      color: "oklch(0.78 0.14 72)",
                    }}
                  >
                    Today
                  </span>
                ) : bar.isEmpty ? (
                  <span className="text-[9px] text-muted-foreground/40">—</span>
                ) : bar.rate !== null ? (
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: getRateColor(bar.rate) }}
                  >
                    {bar.rate}%
                  </span>
                ) : (
                  <span className="text-[9px] text-muted-foreground/40">—</span>
                )}
              </div>
              <div
                className="w-full flex items-end"
                style={{ height: `${BAR_AREA_H}px` }}
              >
                <div
                  className="w-full rounded-t-sm transition-all duration-500"
                  style={{
                    height: `${barHeight}px`,
                    background: barColor,
                    opacity: bar.isEmpty ? 0.25 : 1,
                    boxShadow: bar.isHighlighted
                      ? "0 0 10px oklch(0.78 0.14 72 / 0.35)"
                      : "none",
                  }}
                />
              </div>
              <span
                className="text-[10px] font-medium mt-0.5 truncate w-full text-center"
                style={{
                  color: bar.isHighlighted
                    ? "oklch(0.78 0.14 72)"
                    : "oklch(0.55 0.012 255)",
                }}
              >
                {bar.label}
              </span>
              {bar.subLabel && (
                <span
                  className="text-[9px]"
                  style={{ color: "oklch(0.42 0.012 255)" }}
                >
                  {bar.subLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weighted Success Panel ────────────────────────────────────────────────────

type DrillLevel = "overall" | "categories" | "tasks";

function WeightedSuccessPanel({
  allRoutines,
  weekStart,
  today,
  weekMode,
}: {
  allRoutines: Routine[];
  weekStart: string;
  today: string;
  weekMode: WeekStartMode;
}) {
  const [level, setLevel] = useState<DrillLevel>("overall");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryWeights] = useState(() => loadCategoryWeights());
  const { nWeeks } = useNWeeksPreference();

  // Filter to fixed-day routines only
  const fixedRoutines = useMemo(
    () => allRoutines.filter((r) => !isFrequencyRoutine(r)),
    [allRoutines],
  );

  // Fetch all logs for fixed-day routines
  const { data: rawLogs = [], isLoading: logsLoading } = useGetAllRoutineLogs(
    fixedRoutines.map((r) => r.id),
  );

  const logs = useMemo(() => toFlatLogs(rawLogs), [rawLogs]);
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  // Overall weighted rates for today and current week
  const weeklyRate = useMemo(() => {
    if (categoryWeights.length === 0) return null;
    return computeWeightedRate(
      fixedRoutines,
      logs,
      categoryWeights,
      "week",
      weekDates,
      today,
    );
  }, [fixedRoutines, logs, categoryWeights, weekDates, today]);

  const dailyRate = useMemo(() => {
    if (categoryWeights.length === 0) return null;
    return computeWeightedRate(
      fixedRoutines,
      logs,
      categoryWeights,
      "day",
      today,
      today,
    );
  }, [fixedRoutines, logs, categoryWeights, today]);

  // Daily weighted rates for the current week bar chart
  const dailyBarData = useMemo(() => {
    if (categoryWeights.length === 0) return null;
    return computeDailyWeightedRatesForWeek(
      fixedRoutines,
      logs,
      categoryWeights,
      weekDates,
      today,
    );
  }, [fixedRoutines, logs, categoryWeights, weekDates, today]);

  // Past N weeks overall rates
  const pastNWeeksData = useMemo(() => {
    if (categoryWeights.length === 0) return null;
    return computePastNWeeksWeightedRates(
      fixedRoutines,
      logs,
      categoryWeights,
      weekMode,
      nWeeks,
    );
  }, [fixedRoutines, logs, categoryWeights, weekMode, nWeeks]);

  // Category weekly rates
  const categoryRates = useMemo(() => {
    if (categoryWeights.length === 0) return [];
    return computeCategoryWeeklyRates(
      fixedRoutines,
      logs,
      categoryWeights,
      weekDates,
      today,
    );
  }, [fixedRoutines, logs, categoryWeights, weekDates, today]);

  // Past N weeks per-category rates
  const categoryPastNWeeks = useMemo(() => {
    if (!selectedCategory || categoryWeights.length === 0) return null;
    return computeCategoryPastNWeeksRates(
      fixedRoutines,
      logs,
      selectedCategory,
      weekMode,
      nWeeks,
    );
  }, [
    fixedRoutines,
    logs,
    selectedCategory,
    categoryWeights,
    weekMode,
    nWeeks,
  ]);

  // Task rates for selected category
  const taskRates = useMemo(() => {
    if (!selectedCategory) return [];
    return computeTaskWeeklyRates(
      fixedRoutines,
      logs,
      selectedCategory,
      weekDates,
      today,
    );
  }, [fixedRoutines, logs, selectedCategory, weekDates, today]);

  const hasWeights = categoryWeights.length > 0;
  const hasAnyUncategorised = fixedRoutines.some(
    (r) => !parseCategoryMeta(r.description),
  );

  if (logsLoading && fixedRoutines.length > 0) {
    return (
      <div
        className="rounded-2xl border border-border bg-card p-4 shadow-card-lift space-y-4"
        data-ocid="success_rates.section"
      >
        <div className="flex items-center gap-2">
          <BarChart2
            className="w-4 h-4"
            style={{ color: "oklch(0.78 0.14 72)" }}
          />
          <span className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Success Rates
          </span>
        </div>
        <div className="flex gap-3">
          <Skeleton
            className="h-16 flex-1 rounded-xl bg-muted"
            data-ocid="success_rates.loading_state"
          />
          <Skeleton className="h-16 flex-1 rounded-xl bg-muted" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl bg-muted" />
      </div>
    );
  }

  if (fixedRoutines.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border bg-card shadow-card-lift overflow-hidden"
      data-ocid="success_rates.section"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border/60"
        style={{ background: "oklch(0.155 0.01 255)" }}
      >
        <div className="flex items-center gap-2">
          {level !== "overall" && (
            <button
              type="button"
              onClick={() => {
                if (level === "tasks") setLevel("categories");
                else {
                  setLevel("overall");
                  setSelectedCategory(null);
                }
              }}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-foreground/10 transition-colors mr-1"
              data-ocid="success_rates.back_button"
            >
              <ChevronLeft
                className="w-4 h-4"
                style={{ color: "oklch(0.78 0.14 72)" }}
              />
            </button>
          )}
          <BarChart2
            className="w-4 h-4"
            style={{ color: "oklch(0.78 0.14 72)" }}
          />
          <span className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {level === "overall"
              ? "Success Rates"
              : level === "categories"
                ? "By Category"
                : (selectedCategory ?? "Tasks")}
          </span>
          {level === "tasks" && selectedCategory && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                background: "oklch(0.55 0.14 280 / 0.15)",
                color: "oklch(0.72 0.14 280)",
              }}
            >
              tasks
            </span>
          )}
        </div>

        {/* Breadcrumb trail */}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <button
            type="button"
            className={`transition-colors ${level === "overall" ? "text-foreground font-semibold" : "hover:text-foreground"}`}
            onClick={() => {
              setLevel("overall");
              setSelectedCategory(null);
            }}
            data-ocid="success_rates.overall.tab"
          >
            Overall
          </button>
          <ChevronRight className="w-3 h-3 opacity-40" />
          <button
            type="button"
            className={`transition-colors ${level === "categories" ? "text-foreground font-semibold" : level === "tasks" ? "hover:text-foreground" : "opacity-40 cursor-default"}`}
            onClick={() => {
              if (level !== "overall") setLevel("categories");
            }}
            data-ocid="success_rates.categories.tab"
          >
            Categories
          </button>
          <ChevronRight className="w-3 h-3 opacity-40" />
          <span
            className={`${level === "tasks" ? "text-foreground font-semibold" : "opacity-40"}`}
          >
            Tasks
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <AnimatePresence mode="wait">
          {/* ── Level 1: Overall ─────────────────────────────────────────── */}
          {level === "overall" && (
            <motion.div
              key="overall"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Uncategorised warning */}
              {hasAnyUncategorised && (
                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                  style={{
                    background: "oklch(0.65 0.2 28 / 0.08)",
                    border: "1px solid oklch(0.65 0.2 28 / 0.25)",
                    color: "oklch(0.65 0.2 28)",
                  }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Some tasks are uncategorised. Assign all tasks to categories
                    for accurate weighted rates.
                  </span>
                </div>
              )}

              {/* Rate pills */}
              {!hasWeights ? (
                <div
                  className="rounded-xl border border-border/50 p-4 text-center space-y-2"
                  style={{ background: "oklch(0.155 0.01 255)" }}
                  data-ocid="success_rates.setup_prompt.card"
                >
                  <BarChart2
                    className="w-5 h-5 mx-auto"
                    style={{ color: "oklch(0.55 0.012 255)" }}
                  />
                  <p className="text-sm text-muted-foreground">
                    Set up category weights in{" "}
                    <span className="font-semibold text-foreground">
                      Routines → Manage Categories
                    </span>{" "}
                    to see weighted success rates.
                  </p>
                </div>
              ) : (
                <div className="flex gap-3">
                  <RatePill
                    label="Weekly Success"
                    rate={weeklyRate}
                    ocid="success_rates.weekly_rate.card"
                  />
                  <RatePill
                    label="Today's Success"
                    rate={dailyRate}
                    ocid="success_rates.daily_rate.card"
                  />
                </div>
              )}

              {/* Current week bar chart */}
              {hasWeights && dailyBarData && (
                <WeekBarChart
                  title="Daily Success — This Week"
                  bars={weekDates.map((dateStr) => {
                    const entry = dailyBarData.find(
                      (d) => d.dateStr === dateStr,
                    );
                    const dow = getDayOfWeekForDate(dateStr);
                    const dayLabel = DAY_LABELS[dow] ?? "?";
                    const dateNum = Number.parseInt(dateStr.split("-")[2]!, 10);
                    return {
                      label: dayLabel,
                      subLabel: String(dateNum),
                      rate: entry?.rate ?? null,
                      isHighlighted: dateStr === today,
                      isEmpty: dateStr > today,
                    };
                  })}
                />
              )}

              {/* Past N weeks bar chart */}
              {hasWeights && pastNWeeksData && pastNWeeksData.length > 1 && (
                <WeekBarChart
                  title={`Past ${nWeeks} Weeks — Weighted Success`}
                  bars={pastNWeeksData.map((w, i) => ({
                    label: w.weekLabel,
                    rate: w.rate,
                    isHighlighted: i === pastNWeeksData.length - 1,
                    isEmpty: w.rate === null,
                  }))}
                />
              )}

              {/* Drill down button */}
              <button
                type="button"
                onClick={() => setLevel("categories")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border/50 hover:border-foreground/20 transition-colors text-sm font-medium text-muted-foreground hover:text-foreground"
                style={{ background: "oklch(0.155 0.01 255)" }}
                data-ocid="success_rates.view_categories.button"
              >
                <span>View by Category</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* ── Level 2: Categories ───────────────────────────────────────── */}
          {level === "categories" && (
            <motion.div
              key="categories"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {!hasWeights ? (
                <div
                  className="rounded-xl border border-border/50 p-4 text-center space-y-2"
                  style={{ background: "oklch(0.155 0.01 255)" }}
                >
                  <p className="text-sm text-muted-foreground">
                    Configure category weights in{" "}
                    <span className="font-semibold text-foreground">
                      Routines → Manage Categories
                    </span>{" "}
                    to see per-category success rates.
                  </p>
                </div>
              ) : (
                <>
                  {/* Category cards */}
                  <div
                    className="space-y-2"
                    data-ocid="success_rates.categories.list"
                  >
                    {categoryRates.map((cat, i) => {
                      const color = getRateColor(cat.rate);
                      return (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.name);
                            setLevel("tasks");
                          }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-border/50 hover:border-foreground/20 transition-colors text-left"
                          style={{ background: "oklch(0.155 0.01 255)" }}
                          data-ocid={`success_rates.category.item.${i + 1}`}
                        >
                          {/* Category name + weight badge */}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground truncate">
                                {cat.name}
                              </span>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                                style={{
                                  background: "oklch(0.55 0.14 280 / 0.15)",
                                  color: "oklch(0.72 0.14 280)",
                                }}
                              >
                                {cat.weight}%
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${cat.rate ?? 0}%`,
                                    background: color,
                                  }}
                                />
                              </div>
                              <span
                                className="text-xs font-semibold shrink-0 w-8 text-right"
                                style={{ color }}
                              >
                                {cat.rate !== null ? `${cat.rate}%` : "—"}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {cat.completions} / {cat.planned} completions this
                              week
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </button>
                      );
                    })}
                    {categoryRates.length === 0 && (
                      <p
                        className="text-sm text-muted-foreground text-center py-4"
                        data-ocid="success_rates.categories.empty_state"
                      >
                        No category data for this week.
                      </p>
                    )}
                  </div>

                  {/* Past N weeks chart per-category totals */}
                  {pastNWeeksData && pastNWeeksData.length > 1 && (
                    <WeekBarChart
                      title={`Past ${nWeeks} Weeks — Overall Weighted`}
                      bars={pastNWeeksData.map((w, i) => ({
                        label: w.weekLabel,
                        rate: w.rate,
                        isHighlighted: i === pastNWeeksData.length - 1,
                        isEmpty: w.rate === null,
                      }))}
                    />
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ── Level 3: Tasks ────────────────────────────────────────────── */}
          {level === "tasks" && selectedCategory && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Task list */}
              <div className="space-y-2" data-ocid="success_rates.tasks.list">
                {taskRates.length === 0 ? (
                  <p
                    className="text-sm text-muted-foreground text-center py-4"
                    data-ocid="success_rates.tasks.empty_state"
                  >
                    No fixed-day tasks in this category for the current week.
                  </p>
                ) : (
                  taskRates.map((t, i) => {
                    const color = getRateColor(t.rate);
                    return (
                      <div
                        key={t.routine.id.toString()}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/50"
                        style={{ background: "oklch(0.155 0.01 255)" }}
                        data-ocid={`success_rates.task.item.${i + 1}`}
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">
                              {t.routine.name}
                            </span>
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                              style={{
                                color,
                                background: `${color.replace(")", " / 0.12)")}`,
                              }}
                            >
                              {t.rate !== null ? `${t.rate}%` : "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${t.rate ?? 0}%`,
                                  background: color,
                                }}
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {t.completions}/{t.planned}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {formatRepeatDays(t.routine.repeatDays)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Past N weeks for selected category */}
              {categoryPastNWeeks && categoryPastNWeeks.length > 1 && (
                <WeekBarChart
                  title={`Past ${nWeeks} Weeks — ${selectedCategory}`}
                  bars={categoryPastNWeeks.map((w, i) => ({
                    label: w.weekLabel,
                    rate: w.rate,
                    isHighlighted: i === categoryPastNWeeks.length - 1,
                    isEmpty: w.rate === null,
                  }))}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── View Mode Types & Persistence ────────────────────────────────────────────

type ViewMode = "completion" | "category" | "frequency";
const VIEW_MODE_KEY = "drm_view_mode";

function loadViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    if (raw === "completion" || raw === "category" || raw === "frequency")
      return raw;
  } catch {
    // ignore
  }
  return "completion";
}

function saveViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

// ─── View Mode Selector ────────────────────────────────────────────────────────

function ViewModeSelector({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const tabs: {
    id: ViewMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    ocid: string;
  }[] = [
    {
      id: "completion",
      label: "Completion Wise",
      icon: CheckCircle2,
      ocid: "dashboard.view_mode.completion.tab",
    },
    {
      id: "category",
      label: "Category Wise",
      icon: Tag,
      ocid: "dashboard.view_mode.category.tab",
    },
    {
      id: "frequency",
      label: "Frequency Wise",
      icon: RefreshCw,
      ocid: "dashboard.view_mode.frequency.tab",
    },
  ];

  return (
    <div
      className="rounded-2xl border border-border/60 overflow-hidden shadow-card-lift"
      style={{ background: "oklch(0.155 0.01 255)" }}
    >
      {/* Label row */}
      <div
        className="px-4 py-2 border-b border-border/40 flex items-center gap-2"
        style={{ background: "oklch(0.145 0.01 258)" }}
      >
        <BarChart2
          className="w-3.5 h-3.5"
          style={{ color: "oklch(0.78 0.14 72)" }}
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          View Tasks By
        </span>
      </div>
      {/* Tab row */}
      <div className="grid grid-cols-3 p-1.5 gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              data-ocid={tab.ocid}
              className="relative flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-1.5 px-3 py-3 rounded-xl text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={
                isActive
                  ? {
                      background: "oklch(0.78 0.14 72 / 0.14)",
                      boxShadow:
                        "0 0 0 1.5px oklch(0.78 0.14 72 / 0.5), 0 2px 8px oklch(0.78 0.14 72 / 0.1)",
                      color: "oklch(0.78 0.14 72)",
                    }
                  : {
                      background: "transparent",
                      color: "oklch(0.55 0.012 255)",
                    }
              }
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${isActive ? "opacity-100" : "opacity-60"}`}
              />
              <span
                className={`text-xs font-semibold leading-tight text-center sm:text-left ${isActive ? "opacity-100" : "opacity-60"}`}
              >
                {tab.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="viewmode-indicator"
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    boxShadow: "inset 0 0 0 1.5px oklch(0.78 0.14 72 / 0.4)",
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Status Classification Helpers ────────────────────────────────────────────

/** Get simple completion status for a fixed-day routine */
function getFixedDayStatus(
  item: DailyRoutineStatus,
): "incomplete" | "complete" | "skipped" {
  if (item.status === "completed") return "complete";
  if (item.status === "skipped") return "skipped";
  return "incomplete";
}

/** Returns category names sorted by descending weight, with Uncategorised last */
function getOrderedCategories(
  items: DailyRoutineStatus[],
  categoryWeights: { name: string; weight: number }[],
): string[] {
  // Build a set of category names present in the items
  const presentCats = new Set<string>();
  let hasUncategorised = false;
  for (const item of items) {
    const cat = parseCategoryMeta(item.routine.description);
    if (cat) {
      presentCats.add(cat);
    } else {
      hasUncategorised = true;
    }
  }

  // Sort by weight descending, only include categories present in items
  const sorted = [...categoryWeights]
    .filter((cw) => presentCats.has(cw.name))
    .sort((a, b) => b.weight - a.weight)
    .map((cw) => cw.name);

  // Add any categories not in weights (edge case)
  for (const cat of presentCats) {
    if (!sorted.includes(cat)) sorted.push(cat);
  }

  if (hasUncategorised) sorted.push("Uncategorised");
  return sorted;
}

/** Group items by category, respecting weight order */
function groupByCategory(
  items: DailyRoutineStatus[],
  orderedCategories: string[],
): { catName: string; catItems: DailyRoutineStatus[] }[] {
  const map = new Map<string, DailyRoutineStatus[]>();
  for (const item of items) {
    const cat = parseCategoryMeta(item.routine.description) ?? "Uncategorised";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  const result: { catName: string; catItems: DailyRoutineStatus[] }[] = [];
  for (const catName of orderedCategories) {
    const catItems = map.get(catName);
    if (catItems && catItems.length > 0) result.push({ catName, catItems });
  }
  return result;
}

// ─── Sub-section header components ────────────────────────────────────────────

function CompletionStatusHeader({
  status,
  count,
}: {
  status: "incomplete" | "complete" | "skipped";
  count: number;
}) {
  if (status === "incomplete") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span className="text-sm font-semibold uppercase tracking-wider">
          Incomplete
        </span>
        <span className="text-xs opacity-60">({count})</span>
      </div>
    );
  }
  if (status === "complete") {
    return (
      <div
        className="flex items-center gap-2"
        style={{ color: "oklch(0.72 0.16 150)" }}
      >
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-sm font-semibold uppercase tracking-wider">
          Completed
        </span>
        <span className="text-xs opacity-60">({count})</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <XCircle className="w-4 h-4" />
      <span className="text-sm font-semibold uppercase tracking-wider">
        Skipped
      </span>
      <span className="text-xs opacity-60">({count})</span>
    </div>
  );
}

function FrequencyTypeHeader({
  type,
}: {
  type: "daily" | "weekly";
}) {
  if (type === "daily") {
    return (
      <div
        className="flex items-center gap-1.5 mt-2 mb-1.5"
        style={{ color: "oklch(0.78 0.14 72)" }}
      >
        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          Daily Tasks
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "oklch(0.78 0.14 72 / 0.2)" }}
        />
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-1.5 mt-2 mb-1.5"
      style={{ color: "oklch(0.72 0.14 280)" }}
    >
      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-wider">
        Weekly Tasks
      </span>
      <div
        className="flex-1 h-px"
        style={{ background: "oklch(0.72 0.14 280 / 0.2)" }}
      />
    </div>
  );
}

// ─── Shared props type for all three view components ─────────────────────────

interface ViewProps {
  allRoutineData: DailyRoutineStatus[];
  loggingIds: Set<string>;
  onDone: (id: bigint) => void;
  onSkip: (id: bigint) => void;
  onUndo: (id: bigint) => void;
  onMarkDone: (id: bigint) => void;
  weekStart: string;
  now: Date;
  freqLogs: Map<string, { completions: number; count: number }>;
}

// ─── Completion Wise View ──────────────────────────────────────────────────────

function CompletionWiseView({
  allRoutineData,
  loggingIds,
  onDone,
  onSkip,
  onUndo,
  onMarkDone,
  weekStart,
  now,
  freqLogs,
}: ViewProps) {
  const categoryWeights = useMemo(() => loadCategoryWeights(), []);

  // Classify by new Daily/Weekly rule (isDailyRoutine) — for section headers
  const dailyItems = allRoutineData.filter((item) =>
    isDailyRoutine(item.routine),
  );
  const weeklyItems = allRoutineData.filter(
    (item) => !isDailyRoutine(item.routine),
  );

  // Within daily items, determine completion status
  const dailyIncomplete = dailyItems.filter((item) => {
    if (isFrequencyRoutine(item.routine)) {
      const info = freqLogs.get(item.routine.id.toString());
      if (!info) return true;
      return info.completions < info.count;
    }
    return getFixedDayStatus(item) === "incomplete";
  });
  const dailyComplete = dailyItems.filter((item) => {
    if (isFrequencyRoutine(item.routine)) {
      const info = freqLogs.get(item.routine.id.toString());
      if (!info) return false;
      return info.completions >= info.count;
    }
    return getFixedDayStatus(item) === "complete";
  });
  const dailySkipped = dailyItems.filter((item) => {
    if (isFrequencyRoutine(item.routine)) {
      return item.status === "skipped";
    }
    return getFixedDayStatus(item) === "skipped";
  });

  // Within weekly items, determine completion status
  const weeklyIncomplete = weeklyItems.filter((item) => {
    if (isFrequencyRoutine(item.routine)) {
      const info = freqLogs.get(item.routine.id.toString());
      if (!info) return true;
      return info.completions < info.count;
    }
    return getFixedDayStatus(item) === "incomplete";
  });
  const weeklyComplete = weeklyItems.filter((item) => {
    if (isFrequencyRoutine(item.routine)) {
      const info = freqLogs.get(item.routine.id.toString());
      if (!info) return false;
      return info.completions >= info.count;
    }
    return getFixedDayStatus(item) === "complete";
  });
  const weeklySkipped = weeklyItems.filter((item) => {
    if (isFrequencyRoutine(item.routine)) {
      return item.status === "skipped";
    }
    return getFixedDayStatus(item) === "skipped";
  });

  const allIncomplete = [...dailyIncomplete, ...weeklyIncomplete];
  const allComplete = [...dailyComplete, ...weeklyComplete];
  const allSkipped = [...dailySkipped, ...weeklySkipped];

  const orderedCats = useMemo(
    () => getOrderedCategories(allRoutineData, categoryWeights),
    [allRoutineData, categoryWeights],
  );

  /** Render a mixed group (both fixed-day and frequency routines) with category sub-labels */
  const renderMixedGroup = (
    items: DailyRoutineStatus[],
    statusGroup: "incomplete" | "complete" | "skipped",
    startIndex: number,
  ) => {
    if (items.length === 0) return null;
    const catGroups = groupByCategory(items, orderedCats);
    const showCatLabels =
      catGroups.length > 1 ||
      (catGroups.length === 1 && catGroups[0]?.catName !== "Uncategorised");
    let idx = startIndex;
    const groupKey: GroupKey =
      statusGroup === "complete"
        ? "completed"
        : statusGroup === "skipped"
          ? "skipped"
          : "upcoming";

    const renderItem = (item: DailyRoutineStatus, i: number) => {
      if (isFrequencyRoutine(item.routine)) {
        const freqMeta = parseFrequencyMeta(item.routine.description);
        if (!freqMeta) return null;
        return (
          <FrequencyGoalCard
            key={item.routine.id.toString()}
            routineId={item.routine.id}
            name={item.routine.name}
            description={item.routine.description}
            scheduledTime={item.routine.scheduledTime}
            reminderEnabled={item.routine.reminderEnabled}
            reminderOffset={item.routine.reminderOffset}
            count={freqMeta.count}
            period={freqMeta.period}
            index={i}
            loggingIds={loggingIds}
            onLog={onDone}
            showWeeklyBadge={freqMeta.period === "week"}
            weekStart={weekStart}
          />
        );
      }
      const classified = classifyRoutine(item, now);
      const cardGroup: GroupKey =
        statusGroup === "incomplete" ? classified : groupKey;
      return (
        <RoutineCard
          key={item.routine.id.toString()}
          item={item}
          group={cardGroup}
          index={i}
          onDone={() => onDone(item.routine.id)}
          onSkip={() => onSkip(item.routine.id)}
          onUndo={() => onUndo(item.routine.id)}
          onMarkDone={() => onMarkDone(item.routine.id)}
          isLogging={loggingIds.has(item.routine.id.toString())}
        />
      );
    };

    return (
      <div className="space-y-1">
        {showCatLabels
          ? catGroups.map(({ catName, catItems }) => (
              <div key={catName}>
                <CategorySubLabel name={catName} />
                <div className="space-y-2.5">
                  {catItems.map((item) => {
                    const i = idx++;
                    return renderItem(item, i);
                  })}
                </div>
              </div>
            ))
          : items.map((item) => {
              const i = idx++;
              return renderItem(item, i);
            })}
      </div>
    );
  };

  const sections: {
    status: "incomplete" | "complete" | "skipped";
    dailySubset: DailyRoutineStatus[];
    weeklySubset: DailyRoutineStatus[];
  }[] = [
    {
      status: "incomplete",
      dailySubset: dailyIncomplete,
      weeklySubset: weeklyIncomplete,
    },
    {
      status: "complete",
      dailySubset: dailyComplete,
      weeklySubset: weeklyComplete,
    },
    {
      status: "skipped",
      dailySubset: dailySkipped,
      weeklySubset: weeklySkipped,
    },
  ];

  return (
    <motion.div
      key="completion-view"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
      data-ocid="dashboard.completion_view.section"
    >
      {sections.map(({ status, dailySubset, weeklySubset }) => {
        const totalCount = dailySubset.length + weeklySubset.length;
        if (totalCount === 0) return null;
        return (
          <div key={status} className="space-y-4">
            <CompletionStatusHeader status={status} count={totalCount} />
            {dailySubset.length > 0 && (
              <div className="space-y-2">
                <FrequencyTypeHeader type="daily" />
                {renderMixedGroup(dailySubset, status, 0)}
              </div>
            )}
            {weeklySubset.length > 0 && (
              <div className="space-y-2">
                <FrequencyTypeHeader type="weekly" />
                {renderMixedGroup(weeklySubset, status, dailySubset.length)}
              </div>
            )}
          </div>
        );
      })}
      {allIncomplete.length === 0 &&
        allComplete.length === 0 &&
        allSkipped.length === 0 && (
          <p
            className="text-sm text-muted-foreground text-center py-8"
            data-ocid="completion_view.empty_state"
          >
            No tasks to display.
          </p>
        )}
    </motion.div>
  );
}

// ─── Category Wise View ────────────────────────────────────────────────────────

function CategoryWiseView({
  allRoutineData,
  loggingIds,
  onDone,
  onSkip,
  onUndo,
  onMarkDone,
  weekStart,
  now,
  freqLogs,
}: ViewProps) {
  const categoryWeights = useMemo(() => loadCategoryWeights(), []);
  const orderedCats = useMemo(
    () => getOrderedCategories(allRoutineData, categoryWeights),
    [allRoutineData, categoryWeights],
  );

  // Group all items by category
  const catMap = useMemo(() => {
    const map = new Map<string, DailyRoutineStatus[]>();
    for (const item of allRoutineData) {
      const cat =
        parseCategoryMeta(item.routine.description) ?? "Uncategorised";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [allRoutineData]);

  const getWeightForCat = (catName: string) => {
    const cw = categoryWeights.find((c) => c.name === catName);
    return cw ? cw.weight : null;
  };

  return (
    <motion.div
      key="category-view"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
      data-ocid="dashboard.category_view.section"
    >
      {orderedCats.map((catName) => {
        const catItems = catMap.get(catName) ?? [];
        if (catItems.length === 0) return null;
        const weight = getWeightForCat(catName);

        // Split by Daily/Weekly using isDailyRoutine (for section headers)
        const catDailyItems = catItems.filter((item) =>
          isDailyRoutine(item.routine),
        );
        const catWeeklyItems = catItems.filter(
          (item) => !isDailyRoutine(item.routine),
        );

        const getCompletionStatus = (item: DailyRoutineStatus) => {
          if (isFrequencyRoutine(item.routine)) {
            const info = freqLogs.get(item.routine.id.toString());
            if (item.status === "skipped") return "skipped";
            if (!info || info.completions < info.count) return "incomplete";
            return "complete";
          }
          return getFixedDayStatus(item);
        };

        const dailyIncomplete = catDailyItems.filter(
          (item) => getCompletionStatus(item) === "incomplete",
        );
        const dailyComplete = catDailyItems.filter(
          (item) => getCompletionStatus(item) === "complete",
        );
        const dailySkipped = catDailyItems.filter(
          (item) => getCompletionStatus(item) === "skipped",
        );

        const weeklyIncomplete = catWeeklyItems.filter(
          (item) => getCompletionStatus(item) === "incomplete",
        );
        const weeklyComplete = catWeeklyItems.filter(
          (item) => getCompletionStatus(item) === "complete",
        );
        const weeklySkipped = catWeeklyItems.filter(
          (item) => getCompletionStatus(item) === "skipped",
        );

        const statuses: {
          status: "incomplete" | "complete" | "skipped";
          daily: DailyRoutineStatus[];
          weekly: DailyRoutineStatus[];
        }[] = [
          {
            status: "incomplete",
            daily: dailyIncomplete,
            weekly: weeklyIncomplete,
          },
          { status: "complete", daily: dailyComplete, weekly: weeklyComplete },
          { status: "skipped", daily: dailySkipped, weekly: weeklySkipped },
        ];

        return (
          <div
            key={catName}
            className="rounded-2xl border border-border/60 overflow-hidden"
            style={{ background: "oklch(0.155 0.01 255)" }}
          >
            {/* Category header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-border/40"
              style={{ background: "oklch(0.145 0.01 258)" }}
            >
              <div className="flex items-center gap-2">
                <Tag
                  className="w-3.5 h-3.5"
                  style={{ color: "oklch(0.72 0.14 280)" }}
                />
                <span
                  className="text-sm font-bold"
                  style={{ color: "oklch(0.88 0.012 260)" }}
                >
                  {catName}
                </span>
              </div>
              {weight !== null && (
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                  style={{
                    background: "oklch(0.55 0.14 280 / 0.15)",
                    color: "oklch(0.72 0.14 280)",
                  }}
                >
                  {weight}% weight
                </span>
              )}
            </div>

            {/* Status sub-sections */}
            <div className="p-4 space-y-6">
              {statuses.map(({ status, daily, weekly }) => {
                const total = daily.length + weekly.length;
                if (total === 0) return null;
                const hasBothTypes =
                  catDailyItems.length > 0 && catWeeklyItems.length > 0;

                const renderSubset = (
                  items: DailyRoutineStatus[],
                  startIndex: number,
                ) => {
                  let idx = startIndex;
                  const groupKey: GroupKey =
                    status === "complete"
                      ? "completed"
                      : status === "skipped"
                        ? "skipped"
                        : "upcoming";
                  return (
                    <div className="space-y-2">
                      {items.map((item) => {
                        const i = idx++;
                        if (isFrequencyRoutine(item.routine)) {
                          const freqMeta = parseFrequencyMeta(
                            item.routine.description,
                          );
                          if (!freqMeta) return null;
                          return (
                            <FrequencyGoalCard
                              key={item.routine.id.toString()}
                              routineId={item.routine.id}
                              name={item.routine.name}
                              description={item.routine.description}
                              scheduledTime={item.routine.scheduledTime}
                              reminderEnabled={item.routine.reminderEnabled}
                              reminderOffset={item.routine.reminderOffset}
                              count={freqMeta.count}
                              period={freqMeta.period}
                              index={i}
                              loggingIds={loggingIds}
                              onLog={onDone}
                              showWeeklyBadge={freqMeta.period === "week"}
                              weekStart={weekStart}
                            />
                          );
                        }
                        const classified = classifyRoutine(item, now);
                        const cardGroup: GroupKey =
                          status === "incomplete" ? classified : groupKey;
                        return (
                          <RoutineCard
                            key={item.routine.id.toString()}
                            item={item}
                            group={cardGroup}
                            index={i}
                            onDone={() => onDone(item.routine.id)}
                            onSkip={() => onSkip(item.routine.id)}
                            onUndo={() => onUndo(item.routine.id)}
                            onMarkDone={() => onMarkDone(item.routine.id)}
                            isLogging={loggingIds.has(
                              item.routine.id.toString(),
                            )}
                          />
                        );
                      })}
                    </div>
                  );
                };

                return (
                  <div key={status} className="space-y-3">
                    <CompletionStatusHeader status={status} count={total} />
                    {daily.length > 0 && (
                      <div>
                        {hasBothTypes && <FrequencyTypeHeader type="daily" />}
                        {renderSubset(daily, 0)}
                      </div>
                    )}
                    {weekly.length > 0 && (
                      <div>
                        {hasBothTypes && <FrequencyTypeHeader type="weekly" />}
                        {renderSubset(weekly, daily.length)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {orderedCats.length === 0 && (
        <p
          className="text-sm text-muted-foreground text-center py-8"
          data-ocid="category_view.empty_state"
        >
          No tasks to display.
        </p>
      )}
    </motion.div>
  );
}

// ─── Frequency Wise View ───────────────────────────────────────────────────────

function FrequencyWiseView({
  allRoutineData,
  loggingIds,
  onDone,
  onSkip,
  onUndo,
  onMarkDone,
  weekStart,
  now,
  freqLogs,
}: ViewProps) {
  const categoryWeights = useMemo(() => loadCategoryWeights(), []);
  const orderedCats = useMemo(
    () => getOrderedCategories(allRoutineData, categoryWeights),
    [allRoutineData, categoryWeights],
  );

  // Classify by new Daily/Weekly rule (isDailyRoutine)
  const freqViewDailyItems = allRoutineData.filter((item) =>
    isDailyRoutine(item.routine),
  );
  const freqViewWeeklyItems = allRoutineData.filter(
    (item) => !isDailyRoutine(item.routine),
  );

  const getFreqViewStatus = (
    item: DailyRoutineStatus,
  ): "incomplete" | "complete" | "skipped" => {
    if (isFrequencyRoutine(item.routine)) {
      const info = freqLogs.get(item.routine.id.toString());
      if (item.status === "skipped") return "skipped";
      if (!info || info.completions < info.count) return "incomplete";
      return "complete";
    }
    return getFixedDayStatus(item);
  };

  const dailyIncomplete = freqViewDailyItems.filter(
    (item) => getFreqViewStatus(item) === "incomplete",
  );
  const dailyComplete = freqViewDailyItems.filter(
    (item) => getFreqViewStatus(item) === "complete",
  );
  const dailySkipped = freqViewDailyItems.filter(
    (item) => getFreqViewStatus(item) === "skipped",
  );

  const weeklyIncomplete = freqViewWeeklyItems.filter(
    (item) => getFreqViewStatus(item) === "incomplete",
  );
  const weeklyComplete = freqViewWeeklyItems.filter(
    (item) => getFreqViewStatus(item) === "complete",
  );
  const weeklySkipped = freqViewWeeklyItems.filter(
    (item) => getFreqViewStatus(item) === "skipped",
  );

  /** Render a mixed group with category sub-labels, using correct card per isFrequencyRoutine */
  const renderMixedGroup = (
    items: DailyRoutineStatus[],
    statusGroup: "incomplete" | "complete" | "skipped",
    startIndex: number,
  ) => {
    if (items.length === 0) return null;
    const groupKey: GroupKey =
      statusGroup === "complete"
        ? "completed"
        : statusGroup === "skipped"
          ? "skipped"
          : "upcoming";
    const catGroups = groupByCategory(items, orderedCats);
    const showCatLabels =
      catGroups.length > 1 ||
      (catGroups.length === 1 && catGroups[0]?.catName !== "Uncategorised");
    let idx = startIndex;

    const renderItem = (item: DailyRoutineStatus, i: number) => {
      if (isFrequencyRoutine(item.routine)) {
        const freqMeta = parseFrequencyMeta(item.routine.description);
        if (!freqMeta) return null;
        return (
          <FrequencyGoalCard
            key={item.routine.id.toString()}
            routineId={item.routine.id}
            name={item.routine.name}
            description={item.routine.description}
            scheduledTime={item.routine.scheduledTime}
            reminderEnabled={item.routine.reminderEnabled}
            reminderOffset={item.routine.reminderOffset}
            count={freqMeta.count}
            period={freqMeta.period}
            index={i}
            loggingIds={loggingIds}
            onLog={onDone}
            showWeeklyBadge={freqMeta.period === "week"}
            weekStart={weekStart}
          />
        );
      }
      const classified = classifyRoutine(item, now);
      const cardGroup: GroupKey =
        statusGroup === "incomplete" ? classified : groupKey;
      return (
        <RoutineCard
          key={item.routine.id.toString()}
          item={item}
          group={cardGroup}
          index={i}
          onDone={() => onDone(item.routine.id)}
          onSkip={() => onSkip(item.routine.id)}
          onUndo={() => onUndo(item.routine.id)}
          onMarkDone={() => onMarkDone(item.routine.id)}
          isLogging={loggingIds.has(item.routine.id.toString())}
        />
      );
    };

    return (
      <div className="space-y-1">
        {showCatLabels
          ? catGroups.map(({ catName, catItems }) => (
              <div key={catName}>
                <CategorySubLabel name={catName} />
                <div className="space-y-2.5">
                  {catItems.map((item) => {
                    const i = idx++;
                    return renderItem(item, i);
                  })}
                </div>
              </div>
            ))
          : items.map((item) => {
              const i = idx++;
              return renderItem(item, i);
            })}
      </div>
    );
  };

  return (
    <motion.div
      key="frequency-view"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      className="space-y-8"
      data-ocid="dashboard.frequency_view.section"
    >
      {/* DAILY TASKS — every-day routines */}
      {freqViewDailyItems.length > 0 && (
        <div className="space-y-5">
          <div
            className="flex items-center gap-2"
            style={{ color: "oklch(0.78 0.14 72)" }}
          >
            <CalendarDays className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">
              Daily Tasks
            </span>
            <span className="text-xs opacity-60">
              ({freqViewDailyItems.length})
            </span>
          </div>
          {dailyIncomplete.length > 0 && (
            <div className="space-y-2">
              <CompletionStatusHeader
                status="incomplete"
                count={dailyIncomplete.length}
              />
              {renderMixedGroup(dailyIncomplete, "incomplete", 0)}
            </div>
          )}
          {dailyComplete.length > 0 && (
            <div className="space-y-2">
              <CompletionStatusHeader
                status="complete"
                count={dailyComplete.length}
              />
              {renderMixedGroup(
                dailyComplete,
                "complete",
                dailyIncomplete.length,
              )}
            </div>
          )}
          {dailySkipped.length > 0 && (
            <div className="space-y-2">
              <CompletionStatusHeader
                status="skipped"
                count={dailySkipped.length}
              />
              {renderMixedGroup(
                dailySkipped,
                "skipped",
                dailyIncomplete.length + dailyComplete.length,
              )}
            </div>
          )}
        </div>
      )}

      {/* WEEKLY TASKS — not-every-day routines */}
      {freqViewWeeklyItems.length > 0 && (
        <div className="space-y-5">
          <div
            className="flex items-center gap-2"
            style={{ color: "oklch(0.72 0.14 280)" }}
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm font-semibold uppercase tracking-wider">
              Weekly Tasks
            </span>
            <span className="text-xs opacity-60">
              ({freqViewWeeklyItems.length})
            </span>
          </div>
          {weeklyIncomplete.length > 0 && (
            <div className="space-y-2">
              <CompletionStatusHeader
                status="incomplete"
                count={weeklyIncomplete.length}
              />
              {renderMixedGroup(weeklyIncomplete, "incomplete", 0)}
            </div>
          )}
          {weeklyComplete.length > 0 && (
            <div className="space-y-2">
              <CompletionStatusHeader
                status="complete"
                count={weeklyComplete.length}
              />
              {renderMixedGroup(
                weeklyComplete,
                "complete",
                weeklyIncomplete.length,
              )}
            </div>
          )}
          {weeklySkipped.length > 0 && (
            <div className="space-y-2">
              <CompletionStatusHeader
                status="skipped"
                count={weeklySkipped.length}
              />
              {renderMixedGroup(
                weeklySkipped,
                "skipped",
                weeklyIncomplete.length + weeklyComplete.length,
              )}
            </div>
          )}
        </div>
      )}

      {freqViewDailyItems.length === 0 && freqViewWeeklyItems.length === 0 && (
        <p
          className="text-sm text-muted-foreground text-center py-8"
          data-ocid="frequency_view.empty_state"
        >
          No tasks to display.
        </p>
      )}
    </motion.div>
  );
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage({
  onNavigateToRoutines,
  userName,
}: DashboardPageProps) {
  const today = getTodayString();
  const [now, setNow] = useState(new Date());
  const [loggingIds, setLoggingIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewMode());
  const { mode: weekMode } = useWeekStartPreference();
  const weekStart = getWeekStartWithMode(weekMode);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    saveViewMode(mode);
  }, []);

  const { data: allRoutineData = [], isLoading } =
    useGetDailyRoutinesWithStatus(today);

  // Load all routines for reminder checking
  const { data: allRoutines = [] } = useGetAllRoutines();

  // Fetch logs for frequency routines to determine their completion status
  const freqRoutineIds = useMemo(
    () =>
      allRoutineData
        .filter((item) => isFrequencyRoutine(item.routine))
        .map((item) => item.routine.id),
    [allRoutineData],
  );
  const { data: freqRawLogs = [] } = useGetAllRoutineLogs(freqRoutineIds);

  // Build a map: routineId -> { completions, count } for frequency tasks
  const freqLogs = useMemo(() => {
    const map = new Map<string, { completions: number; count: number }>();
    for (const item of allRoutineData) {
      if (!isFrequencyRoutine(item.routine)) continue;
      const freqMeta = parseFrequencyMeta(item.routine.description);
      if (!freqMeta) continue;
      const routineLogs = freqRawLogs.filter(
        (l) => l.routineId.toString() === item.routine.id.toString(),
      );
      const completions = countCompletionsInPeriod(
        routineLogs,
        freqMeta.period,
        freqMeta.period === "week" ? weekStart : undefined,
      );
      map.set(item.routine.id.toString(), {
        completions,
        count: freqMeta.count,
      });
    }
    return map;
  }, [allRoutineData, freqRawLogs, weekStart]);

  const logRoutine = useLogRoutine();
  const updateRoutineLogStatus = useUpdateRoutineLogStatus();

  // Build DailyRoutineStatus-like objects from allRoutines for reminder hook
  // We pass the daily routine statuses to useReminders (contains status info)
  useReminders(allRoutineData);

  // Refresh grouping every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Separate frequency routines from fixed-day routines
  const fixedDayRoutines = allRoutineData.filter(
    (item) => !isFrequencyRoutine(item.routine),
  );
  const groups = groupRoutines(fixedDayRoutines, now);

  const total = fixedDayRoutines.length;
  const completedCount = groups.completed.length;
  const progressPct =
    total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const handleLog = useCallback(
    async (routineId: bigint, status: "completed" | "skipped") => {
      const idStr = routineId.toString();
      setLoggingIds((prev) => new Set([...prev, idStr]));
      try {
        await logRoutine.mutateAsync({ routineId, date: today, status });
        toast.success(
          status === "completed"
            ? "Great job! Routine completed ✓"
            : "Routine skipped",
        );
      } catch {
        toast.error("Failed to log routine. Try again.");
      } finally {
        setLoggingIds((prev) => {
          const next = new Set(prev);
          next.delete(idStr);
          return next;
        });
      }
    },
    [logRoutine, today],
  );

  const handleUndo = useCallback(
    async (routineId: bigint) => {
      const idStr = routineId.toString();
      setLoggingIds((prev) => new Set([...prev, idStr]));
      try {
        await updateRoutineLogStatus.mutateAsync({
          routineId,
          date: today,
          newStatus: "pending",
        });
        toast.success("Routine moved back to active ↩");
      } catch {
        toast.error("Failed to undo. Try again.");
      } finally {
        setLoggingIds((prev) => {
          const next = new Set(prev);
          next.delete(idStr);
          return next;
        });
      }
    },
    [updateRoutineLogStatus, today],
  );

  const handleMarkDone = useCallback(
    async (routineId: bigint) => {
      const idStr = routineId.toString();
      setLoggingIds((prev) => new Set([...prev, idStr]));
      try {
        await updateRoutineLogStatus.mutateAsync({
          routineId,
          date: today,
          newStatus: "completed",
        });
        toast.success("Great job! Routine marked as completed ✓");
      } catch {
        toast.error("Failed to mark done. Try again.");
      } finally {
        setLoggingIds((prev) => {
          const next = new Set(prev);
          next.delete(idStr);
          return next;
        });
      }
    },
    [updateRoutineLogStatus, today],
  );

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const urgentCount = groups.overdue.length + groups["due-soon"].length;

  const hasAnyContent = allRoutineData.length > 0;

  return (
    <div className="min-h-screen pb-20 md:pb-8" data-ocid="dashboard.section">
      {/* Header with clock */}
      <div
        className="relative overflow-hidden px-4 md:px-8 py-6 md:py-8"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.165 0.012 255) 0%, oklch(0.13 0.008 260) 100%)",
          borderBottom: "1px solid oklch(0.28 0.015 255)",
        }}
      >
        {/* Ambient glow */}
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-5 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, oklch(0.78 0.14 72) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-sm mb-1">
                {greeting()}, {userName.split(" ")[0] || "there"}
              </p>
              <LiveClock />
              <div className="flex items-center gap-1.5 mt-2">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {formatDateFull(today)}
                </span>
              </div>
            </div>

            {/* Progress ring area */}
            <div className="flex flex-col items-start md:items-end gap-2">
              {urgentCount > 0 && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: "oklch(0.65 0.2 28 / 0.15)",
                    color: "oklch(0.65 0.2 28)",
                  }}
                >
                  <AlertTriangle className="w-3 h-3" />
                  {urgentCount} need{urgentCount === 1 ? "s" : ""} attention
                </div>
              )}
              {total > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <TrendingUp
                      className="w-4 h-4"
                      style={{ color: "oklch(0.78 0.14 72)" }}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {completedCount} / {total} done today
                    </span>
                  </div>
                  <div className="w-40 md:w-48">
                    <Progress
                      value={progressPct}
                      className="h-2 bg-muted"
                      style={
                        {
                          "--progress-foreground": "oklch(0.78 0.14 72)",
                        } as React.CSSProperties
                      }
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {progressPct}% complete
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Rates Panel — shown when content exists */}
      {hasAnyContent && (
        <div className="max-w-3xl mx-auto px-4 md:px-8 pt-6">
          <WeightedSuccessPanel
            allRoutines={allRoutines}
            weekStart={weekStart}
            today={today}
            weekMode={weekMode}
          />
        </div>
      )}

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
        {isLoading ? (
          <div className="space-y-6" data-ocid="dashboard.loading_state">
            <Skeleton className="h-24 w-full rounded-2xl bg-card" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24 bg-muted" />
                <Skeleton className="h-20 w-full bg-card" />
                <Skeleton className="h-20 w-full bg-card" />
              </div>
            ))}
          </div>
        ) : !hasAnyContent ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
            data-ocid="routine.empty_state"
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
              style={{ background: "oklch(0.78 0.14 72 / 0.1)" }}
            >
              <Zap
                className="w-10 h-10"
                style={{ color: "oklch(0.78 0.14 72)" }}
              />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground mb-2">
              No routines scheduled today
            </h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              Add your first routine to start building powerful daily habits.
            </p>
            <Button
              onClick={onNavigateToRoutines}
              className="font-semibold"
              style={{
                background: "oklch(0.78 0.14 72)",
                color: "oklch(0.12 0.008 260)",
              }}
            >
              Add my first routine
            </Button>
          </motion.div>
        ) : (
          <>
            {/* View Mode Selector — prominently placed before task content */}
            <div className="mb-6">
              <ViewModeSelector
                value={viewMode}
                onChange={handleViewModeChange}
              />
            </div>

            {/* Task content — switches based on view mode */}
            <AnimatePresence mode="wait">
              {viewMode === "completion" && (
                <CompletionWiseView
                  key="completion"
                  allRoutineData={allRoutineData}
                  loggingIds={loggingIds}
                  onDone={(id) => handleLog(id, "completed")}
                  onSkip={(id) => handleLog(id, "skipped")}
                  onUndo={handleUndo}
                  onMarkDone={handleMarkDone}
                  weekStart={weekStart}
                  now={now}
                  freqLogs={freqLogs}
                />
              )}
              {viewMode === "category" && (
                <CategoryWiseView
                  key="category"
                  allRoutineData={allRoutineData}
                  loggingIds={loggingIds}
                  onDone={(id) => handleLog(id, "completed")}
                  onSkip={(id) => handleLog(id, "skipped")}
                  onUndo={handleUndo}
                  onMarkDone={handleMarkDone}
                  weekStart={weekStart}
                  now={now}
                  freqLogs={freqLogs}
                />
              )}
              {viewMode === "frequency" && (
                <FrequencyWiseView
                  key="frequency"
                  allRoutineData={allRoutineData}
                  loggingIds={loggingIds}
                  onDone={(id) => handleLog(id, "completed")}
                  onSkip={(id) => handleLog(id, "skipped")}
                  onUndo={handleUndo}
                  onMarkDone={handleMarkDone}
                  weekStart={weekStart}
                  now={now}
                  freqLogs={freqLogs}
                />
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
