import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  CheckCircle2,
  Flame,
  History,
  Trophy,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { RoutineLog } from "../backend.d";
import { useGetAllRoutines, useGetRoutineLogs } from "../hooks/useQueries";
import {
  calculateStreak,
  formatLogDate,
  formatTimestamp,
} from "../utils/routineHelpers";

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <Badge
        variant="secondary"
        className="gap-1 text-xs"
        style={{
          background: "oklch(0.72 0.16 150 / 0.15)",
          color: "oklch(0.72 0.16 150)",
        }}
      >
        <CheckCircle2 className="w-3 h-3" />
        Completed
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="gap-1 text-xs"
      style={{
        background: "oklch(0.28 0.015 255 / 0.5)",
        color: "oklch(0.58 0.015 255)",
      }}
    >
      <XCircle className="w-3 h-3" />
      Skipped
    </Badge>
  );
}

function LogEntry({ log, index }: { log: RoutineLog; index: number }) {
  const isCompleted = log.status === "completed";
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
        isCompleted
          ? "bg-card border-border"
          : "bg-card border-border opacity-60"
      }`}
      data-ocid={`history.item.${index + 1}`}
    >
      {/* Status icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: isCompleted
            ? "oklch(0.72 0.16 150 / 0.1)"
            : "oklch(0.28 0.015 255 / 0.5)",
        }}
      >
        {isCompleted ? (
          <CheckCircle2
            className="w-4 h-4"
            style={{ color: "oklch(0.72 0.16 150)" }}
          />
        ) : (
          <XCircle className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">
            {formatLogDate(log.date)}
          </p>
          <StatusBadge status={log.status} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Logged at {formatTimestamp(log.loggedAt)}
        </p>
      </div>
    </motion.div>
  );
}

function StreakCard({
  streak,
  totalCompleted,
}: { streak: number; totalCompleted: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <div
        className="rounded-xl border border-border p-4 flex flex-col gap-1"
        style={{ background: "oklch(0.78 0.14 72 / 0.05)" }}
      >
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4" style={{ color: "oklch(0.78 0.14 72)" }} />
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Streak
          </span>
        </div>
        <span className="text-3xl font-display font-bold text-foreground">
          {streak}
        </span>
        <span className="text-xs text-muted-foreground">
          {streak === 1 ? "day" : "days"} in a row
        </span>
      </div>

      <div
        className="rounded-xl border border-border p-4 flex flex-col gap-1"
        style={{ background: "oklch(0.72 0.16 150 / 0.05)" }}
      >
        <div className="flex items-center gap-2">
          <Trophy
            className="w-4 h-4"
            style={{ color: "oklch(0.72 0.16 150)" }}
          />
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Completions
          </span>
        </div>
        <span className="text-3xl font-display font-bold text-foreground">
          {totalCompleted}
        </span>
        <span className="text-xs text-muted-foreground">total sessions</span>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { data: routines = [], isLoading: routinesLoading } =
    useGetAllRoutines();
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>("");

  const selectedId = selectedRoutineId ? BigInt(selectedRoutineId) : null;
  const { data: logs = [], isLoading: logsLoading } =
    useGetRoutineLogs(selectedId);

  const selectedRoutine = routines.find(
    (r) => r.id.toString() === selectedRoutineId,
  );
  const streak = calculateStreak(logs);
  const totalCompleted = logs.filter((l) => l.status === "completed").length;

  // Sort logs newest first
  const sortedLogs = [...logs].sort((a, b) => {
    const aMs = Number(a.loggedAt / 1_000_000n);
    const bMs = Number(b.loggedAt / 1_000_000n);
    return bMs - aMs;
  });

  return (
    <div className="min-h-screen pb-20 md:pb-8" data-ocid="history.section">
      {/* Header */}
      <div
        className="px-4 md:px-8 py-6 border-b border-border"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.165 0.012 255) 0%, oklch(0.13 0.008 260) 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-display font-bold text-foreground">
            History
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Track your progress and streaks
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
        {/* Routine selector */}
        <div className="mb-6">
          <label
            htmlFor="history-routine-select"
            className="text-sm font-medium text-foreground/80 mb-2 block"
          >
            Select a routine
          </label>
          {routinesLoading ? (
            <Skeleton className="h-10 w-full bg-card rounded-lg" />
          ) : (
            <Select
              value={selectedRoutineId}
              onValueChange={setSelectedRoutineId}
            >
              <SelectTrigger
                id="history-routine-select"
                className="bg-card border-input w-full"
                data-ocid="history.routine.select"
              >
                <SelectValue placeholder="Choose a routine to view history..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {routines.map((r) => (
                  <SelectItem
                    key={r.id.toString()}
                    value={r.id.toString()}
                    className="text-popover-foreground"
                  >
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Content area */}
        <AnimatePresence mode="wait">
          {!selectedRoutineId ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
              data-ocid="history.empty_state"
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: "oklch(0.65 0.18 200 / 0.1)" }}
              >
                <History
                  className="w-10 h-10"
                  style={{ color: "oklch(0.65 0.18 200)" }}
                />
              </div>
              <h2 className="text-xl font-display font-bold text-foreground mb-2">
                Select a routine
              </h2>
              <p className="text-muted-foreground text-sm max-w-xs">
                Choose a routine from the dropdown above to see your log history
                and streak.
              </p>
            </motion.div>
          ) : logsLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
              data-ocid="history.loading_state"
            >
              <Skeleton className="h-20 w-full bg-card rounded-xl" />
              <div className="space-y-2.5 mt-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton
                    key={i}
                    className="h-16 w-full bg-card rounded-xl"
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={selectedRoutineId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {/* Routine name */}
              {selectedRoutine && (
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays
                    className="w-4 h-4"
                    style={{ color: "oklch(0.78 0.14 72)" }}
                  />
                  <h2 className="font-display font-bold text-foreground">
                    {selectedRoutine.name}
                  </h2>
                </div>
              )}

              {/* Stats */}
              <StreakCard streak={streak} totalCompleted={totalCompleted} />

              {/* Logs */}
              {sortedLogs.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border"
                  data-ocid="history.empty_state"
                >
                  <History className="w-8 h-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No logs yet for this routine.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Complete or skip the routine from the Dashboard to see
                    entries here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider font-medium">
                    {sortedLogs.length} log{" "}
                    {sortedLogs.length === 1 ? "entry" : "entries"}
                  </p>
                  {sortedLogs.map((log, i) => (
                    <LogEntry key={log.id.toString()} log={log} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
