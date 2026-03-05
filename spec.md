# Daily Routine Monitor

## Current State

The app has:
- Routines stored in the backend with categories encoded in the description field as `__cat:Name__` metadata tags
- A SuccessRatesPanel on the dashboard that shows Weekly and Daily success rates calculated as a flat X/Y (completions/planned) across all fixed-day routines — no category distinction or weighting
- Category names stored in localStorage only (no weightage)
- Settings page for week definition (rolling 7 days, or anchored to a specific weekday)
- History page per routine

## Requested Changes (Diff)

### Add

- **Category weightage system**: Each category gets a user-assigned weight (%). Weights must sum to 100%. Stored in localStorage alongside category names.
- **Weighted success rate calculation**:
  - Category-level success = completions / planned for tasks in that category during the current period (week or day)
  - Overall success = weighted average of all category success rates (using user-defined category weights)
  - Both daily and weekly versions of this
- **Three-level drill-down success rate visualisation** in the dashboard:
  - **Level 1 (Overall)**: Single weighted success rate pill, clickable to expand
  - **Level 2 (Categories)**: Per-category success rate bars, each clickable to expand
  - **Level 3 (Tasks)**: Per-task completion progress within a category
  - Animated expand/collapse transitions between levels
- **Historical trend charts**:
  - Past N weeks chart: bar chart showing weekly weighted success rate per week, N configurable by user
  - Current week daily breakdown: bar chart showing success rate per day of the current week (exists but must now use category-weighted calculation)
- **N weeks setting**: User can define how many past weeks to show in the historical chart (default 4, range 1–12). Stored in localStorage.
- **Manage Category Weights dialog** in RoutinesPage: shows each category with an editable % weight input, validates sum = 100%, saves to localStorage.

### Modify

- **SuccessRatesPanel**: Replace flat calculation with weighted category average for both weekly and daily pills and the bar chart.
- **Category storage**: Extend from `string[]` to `{ name: string; weight: number }[]` in localStorage. Maintain backward compatibility when loading old format.
- **Settings page**: Add "Success Rate History" setting card with input for N weeks (1–12).

### Remove

- Nothing removed; existing flat success metric replaced by weighted one.

## Implementation Plan

1. **Extend category storage** in `routineHelpers.ts` and `RoutinesPage.tsx`:
   - Change localStorage format from `string[]` to `CategoryWithWeight[]` (`{ name: string; weight: number }`)
   - Provide migration: if old format detected, assign equal weights summing to 100
   - Export helpers: `loadCategoryWeights()`, `saveCategoryWeights()`, `getCategoryWeight(name)`

2. **Add weighted success calculation utilities** to `routineHelpers.ts`:
   - `computeCategorySuccessRate(routines, logs, categoryName, dateRange)` → `{ completions, planned, rate }`
   - `computeWeightedSuccessRate(routines, logs, categories, dateRange)` → `number | null`
   - `computeDailyWeightedRates(routines, logs, categories, weekDates)` → per-day rates
   - `computePastNWeeksRates(routines, logs, categories, weekMode, n)` → per-week rates

3. **Add N-weeks preference hook** `useNWeeksPreference.ts` — stores/reads from localStorage

4. **Redesign SuccessRatesPanel** in DashboardPage.tsx:
   - Three-level drill-down component
   - Level 1: overall weighted weekly + daily pills (clickable "Expand" caret)
   - Level 2: per-category cards with rate bar (clickable per category)
   - Level 3: per-task completion list within a category
   - Historical charts section: current week bar chart (weighted) + past N weeks bar chart
   - All computations use the new weighted helpers

5. **Add Category Weights editor** to RoutinesPage Manage Categories dialog:
   - Add a % weight column next to each category
   - Show running total; highlight red if total ≠ 100
   - Auto-redistribute button that equally divides 100% among all categories
   - Save button

6. **Update Settings page**: Add a card for "Success Rate History" with a 1–12 stepper/input for N weeks.
