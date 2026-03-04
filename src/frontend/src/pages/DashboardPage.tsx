import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { DailyRoutineStatus } from "../backend.d";
import {
  useGetDailyRoutinesWithStatus,
  useLogRoutine,
} from "../hooks/useQueries";
import {
  formatDateFull,
  formatRepeatDays,
  formatTime12h,
  getTodayString,
  groupRoutines,
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

function RoutineCard({
  item,
  group,
  index,
  onDone,
  onSkip,
  isLogging,
}: {
  item: DailyRoutineStatus;
  group: GroupKey;
  index: number;
  onDone: () => void;
  onSkip: () => void;
  isLogging: boolean;
}) {
  const config = GROUP_CONFIG[group];
  const canAct = group !== "completed" && group !== "skipped";

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
            {item.routine.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                {item.routine.description}
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

        {/* Action buttons */}
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
      </div>
    </motion.div>
  );
}

function GroupSection({
  groupKey,
  items,
  onDone,
  onSkip,
  loggingIds,
}: {
  groupKey: GroupKey;
  items: DailyRoutineStatus[];
  onDone: (id: bigint) => void;
  onSkip: (id: bigint) => void;
  loggingIds: Set<string>;
}) {
  if (items.length === 0) return null;
  const config = GROUP_CONFIG[groupKey];
  const Icon = config.icon;

  return (
    <div>
      <div className={`flex items-center gap-2 mb-3 ${config.className}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-semibold uppercase tracking-wider">
          {config.label}
        </span>
        <span className="text-xs opacity-60">({items.length})</span>
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <RoutineCard
            key={item.routine.id.toString()}
            item={item}
            group={groupKey}
            index={i}
            onDone={() => onDone(item.routine.id)}
            onSkip={() => onSkip(item.routine.id)}
            isLogging={loggingIds.has(item.routine.id.toString())}
          />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage({
  onNavigateToRoutines,
  userName,
}: DashboardPageProps) {
  const today = getTodayString();
  const [now, setNow] = useState(new Date());
  const [loggingIds, setLoggingIds] = useState<Set<string>>(new Set());

  const { data: routines = [], isLoading } =
    useGetDailyRoutinesWithStatus(today);
  const logRoutine = useLogRoutine();

  // Refresh grouping every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const groups = groupRoutines(routines, now);

  const total = routines.length;
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

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const urgentCount = groups.overdue.length + groups["due-soon"].length;

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
              {total > 0 && (
                <span className="text-xs text-muted-foreground">
                  {progressPct}% complete
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

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
        ) : total === 0 ? (
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
                  loggingIds={loggingIds}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
