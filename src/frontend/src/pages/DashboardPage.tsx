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
  ChevronRight,
  Clock,
  RefreshCw,
  RotateCcw,
  Tag,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { DailyRoutineStatus, Routine } from "../backend.d";
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
import {
  DAY_LABELS,
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
  isFrequencyRoutine,
  parseCategoryMeta,
  parseFrequencyMeta,
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

// ─── Group Section ─────────────────────────────────────────────────────────────

function GroupSection({
  groupKey,
  items,
  onDone,
  onSkip,
  onUndo,
  onMarkDone,
  loggingIds,
}: {
  groupKey: GroupKey;
  items: DailyRoutineStatus[];
  onDone: (id: bigint) => void;
  onSkip: (id: bigint) => void;
  onUndo: (id: bigint) => void;
  onMarkDone: (id: bigint) => void;
  loggingIds: Set<string>;
}) {
  if (items.length === 0) return null;
  const config = GROUP_CONFIG[groupKey];
  const Icon = config.icon;

  // Group by category. Preserve insertion order.
  const categoryMap = new Map<string, DailyRoutineStatus[]>();
  for (const item of items) {
    const cat = parseCategoryMeta(item.routine.description) ?? "";
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(item);
  }

  const showCategoryLabels =
    categoryMap.size > 1 ||
    (categoryMap.size === 1 && categoryMap.keys().next().value !== "");

  // Build ordered list: named categories first, then uncategorised
  const orderedGroups: { catName: string; catItems: DailyRoutineStatus[] }[] =
    [];
  for (const [cat, catItems] of categoryMap.entries()) {
    if (cat !== "") orderedGroups.push({ catName: cat, catItems });
  }
  const uncatItems = categoryMap.get("") ?? [];
  if (uncatItems.length > 0) {
    orderedGroups.push({ catName: "Uncategorised", catItems: uncatItems });
  }

  let cardIndex = 0;

  return (
    <div>
      <div className={`flex items-center gap-2 mb-3 ${config.className}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-semibold uppercase tracking-wider">
          {config.label}
        </span>
        <span className="text-xs opacity-60">({items.length})</span>
      </div>
      <div className="space-y-1">
        {showCategoryLabels
          ? orderedGroups.map(({ catName, catItems }) => (
              <div key={catName}>
                <CategorySubLabel name={catName} />
                <div className="space-y-2.5 pl-0">
                  {catItems.map((item) => {
                    const idx = cardIndex++;
                    return (
                      <RoutineCard
                        key={item.routine.id.toString()}
                        item={item}
                        group={groupKey}
                        index={idx}
                        onDone={() => onDone(item.routine.id)}
                        onSkip={() => onSkip(item.routine.id)}
                        onUndo={() => onUndo(item.routine.id)}
                        onMarkDone={() => onMarkDone(item.routine.id)}
                        isLogging={loggingIds.has(item.routine.id.toString())}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          : items.map((item, i) => (
              <RoutineCard
                key={item.routine.id.toString()}
                item={item}
                group={groupKey}
                index={i}
                onDone={() => onDone(item.routine.id)}
                onSkip={() => onSkip(item.routine.id)}
                onUndo={() => onUndo(item.routine.id)}
                onMarkDone={() => onMarkDone(item.routine.id)}
                isLogging={loggingIds.has(item.routine.id.toString())}
              />
            ))}
      </div>
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

// ─── Weekly / Monthly Task Sections ───────────────────────────────────────────

/**
 * A sub-section that renders frequency routines filtered by period.
 * For weekly tasks, shows a prominent aggregate badge in the header
 * and highlights each card's completion count.
 */
function FrequencyPeriodSection({
  items,
  period,
  loggingIds,
  onLog,
  startIndex,
  weekStart,
  onRatioReported,
}: {
  items: DailyRoutineStatus[];
  period: "week" | "month";
  loggingIds: Set<string>;
  onLog: (id: bigint) => void;
  startIndex: number;
  weekStart?: string;
  onRatioReported?: (
    routineId: bigint,
    completions: number,
    target: number,
  ) => void;
}) {
  // Track per-routine completions reported back from each card
  const [completionMap, setCompletionMap] = useState<
    Map<string, { completions: number; target: number }>
  >(new Map());

  const handleLogsLoaded = useCallback(
    (routineId: bigint, completions: number, target: number) => {
      setCompletionMap((prev) => {
        const key = routineId.toString();
        const existing = prev.get(key);
        if (
          existing?.completions === completions &&
          existing?.target === target
        )
          return prev;
        const next = new Map(prev);
        next.set(key, { completions, target });
        return next;
      });
      if (onRatioReported) {
        onRatioReported(routineId, completions, target);
      }
    },
    [onRatioReported],
  );

  if (items.length === 0) return null;

  const isWeekly = period === "week";

  // Compute aggregate totals for header summary
  const totalCompletions = Array.from(completionMap.values()).reduce(
    (sum, v) => sum + v.completions,
    0,
  );
  const totalTarget = Array.from(completionMap.values()).reduce(
    (sum, v) => sum + v.target,
    0,
  );
  const aggregateReady = completionMap.size === items.length;
  const aggregateComplete = aggregateReady && totalCompletions >= totalTarget;

  // Group frequency items by category
  const categoryMap = new Map<string, DailyRoutineStatus[]>();
  for (const item of items) {
    const cat = parseCategoryMeta(item.routine.description) ?? "";
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(item);
  }
  const showCategoryLabels =
    categoryMap.size > 1 ||
    (categoryMap.size === 1 && categoryMap.keys().next().value !== "");

  const orderedCatGroups: {
    catName: string;
    catItems: DailyRoutineStatus[];
  }[] = [];
  for (const [cat, catItems] of categoryMap.entries()) {
    if (cat !== "") orderedCatGroups.push({ catName: cat, catItems });
  }
  const uncatItems = categoryMap.get("") ?? [];
  if (uncatItems.length > 0) {
    orderedCatGroups.push({ catName: "Uncategorised", catItems: uncatItems });
  }

  let cardIndex = startIndex;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div
          className="flex items-center gap-2"
          style={{
            color: isWeekly ? "oklch(0.78 0.14 72)" : "oklch(0.72 0.14 280)",
          }}
        >
          {isWeekly ? (
            <CalendarDays className="w-4 h-4" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="text-sm font-semibold uppercase tracking-wider">
            {isWeekly ? "Weekly Tasks" : "Monthly Tasks"}
          </span>
          <span className="text-xs opacity-60">
            ({items.length} task{items.length !== 1 ? "s" : ""})
          </span>
          {isWeekly && (
            <span className="text-xs text-muted-foreground italic">
              · Sorted by least completed first
            </span>
          )}
        </div>

        {/* Weekly aggregate completion pill */}
        {isWeekly && aggregateReady && (
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={
              aggregateComplete
                ? {
                    background: "oklch(0.72 0.16 150 / 0.15)",
                    color: "oklch(0.72 0.16 150)",
                  }
                : {
                    background: "oklch(0.78 0.14 72 / 0.12)",
                    color: "oklch(0.78 0.14 72)",
                  }
            }
            data-ocid="weekly.summary.card"
          >
            {aggregateComplete && <CheckCircle2 className="w-3 h-3" />}
            {totalCompletions} / {totalTarget} completions this week
          </span>
        )}
      </div>

      {/* Cards — with optional category sub-groups */}
      {showCategoryLabels ? (
        <div className="space-y-1">
          {orderedCatGroups.map(({ catName, catItems }) => (
            <div key={catName}>
              <CategorySubLabel name={catName} />
              <div className="space-y-3">
                {catItems.map((item) => {
                  const freqMeta = parseFrequencyMeta(item.routine.description);
                  if (!freqMeta) return null;
                  const idx = cardIndex++;
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
                      index={idx}
                      loggingIds={loggingIds}
                      onLog={onLog}
                      showWeeklyBadge={isWeekly}
                      onLogsLoaded={handleLogsLoaded}
                      weekStart={weekStart}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
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
                index={startIndex + i}
                loggingIds={loggingIds}
                onLog={onLog}
                showWeeklyBadge={isWeekly}
                onLogsLoaded={handleLogsLoaded}
                weekStart={weekStart}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// A wrapper that fetches logs for ALL weekly routines, computes ratios, sorts them,
// then renders FrequencyPeriodSection with the sorted order.
function WeeklyTasksSortedSection({
  items,
  loggingIds,
  onLog,
  weekStart,
}: {
  items: DailyRoutineStatus[];
  loggingIds: Set<string>;
  onLog: (id: bigint) => void;
  weekStart: string;
}) {
  const [sortedItems, setSortedItems] = useState<DailyRoutineStatus[]>(items);
  const [ratioMap, setRatioMap] = useState<Map<string, number>>(new Map());

  const handleRatioReported = useCallback(
    (routineId: bigint, completions: number, target: number) => {
      const key = routineId.toString();
      const ratio = target > 0 ? completions / target : 0;
      setRatioMap((prev) => {
        if (prev.get(key) === ratio) return prev;
        const next = new Map(prev);
        next.set(key, ratio);
        return next;
      });
    },
    [],
  );

  // Re-sort whenever ratioMap changes and we have all ratios
  useEffect(() => {
    if (ratioMap.size < items.length) return;
    const sorted = [...items].sort((a, b) => {
      const ra = ratioMap.get(a.routine.id.toString()) ?? 0;
      const rb = ratioMap.get(b.routine.id.toString()) ?? 0;
      // completed tasks (ratio >= 1) go last
      const aComplete = ra >= 1;
      const bComplete = rb >= 1;
      if (aComplete && !bComplete) return 1;
      if (!aComplete && bComplete) return -1;
      return ra - rb; // ascending ratio (least done first)
    });
    setSortedItems(sorted);
  }, [ratioMap, items]);

  if (items.length === 0) return null;

  return (
    <FrequencyPeriodSection
      items={sortedItems}
      period="week"
      loggingIds={loggingIds}
      onLog={onLog}
      startIndex={0}
      weekStart={weekStart}
      onRatioReported={handleRatioReported}
    />
  );
}

function FrequencyGoalsSection({
  dailyRoutines,
  loggingIds,
  onLog,
  weekStart,
}: {
  dailyRoutines: DailyRoutineStatus[];
  loggingIds: Set<string>;
  onLog: (id: bigint) => void;
  weekStart: string;
}) {
  // Filter to only frequency routines
  const freqItems = dailyRoutines.filter((item) =>
    isFrequencyRoutine(item.routine),
  );

  const weeklyItems = freqItems.filter((item) => {
    const meta = parseFrequencyMeta(item.routine.description);
    return meta?.period === "week";
  });

  const monthlyItems = freqItems.filter((item) => {
    const meta = parseFrequencyMeta(item.routine.description);
    return meta?.period === "month";
  });

  if (freqItems.length === 0) return null;

  return (
    <div className="space-y-8">
      <WeeklyTasksSortedSection
        items={weeklyItems}
        loggingIds={loggingIds}
        onLog={onLog}
        weekStart={weekStart}
      />
      <FrequencyPeriodSection
        items={monthlyItems}
        period="month"
        loggingIds={loggingIds}
        onLog={onLog}
        startIndex={weeklyItems.length}
        weekStart={weekStart}
      />
    </div>
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

function SuccessRatesPanel({
  allRoutines,
  weekStart,
  today,
}: {
  allRoutines: Routine[];
  weekStart: string;
  today: string;
}) {
  // Filter to fixed-day routines only
  const fixedRoutines = allRoutines.filter((r) => !isFrequencyRoutine(r));

  // Fetch all logs for fixed-day routines
  const { data: logs = [], isLoading: logsLoading } = useGetAllRoutineLogs(
    fixedRoutines.map((r) => r.id),
  );

  // Build week dates (7 days)
  const weekDates = getWeekDates(weekStart);

  // Per-day stats
  const dayStats = weekDates.map((dateStr) => {
    const isFuture = dateStr > today;
    const isToday = dateStr === today;
    const planned = countPlannedForDate(fixedRoutines, dateStr);
    const completed = isFuture
      ? 0
      : logs.filter((l) => l.date === dateStr && l.status === "completed")
          .length;
    const rate =
      isFuture || planned === 0
        ? null
        : Math.round((completed / planned) * 100);
    const dow = getDayOfWeekForDate(dateStr);
    const dayLabel = DAY_LABELS[dow] ?? "?";
    const dateNum = Number.parseInt(dateStr.split("-")[2]!, 10);
    return {
      dateStr,
      isFuture,
      isToday,
      planned,
      completed,
      rate,
      dayLabel,
      dateNum,
    };
  });

  // Weekly totals: sum up to and including today
  const pastDays = dayStats.filter((d) => !d.isFuture);
  const Y = pastDays.reduce((sum, d) => sum + d.planned, 0);
  const X = logs.filter(
    (l) => l.date >= weekStart && l.date <= today && l.status === "completed",
  ).length;
  const weeklyRate = Y > 0 ? Math.round((X / Y) * 100) : null;

  // Today's rate
  const todayStats = dayStats.find((d) => d.isToday);
  const dailyRate = todayStats?.rate ?? null;

  // Chart max height px
  const BAR_AREA_H = 120;

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
      className="rounded-2xl border border-border bg-card p-4 shadow-card-lift space-y-4"
      data-ocid="success_rates.section"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2
          className="w-4 h-4"
          style={{ color: "oklch(0.78 0.14 72)" }}
        />
        <span className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Success Rates
        </span>
      </div>

      {/* Stat pills */}
      <div className="flex gap-3">
        <RatePill
          label="Weekly Routine Success"
          rate={weeklyRate}
          ocid="success_rates.weekly_rate.card"
        />
        <RatePill
          label="Daily Success (Today)"
          rate={dailyRate}
          ocid="success_rates.daily_rate.card"
        />
      </div>

      {/* Bar chart */}
      <div
        className="rounded-xl border border-border/50 p-3"
        style={{ background: "oklch(0.13 0.008 260 / 0.6)" }}
        data-ocid="success_rates.chart.panel"
      >
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Daily Success Rate — This Week
        </p>
        <div
          className="flex items-end gap-1.5"
          style={{ height: `${BAR_AREA_H + 36}px` }}
        >
          {dayStats.map((day) => {
            const barColor = day.isToday
              ? "oklch(0.78 0.14 72)"
              : day.rate === null
                ? "oklch(0.28 0.015 255 / 0.5)"
                : getRateColor(day.rate);

            const barHeight =
              day.isFuture || day.planned === 0
                ? 8
                : Math.max(8, Math.round(((day.rate ?? 0) / 100) * BAR_AREA_H));

            return (
              <div
                key={day.dateStr}
                className="flex-1 flex flex-col items-center gap-0.5"
              >
                {/* "Today" label or percentage above bar */}
                <div
                  className="text-center leading-none"
                  style={{
                    height: "20px",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                  }}
                >
                  {day.isToday ? (
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                      style={{
                        background: "oklch(0.78 0.14 72 / 0.2)",
                        color: "oklch(0.78 0.14 72)",
                      }}
                    >
                      Today
                    </span>
                  ) : day.isFuture ? (
                    <span className="text-[9px] text-muted-foreground/40">
                      —
                    </span>
                  ) : day.planned === 0 ? (
                    <span className="text-[9px] text-muted-foreground/40 leading-none text-center">
                      no
                      <br />
                      tasks
                    </span>
                  ) : (
                    <span
                      className="text-[10px] font-semibold"
                      style={{ color: getRateColor(day.rate) }}
                    >
                      {day.rate}%
                    </span>
                  )}
                </div>

                {/* Bar */}
                <div
                  className="w-full flex items-end"
                  style={{ height: `${BAR_AREA_H}px` }}
                >
                  <div
                    className="w-full rounded-t-md transition-all duration-500"
                    style={{
                      height: `${barHeight}px`,
                      background: barColor,
                      opacity: day.isFuture ? 0.25 : 1,
                      border: day.isFuture
                        ? "1px solid oklch(0.4 0.015 255 / 0.5)"
                        : "none",
                      borderBottom: "none",
                      boxShadow: day.isToday
                        ? "0 0 12px oklch(0.78 0.14 72 / 0.35)"
                        : "none",
                    }}
                  />
                </div>

                {/* Day label */}
                <span
                  className="text-[10px] font-medium mt-1"
                  style={{
                    color: day.isToday
                      ? "oklch(0.78 0.14 72)"
                      : "oklch(0.55 0.012 255)",
                  }}
                >
                  {day.dayLabel}
                </span>
                <span
                  className="text-[9px]"
                  style={{ color: "oklch(0.42 0.012 255)" }}
                >
                  {day.dateNum}
                </span>
              </div>
            );
          })}
        </div>
      </div>
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
  const { mode: weekMode } = useWeekStartPreference();
  const weekStart = getWeekStartWithMode(weekMode);

  const { data: allRoutineData = [], isLoading } =
    useGetDailyRoutinesWithStatus(today);

  // Load all routines for reminder checking
  const { data: allRoutines = [] } = useGetAllRoutines();

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
          <SuccessRatesPanel
            allRoutines={allRoutines}
            weekStart={weekStart}
            today={today}
          />
        </div>
      )}

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
        {isLoading ? (
          <div className="space-y-6">
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
          <AnimatePresence mode="wait">
            <motion.div
              key={today}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Fixed-day routine groups: Overdue → Due Soon → Upcoming → Completed → Skipped */}
              {(
                [
                  "overdue",
                  "due-soon",
                  "upcoming",
                  "completed",
                  "skipped",
                ] as GroupKey[]
              ).map((key) => (
                <GroupSection
                  key={key}
                  groupKey={key}
                  items={groups[key]}
                  onDone={(id) => handleLog(id, "completed")}
                  onSkip={(id) => handleLog(id, "skipped")}
                  onUndo={handleUndo}
                  onMarkDone={handleMarkDone}
                  loggingIds={loggingIds}
                />
              ))}

              {/* Weekly / Monthly frequency goals section */}
              <FrequencyGoalsSection
                dailyRoutines={allRoutineData}
                loggingIds={loggingIds}
                onLog={(id) => handleLog(id, "completed")}
                weekStart={weekStart}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
