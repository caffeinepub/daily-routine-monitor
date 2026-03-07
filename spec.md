# Daily Routine Monitor

## Current State

The app has:
- A `LoginPage` for Internet Identity auth
- A `DashboardPage` showing today's tasks grouped by status (overdue/due-soon/upcoming/completed/skipped), with 3-view-mode selector (Completion Wise, Category Wise, Frequency Wise) and a Success Rates panel with drill-down
- A `RoutinesPage` for adding/editing/deleting routines. Tasks use specific-days or flexible-frequency schedule modes. Manage Categories dialog with weight editing.
- A `HistoryPage` showing past logs
- A `SettingsPage` for week definition and n-weeks history
- `Layout.tsx` navigation: Dashboard, Routines, History, Settings
- Backend remains unchanged

## Requested Changes (Diff)

### Add

1. **Landing/Front Page** (shown to authenticated users before they enter the app — or as a dedicated page accessible from navigation) containing:
   - **Top section**: Broad objective — "An app to help you improve your Daily routine tasks", key benefits, and how to use the app (categories, tasks, logging, success rates)
   - **Bottom section**: Technical detail — how success rates are calculated (formulas, examples, colour thresholds)
   - Content sourced from the app overview writeup already produced in the conversation

2. **Category Definition Page** (new dedicated page replacing category management embedded in RoutinesPage):
   - User can define categories and assign weights (sum must = 100)
   - Encouragement message to define 3–5 categories (but any number allowed)
   - Inline warning if count < 3 or > 5 (not a hard block)
   - Full CRUD: add, rename, delete category
   - Weight assignment with auto-distribute and total indicator
   - Replaces the "Manage Categories" dialog currently in RoutinesPage

3. **Routine Task Definition Page** (replaces or becomes the Routines page with clearer structure):
   - Each task must be attached to a Category
   - Each task is classified as **Daily task** (planned every day) or **Non-daily task**
   - Daily task: scheduleMode = "specific" with all 7 days selected (Every day preset)
   - Non-daily task: either specific days (Mon/Wed/Fri etc.) OR flexible frequency (N times/week with exact days undefined)
   - The task type classification (Daily vs Non-daily) must be clearly visible in the form
   - Keep all existing fields: name, description, category, time, reminder

4. **Routine Task Updates Page** (becomes the Dashboard task-list area):
   - Three display modes: Category Wise, Completion Wise, Frequency Wise — tab selector remains prominent
   - Default: Completion Wise
   - All existing logic and rules unchanged

### Modify

1. **Navigation** (`Layout.tsx`): Replace current nav items with:
   - Home (landing page)
   - Dashboard (task updates + success rates)
   - Categories (new category definition page)
   - Tasks (routine task definition — renamed from "Routines")
   - History
   - Settings
   - Remove the embedded "Manage Categories" button/dialog from the Routines/Tasks page (it moves to the Categories page)

2. **App.tsx page routing**: Add `home` and `categories` page types, rename `routines` to `tasks`

3. **RoutinesPage**: 
   - Rename conceptually to "Tasks" page
   - Remove the Manage Categories button (functionality moves to Categories page)
   - Keep the Quick Assign per-row popover for assigning uncategorised tasks
   - Make task type (Daily / Non-daily) visually clear in both the form and task list

4. **DashboardPage**: 
   - The task list section remains (with 3 view modes)
   - Success Rates panel remains below header
   - The page is now called "Dashboard" and shows both the task updates AND success rates

### Remove

- "Manage Categories" button and dialog from RoutinesPage (moves to dedicated Categories page)

## Implementation Plan

1. Create `LandingPage.tsx` — a styled informational page with two clear sections: overview at top, calculation details at bottom. Use app overview content.

2. Create `CategoriesPage.tsx` — dedicated page with:
   - Encouragement banner for 3–5 categories
   - Add new category input
   - List of categories with inline rename, delete, weight inputs
   - Weight total indicator + Auto-distribute + Save Weights
   - Content migrated from ManageCategoriesDialog in RoutinesPage

3. Update `RoutinesPage.tsx` → keep as "Tasks" page:
   - Remove Manage Categories button/dialog
   - Add Daily / Non-daily task type selector in form (visual radio/toggle: "Daily (every day)" vs "Non-daily")
   - When "Daily" selected: force repeatDays to [0-6] and hide day pickers
   - When "Non-daily" selected: show specific-days or flexible-frequency options
   - Show Daily/Non-daily label on each task card in the list

4. Update `Layout.tsx`:
   - Add Home, Categories nav items
   - Rename Routines → Tasks
   - Update bottom mobile nav to show most useful 4 items

5. Update `App.tsx`:
   - Add `home` and `categories` to Page type
   - Route to new pages

6. Keep all backend calls, success rate logic, and data structures unchanged
