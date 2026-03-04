import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { DailyRoutineStatus } from "../backend.d";
import { formatTime12h, isFrequencyRoutine } from "../utils/routineHelpers";

function getReminderWindowMinutes(value: bigint, unit: string): number {
  const n = Number(value);
  if (unit === "minutes") return n;
  if (unit === "hours") return n * 60;
  if (unit === "days") return n * 24 * 60;
  return 0;
}

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function useReminders(routines: DailyRoutineStatus[]) {
  const checkReminders = useCallback(() => {
    const now = new Date();
    const today = getTodayStr();

    for (const item of routines) {
      const { routine } = item;

      // Skip frequency routines and non-reminder routines
      if (!routine.reminderEnabled) continue;
      if (isFrequencyRoutine(routine)) continue;
      // Skip already completed/skipped
      if (item.status === "completed" || item.status === "skipped") continue;

      // Compute reminder time
      const offsetMinutes = getReminderWindowMinutes(
        routine.reminderOffset.value,
        routine.reminderOffset.unit,
      );

      // Parse scheduled time
      const [hStr, mStr] = routine.scheduledTime.split(":");
      const scheduledDate = new Date();
      scheduledDate.setHours(Number(hStr ?? 0), Number(mStr ?? 0), 0, 0);

      const reminderDate = new Date(
        scheduledDate.getTime() - offsetMinutes * 60 * 1000,
      );

      // Fire if now is between reminder time and scheduled time
      if (now >= reminderDate && now < scheduledDate) {
        const sessionKey = `reminded_${routine.id.toString()}_${today}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, "1");
          toast(
            `⏰ Reminder: ${routine.name} is due at ${formatTime12h(routine.scheduledTime)}`,
            {
              duration: 8000,
            },
          );
        }
      }
    }
  }, [routines]);

  // Check on mount
  useEffect(() => {
    checkReminders();
  }, [checkReminders]);

  // Check every 60 seconds
  useEffect(() => {
    const interval = setInterval(checkReminders, 60 * 1000);
    return () => clearInterval(interval);
  }, [checkReminders]);
}
