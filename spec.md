# Daily Routine Monitor

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- Daily routine tracker app that monitors and prompts users to complete their routines
- Routine management: create, edit, delete routines with name, description, scheduled time, and repeat days
- Dashboard showing today's routines with completion status
- Prompt/reminder system: visual alerts and in-app notifications when a routine is due
- Streak tracking per routine (consecutive days completed)
- Progress summary: daily completion percentage and streaks
- Routine completion logging (mark as done, skip)
- History view: past completion records per routine

### Modify
N/A

### Remove
N/A

## Implementation Plan

### Backend (Motoko)
- Data types: Routine (id, name, description, scheduledTime, repeatDays, createdAt), RoutineLog (id, routineId, date, status: completed/skipped)
- CRUD for routines: createRoutine, updateRoutine, deleteRoutine, getRoutines
- Logging: markRoutineCompleted, skipRoutine, getLogsForDate, getLogsForRoutine
- Streak computation: calculateStreak(routineId)
- Query today's routines with their completion status for the current date

### Frontend
- Dashboard page: shows today's routines sorted by scheduled time, with due/completed/skipped status badges
- Live clock with visual indicator when a routine is due (within ±15 min of scheduled time)
- Prompt banner or alert card highlighting routines that are overdue or due soon
- Routine management page: list, add, edit, delete routines
- History page: calendar or list view of past completions per routine
- Stats card: today's progress bar, current streaks per routine
- Navigation: Dashboard, Routines, History
