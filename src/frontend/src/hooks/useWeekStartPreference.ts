import { useState } from "react";
import type { WeekStartMode } from "../utils/routineHelpers";

const STORAGE_KEY = "weekStartMode";
const DEFAULT_MODE: WeekStartMode = "mon";

function isValidMode(v: string): v is WeekStartMode {
  return ["rolling7", "sun", "mon", "tue", "wed", "thu", "fri", "sat"].includes(
    v,
  );
}

export function useWeekStartPreference() {
  const [mode, setModeState] = useState<WeekStartMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isValidMode(stored)) return stored;
    return DEFAULT_MODE;
  });

  const setMode = (newMode: WeekStartMode) => {
    localStorage.setItem(STORAGE_KEY, newMode);
    setModeState(newMode);
  };

  return { mode, setMode };
}
