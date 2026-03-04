# Daily Routine Monitor

## Current State
The app has a Dashboard where users can mark tasks as "completed" or "skipped" for today. Once marked, there is no way to undo or change a task's status. The backend `logRoutine` always creates a new log entry, and `getDailyRoutinesWithStatus` returns the first matching log for a given routineId + date, so calling logRoutine again would not correct the status shown.

Completed and skipped tasks show their status as a badge but render no action buttons (canAct is false for those groups).

## Requested Changes (Diff)

### Add
- Backend: `updateRoutineLogStatus(routineId, date, newStatus)` — finds the existing log entry for a given routineId + date and updates its status in place. If no log exists, it creates a new one.
- Frontend: "Undo" / change-status buttons on completed and skipped task cards in the Dashboard.
  - Completed tasks → show an "Undo" button that resets the status back to incomplete (removes the log or sets it to a neutral status so the task re-appears as active).
  - Skipped tasks → show an "Undo" button to revert to pending, and optionally a "Mark Done" button to complete it.
- A `useUpdateRoutineLogStatus` hook in `useQueries.ts` that calls the new backend function.

### Modify
- `RoutineCard` component: allow action buttons for `completed` and `skipped` groups (an "Undo" button at minimum, and "Mark Done" for skipped).
- `getDailyRoutinesWithStatus` backend logic: updated to use the most recent log for a routineId+date combo (sort by loggedAt descending, take first) so re-logging reflects the latest status.

### Remove
- Nothing removed.

## Implementation Plan
1. Update backend `main.mo`:
   - Add `updateRoutineLogStatus(routineId, date, newStatus)` that finds the log entry for the given routineId+date and updates its status. Uses the most-recently-logged entry if multiple exist.
   - Update `getDailyRoutinesWithStatus` to return the most recent log (by loggedAt) for each routineId+date pair.
2. Add `useUpdateRoutineLogStatus` mutation hook to `useQueries.ts`.
3. Update `DashboardPage.tsx`:
   - Add `onUndo` and `onMarkDone` handlers that call `updateRoutineLogStatus`.
   - Pass these to `RoutineCard` and `GroupSection`.
   - `RoutineCard`: show "Undo" for completed and skipped; show "Mark Done" additionally for skipped.
   - Remove the `line-through` opacity treatment while the undo is in progress (loading state).
