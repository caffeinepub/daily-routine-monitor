# Daily Routine Monitor

## Current State

The app categorizes routines into two types:
- **Fixed-day routines**: specific days of the week are selected (e.g. Mon/Wed/Fri). These are called "Daily Tasks" in the UI regardless of how many days are selected.
- **Flexible frequency routines**: N times per week or month, exact days not defined. These are called "Weekly Tasks".

The `isFrequencyRoutine()` helper in `routineHelpers.ts` identifies flexible frequency routines (those with a `__freq:...` prefix in description and all 7 days set).

The Dashboard's three view modes (Completion Wise, Category Wise, Frequency Wise) use the `FrequencyTypeHeader` component with type="daily" or "weekly" to label these two groups.

## Requested Changes (Diff)

### Add
- A new helper `isDailyRoutine(routine)` that returns true when a task is scheduled every day — i.e. either:
  - Specific-days mode with all 7 days selected, OR
  - Flexible frequency mode with period="week" and count=7
- A new helper `isWeeklyRoutine(routine)` (the inverse — any schedule that is NOT every day): specific days with fewer than 7 days, OR flexible frequency with count < 7 per week, OR any monthly frequency.

### Modify
- Replace usage of `isFrequencyRoutine` (which only identified flexible-frequency routines) with the new `isDailyRoutine` / `isWeeklyRoutine` classification wherever tasks are split into Daily vs Weekly groups in the Dashboard views.
- `FrequencyTypeHeader` type="daily" should now map to truly daily tasks; type="weekly" to tasks done less than every day.
- The label "Daily Tasks" should appear for routines done every day (all 7 days); "Weekly Tasks" for routines done less than 7 days per week.
- The Routines page listing should similarly apply correct Daily/Weekly badges/labels.
- `isFrequencyRoutine` itself is not removed — it is still needed to distinguish flexible-frequency from specific-days scheduling (for progress tracking and logging).
- The `formatRepeatDays` helper: when all 7 days are selected, it already returns "Every day" — no change needed.
- The `formatFrequencyLabel` helper: when count=7 and period="week" it already returns "Daily" — no change needed.

### Remove
- Nothing is removed from the data model or backend. This is purely a frontend classification/labeling change.

## Implementation Plan

1. Add `isDailyRoutine(routine: Routine): boolean` to `routineHelpers.ts`:
   - Returns true if specific-days mode with all 7 days, OR flexible-frequency mode with count=7 and period="week".
2. Update `DashboardPage.tsx` — all three views (CompletionWiseView, CategoryWiseView, FrequencyWiseView):
   - Replace the split of `fixedItems` vs `freqItems` (which used `isFrequencyRoutine`) with a split of `dailyItems` vs `weeklyItems` (which uses `isDailyRoutine`).
   - FrequencyGoalCard and RoutineCard rendering logic stays the same; only the grouping criterion changes.
   - Weekly tasks section (previously "Weekly Tasks" based on flexible frequency only) now includes ALL non-daily tasks: specific-days routines with fewer than 7 days AND flexible-frequency routines.
   - Daily tasks section now includes: specific-days routines with all 7 days AND flexible-frequency routines with count=7/week.
3. For the FrequencyGoalCard rendering: weekly-type flexible-frequency routines still use FrequencyGoalCard; daily-type flexible-frequency (count=7) uses RoutineCard (they appear daily so fixed-day card style applies). OR simpler: keep existing card type per isFrequencyRoutine, just change the grouping header.
4. The Routines page listing: update any "Daily" / "Weekly" labels/badges on routine cards to use the new classification.
5. Validate with typecheck and lint.
