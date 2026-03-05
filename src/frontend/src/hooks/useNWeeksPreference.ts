import { useState } from "react";

const STORAGE_KEY = "drm_n_weeks";
const DEFAULT_N = 4;
const MIN_N = 1;
const MAX_N = 12;

export function useNWeeksPreference() {
  const [nWeeks, setNWeeksState] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = Number.parseInt(stored, 10);
      if (!Number.isNaN(parsed) && parsed >= MIN_N && parsed <= MAX_N) {
        return parsed;
      }
    }
    return DEFAULT_N;
  });

  const setNWeeks = (n: number) => {
    const clamped = Math.max(MIN_N, Math.min(MAX_N, Math.round(n)));
    localStorage.setItem(STORAGE_KEY, clamped.toString());
    setNWeeksState(clamped);
  };

  return { nWeeks, setNWeeks, MIN_N, MAX_N };
}
