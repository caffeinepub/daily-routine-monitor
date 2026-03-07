import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Bell,
  BellOff,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  FolderInput,
  FolderOpen,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Tag,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { ReminderOffset, Routine, RoutineUpdate } from "../backend.d";
import {
  useCreateRoutine,
  useDeleteRoutine,
  useGetAllRoutines,
  useUpdateRoutine,
} from "../hooks/useQueries";
import {
  type CategoryWeight,
  DAY_LABELS,
  distributeEqualWeights,
  encodeCategoryMeta,
  encodeFrequencyMeta,
  formatFrequencyLabel,
  formatRepeatDays,
  formatTime12h,
  getCleanDescription,
  isFrequencyRoutine,
  loadCategoryWeights,
  parseCategoryMeta,
  parseFrequencyMeta,
  saveCategoryWeights,
  stripCategoryMeta,
  stripFrequencyMeta,
} from "../utils/routineHelpers";

// ─── Category Storage ─────────────────────────────────────────────────────────

const CATEGORIES_KEY = "drm_categories";

function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    // ignore
  }
  return [];
}

function saveCategories(cats: string[]): void {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
}

// ─── Form State ───────────────────────────────────────────────────────────────

type ScheduleMode = "specific" | "flexible";
type TaskType = "daily" | "nondaily";

interface RoutineFormData {
  name: string;
  description: string;
  scheduledTime: string;
  taskType: TaskType;
  scheduleMode: ScheduleMode;
  // specific days mode
  repeatDays: number[];
  // flexible frequency mode
  freqCount: number;
  freqPeriod: "week" | "month";
  // reminder
  reminderEnabled: boolean;
  reminderValue: number;
  reminderUnit: "minutes" | "hours" | "days";
  // category
  category: string;
}

const defaultForm: RoutineFormData = {
  name: "",
  description: "",
  scheduledTime: "08:00",
  taskType: "nondaily",
  scheduleMode: "specific",
  repeatDays: [1, 2, 3, 4, 5],
  freqCount: 3,
  freqPeriod: "week",
  reminderEnabled: false,
  reminderValue: 30,
  reminderUnit: "minutes",
  category: "",
};

const PRESETS = [
  { label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Weekends", days: [0, 6] },
  { label: "Mon/Wed/Fri", days: [1, 3, 5] },
  { label: "Tue/Thu", days: [2, 4] },
];

function inferTaskType(routine: Routine): TaskType {
  const freqMeta = parseFrequencyMeta(routine.description);
  if (freqMeta !== null) {
    // Flexible freq with 7×/week counts as daily
    return freqMeta.count === 7 && freqMeta.period === "week"
      ? "daily"
      : "nondaily";
  }
  // Specific days: daily if all 7 days selected
  const nums = routine.repeatDays.map(Number).sort();
  return nums.join(",") === "0,1,2,3,4,5,6" ? "daily" : "nondaily";
}

function formDataFromRoutine(routine: Routine): RoutineFormData {
  const freqMeta = parseFrequencyMeta(routine.description);
  const isFreq = freqMeta !== null;
  const reminderUnit =
    routine.reminderOffset.unit === "minutes" ||
    routine.reminderOffset.unit === "hours" ||
    routine.reminderOffset.unit === "days"
      ? (routine.reminderOffset.unit as "minutes" | "hours" | "days")
      : "minutes";

  const category = parseCategoryMeta(routine.description) ?? "";
  const taskType = inferTaskType(routine);

  return {
    name: routine.name,
    description: getCleanDescription(routine.description),
    scheduledTime: routine.scheduledTime,
    taskType,
    scheduleMode: isFreq ? "flexible" : "specific",
    repeatDays: isFreq ? [0, 1, 2, 3, 4, 5, 6] : routine.repeatDays.map(Number),
    freqCount: freqMeta?.count ?? 3,
    freqPeriod: freqMeta?.period ?? "week",
    reminderEnabled: routine.reminderEnabled,
    reminderValue: Number(routine.reminderOffset.value),
    reminderUnit,
    category,
  };
}

function buildRepeatDaysAndDescription(form: RoutineFormData): {
  repeatDays: bigint[];
  description: string;
} {
  // For daily tasks: always specific days mode with all 7 days, no freq prefix
  if (form.taskType === "daily") {
    const description = encodeCategoryMeta(
      form.category,
      form.description.trim(),
    );
    return {
      repeatDays: [0n, 1n, 2n, 3n, 4n, 5n, 6n],
      description,
    };
  }

  let baseDesc: string;
  if (form.scheduleMode === "flexible") {
    baseDesc = encodeFrequencyMeta(
      form.freqCount,
      form.freqPeriod,
      form.description.trim(),
    );
  } else {
    baseDesc = form.description.trim();
  }

  const description = encodeCategoryMeta(form.category, baseDesc);

  return {
    repeatDays:
      form.scheduleMode === "flexible"
        ? [0n, 1n, 2n, 3n, 4n, 5n, 6n]
        : [...form.repeatDays].sort().map(BigInt),
    description,
  };
}

function buildReminderOffset(form: RoutineFormData): ReminderOffset {
  if (!form.reminderEnabled) {
    return { value: 30n, unit: "minutes" };
  }
  return { value: BigInt(form.reminderValue), unit: form.reminderUnit };
}

// ─── Category Selector ────────────────────────────────────────────────────────

interface CategorySelectorProps {
  value: string;
  categories: string[];
  onChange: (cat: string) => void;
  onAddCategory: (cat: string) => void;
}

function CategorySelector({
  value,
  categories,
  onChange,
  onAddCategory,
}: CategorySelectorProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");

  const handleSelectChange = (val: string) => {
    if (val === "__new__") {
      setIsAddingNew(true);
      setNewCatInput("");
    } else {
      setIsAddingNew(false);
      onChange(val === "__none__" ? "" : val);
    }
  };

  const handleConfirmNew = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    onAddCategory(trimmed);
    onChange(trimmed);
    setIsAddingNew(false);
    setNewCatInput("");
  };

  const handleCancelNew = () => {
    setIsAddingNew(false);
    setNewCatInput("");
  };

  if (isAddingNew) {
    return (
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          placeholder="New category name..."
          value={newCatInput}
          onChange={(e) => setNewCatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleConfirmNew();
            }
            if (e.key === "Escape") handleCancelNew();
          }}
          className="bg-background border-input text-sm"
          maxLength={50}
          data-ocid="routine.category.input"
        />
        <Button
          type="button"
          size="sm"
          onClick={handleConfirmNew}
          className="shrink-0 h-9 px-3 font-semibold"
          style={{
            background: "oklch(0.78 0.14 72)",
            color: "oklch(0.12 0.008 260)",
          }}
          data-ocid="routine.category.confirm_button"
        >
          <Check className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleCancelNew}
          className="shrink-0 h-9 px-3 text-muted-foreground"
          data-ocid="routine.category.cancel_button"
        >
          ✕
        </Button>
      </div>
    );
  }

  return (
    <Select
      value={value === "" ? "__none__" : value}
      onValueChange={handleSelectChange}
    >
      <SelectTrigger
        className="w-full bg-background border-input"
        data-ocid="routine.category.select"
      >
        <div className="flex items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <SelectValue placeholder="Uncategorised" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground italic">Uncategorised</span>
        </SelectItem>
        {categories.map((cat) => (
          <SelectItem key={cat} value={cat}>
            {cat}
          </SelectItem>
        ))}
        <SelectItem value="__new__">
          <span
            className="flex items-center gap-1.5 font-medium"
            style={{ color: "oklch(0.78 0.14 72)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            New category...
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

// ─── Form Dialog ──────────────────────────────────────────────────────────────

interface RoutineFormDialogProps {
  open: boolean;
  onClose: () => void;
  editRoutine?: Routine | null;
  onSubmit: (data: RoutineFormData) => Promise<void>;
  isPending: boolean;
  categories: string[];
  onAddCategory: (cat: string) => void;
}

function RoutineFormDialog({
  open,
  onClose,
  editRoutine,
  onSubmit,
  isPending,
  categories,
  onAddCategory,
}: RoutineFormDialogProps) {
  const [form, setForm] = useState<RoutineFormData>(() =>
    editRoutine ? formDataFromRoutine(editRoutine) : defaultForm,
  );

  const [errors, setErrors] = useState<{ name?: string; freqCount?: string }>(
    {},
  );

  // Reset when editRoutine changes (e.g., opening a different edit)
  useEffect(() => {
    setForm(editRoutine ? formDataFromRoutine(editRoutine) : defaultForm);
    setErrors({});
  }, [editRoutine]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setErrors({});
    }
  };

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      repeatDays: prev.repeatDays.includes(day)
        ? prev.repeatDays.filter((d) => d !== day)
        : [...prev.repeatDays, day],
    }));
  };

  const applyPreset = (days: number[]) => {
    setForm((prev) => ({ ...prev, repeatDays: days }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { name?: string; freqCount?: string } = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
    if (form.scheduleMode === "flexible") {
      if (
        !Number.isInteger(form.freqCount) ||
        form.freqCount < 1 ||
        form.freqCount > 31
      ) {
        newErrors.freqCount = "Enter a number between 1 and 31";
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    await onSubmit(form);
  };

  const isPresetActive = (days: number[]) => {
    const sorted = [...form.repeatDays].sort().join(",");
    return sorted === [...days].sort().join(",");
  };

  const maxReminderValue =
    form.reminderUnit === "minutes"
      ? 1440
      : form.reminderUnit === "hours"
        ? 72
        : 30;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md bg-card border-border text-foreground max-h-[90vh] overflow-y-auto"
        data-ocid="routine.dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editRoutine ? "Edit Task" : "New Task"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {editRoutine
              ? "Update your task details."
              : "Set up a new habit to track."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="routine-name"
              className="text-sm text-foreground/80"
            >
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="routine-name"
              placeholder="e.g. Morning Meditation"
              value={form.name}
              onChange={(e) => {
                setForm((p) => ({ ...p, name: e.target.value }));
                if (errors.name)
                  setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              className="bg-background border-input"
              data-ocid="routine.input"
              maxLength={100}
            />
            {errors.name && (
              <p
                className="text-xs text-destructive"
                data-ocid="routine.error_state"
              >
                {errors.name}
              </p>
            )}
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <Label className="text-sm text-foreground/80">
              Task Type <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    taskType: "daily",
                    scheduleMode: "specific",
                    repeatDays: [0, 1, 2, 3, 4, 5, 6],
                  }))
                }
                className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${
                  form.taskType === "daily"
                    ? "border-transparent"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                }`}
                style={
                  form.taskType === "daily"
                    ? {
                        background: "oklch(0.78 0.14 72 / 0.12)",
                        borderColor: "oklch(0.78 0.14 72 / 0.5)",
                      }
                    : {}
                }
                data-ocid="routine.task_type.daily.toggle"
              >
                <span
                  className="text-xs font-bold"
                  style={
                    form.taskType === "daily"
                      ? { color: "oklch(0.78 0.14 72)" }
                      : {}
                  }
                >
                  Daily Task
                </span>
                <span className="text-[10px] leading-tight">
                  Done every day, 7 days a week
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    taskType: "nondaily",
                    repeatDays: [1, 2, 3, 4, 5],
                  }))
                }
                className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${
                  form.taskType === "nondaily"
                    ? "border-transparent"
                    : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                }`}
                style={
                  form.taskType === "nondaily"
                    ? {
                        background: "oklch(0.72 0.14 280 / 0.1)",
                        borderColor: "oklch(0.72 0.14 280 / 0.5)",
                      }
                    : {}
                }
                data-ocid="routine.task_type.nondaily.toggle"
              >
                <span
                  className="text-xs font-bold"
                  style={
                    form.taskType === "nondaily"
                      ? { color: "oklch(0.72 0.14 280)" }
                      : {}
                  }
                >
                  Non-daily Task
                </span>
                <span className="text-[10px] leading-tight">
                  Specific days or N times per week
                </span>
              </button>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground/80">Category</Label>
            <CategorySelector
              value={form.category}
              categories={categories}
              onChange={(cat) => setForm((p) => ({ ...p, category: cat }))}
              onAddCategory={(cat) => {
                onAddCategory(cat);
                setForm((p) => ({ ...p, category: cat }));
              }}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label
              htmlFor="routine-desc"
              className="text-sm text-foreground/80"
            >
              Description{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Textarea
              id="routine-desc"
              placeholder="Brief description or notes..."
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              className="bg-background border-input resize-none h-20"
              maxLength={300}
            />
          </div>

          {/* Time */}
          <div className="space-y-1.5">
            <Label
              htmlFor="routine-time"
              className="text-sm text-foreground/80"
            >
              Scheduled time
            </Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="routine-time"
                type="time"
                value={form.scheduledTime}
                onChange={(e) =>
                  setForm((p) => ({ ...p, scheduledTime: e.target.value }))
                }
                className="pl-9 bg-background border-input"
              />
            </div>
          </div>

          {/* Schedule Type Toggle — only for non-daily tasks */}
          {form.taskType === "daily" && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs"
              style={{
                background: "oklch(0.78 0.14 72 / 0.08)",
                border: "1px solid oklch(0.78 0.14 72 / 0.2)",
                color: "oklch(0.78 0.14 72)",
              }}
            >
              <CalendarDays className="w-3.5 h-3.5 shrink-0" />
              Daily tasks are automatically scheduled every day (all 7 days).
            </div>
          )}
          <div
            className={`space-y-3 ${form.taskType === "daily" ? "hidden" : ""}`}
          >
            <Label className="text-sm text-foreground/80">Schedule type</Label>
            <div className="flex gap-2 p-1 rounded-lg bg-background border border-border">
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({ ...p, scheduleMode: "specific" }))
                }
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                  form.scheduleMode === "specific"
                    ? "text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={
                  form.scheduleMode === "specific"
                    ? { background: "oklch(0.78 0.14 72)" }
                    : {}
                }
                data-ocid="routine.schedule_mode.toggle"
              >
                <CalendarDays className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                Specific Days
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({ ...p, scheduleMode: "flexible" }))
                }
                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                  form.scheduleMode === "flexible"
                    ? "text-black shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={
                  form.scheduleMode === "flexible"
                    ? { background: "oklch(0.78 0.14 72)" }
                    : {}
                }
              >
                <RefreshCw className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                Flexible Frequency
              </button>
            </div>

            {/* Specific Days Mode */}
            {form.scheduleMode === "specific" && (
              <div className="space-y-2.5">
                {/* Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset.days)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                        isPresetActive(preset.days)
                          ? "border-transparent text-black"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                      }`}
                      style={
                        isPresetActive(preset.days)
                          ? { background: "oklch(0.78 0.14 72)" }
                          : {}
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Day checkboxes */}
                <div className="flex gap-2">
                  {DAY_LABELS.map((label, i) => {
                    const checked = form.repeatDays.includes(i);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-all border ${
                          checked
                            ? "border-transparent text-black"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                        style={
                          checked ? { background: "oklch(0.78 0.14 72)" } : {}
                        }
                      >
                        {label[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Flexible Frequency Mode */}
            {form.scheduleMode === "flexible" && (
              <div className="rounded-lg border border-border p-3 space-y-3 bg-background/50">
                <p className="text-xs text-muted-foreground">
                  Set how often you want to do this task. The exact days are up
                  to you — just log it when you do it.
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={form.freqCount}
                      onChange={(e) => {
                        const val = Number.parseInt(e.target.value, 10);
                        setForm((p) => ({
                          ...p,
                          freqCount: Number.isNaN(val) ? 1 : val,
                        }));
                        if (errors.freqCount)
                          setErrors((prev) => ({
                            ...prev,
                            freqCount: undefined,
                          }));
                      }}
                      className="w-16 bg-background border-input text-center"
                      data-ocid="routine.freq_count.input"
                    />
                    <span className="text-sm text-muted-foreground">
                      times per
                    </span>
                    <Select
                      value={form.freqPeriod}
                      onValueChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          freqPeriod: v as "week" | "month",
                        }))
                      }
                    >
                      <SelectTrigger
                        className="w-24 bg-background border-input"
                        data-ocid="routine.freq_period.select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {errors.freqCount && (
                  <p className="text-xs text-destructive">{errors.freqCount}</p>
                )}
                <div
                  className="text-xs px-2.5 py-1.5 rounded-md inline-flex items-center gap-1.5"
                  style={{
                    background: "oklch(0.78 0.14 72 / 0.1)",
                    color: "oklch(0.78 0.14 72)",
                  }}
                >
                  <RefreshCw className="w-3 h-3" />
                  {formatFrequencyLabel(form.freqCount, form.freqPeriod)}
                </div>
              </div>
            )}
          </div>
          {/* end nondaily schedule wrapper */}

          {/* Reminder Section */}
          <div
            className="rounded-lg border border-border p-3 space-y-3"
            style={{
              background: form.reminderEnabled
                ? "oklch(0.78 0.14 72 / 0.04)"
                : undefined,
              borderColor: form.reminderEnabled
                ? "oklch(0.78 0.14 72 / 0.3)"
                : undefined,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {form.reminderEnabled ? (
                  <Bell
                    className="w-4 h-4"
                    style={{ color: "oklch(0.78 0.14 72)" }}
                  />
                ) : (
                  <BellOff className="w-4 h-4 text-muted-foreground" />
                )}
                <Label
                  htmlFor="reminder-switch"
                  className="text-sm font-medium cursor-pointer"
                  style={
                    form.reminderEnabled ? { color: "oklch(0.78 0.14 72)" } : {}
                  }
                >
                  Remind me
                </Label>
              </div>
              <Switch
                id="reminder-switch"
                checked={form.reminderEnabled}
                onCheckedChange={(checked) =>
                  setForm((p) => ({ ...p, reminderEnabled: checked }))
                }
                data-ocid="routine.reminder.switch"
              />
            </div>

            {form.reminderEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <p className="text-xs text-muted-foreground">
                  Remind me this long before the scheduled time:
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={maxReminderValue}
                    value={form.reminderValue}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setForm((p) => ({
                        ...p,
                        reminderValue: Number.isNaN(val) ? 1 : Math.max(1, val),
                      }));
                    }}
                    className="w-20 bg-background border-input text-center"
                    data-ocid="routine.reminder.value.input"
                  />
                  <Select
                    value={form.reminderUnit}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        reminderUnit: v as "minutes" | "hours" | "days",
                        reminderValue: Math.min(
                          p.reminderValue,
                          v === "minutes" ? 1440 : v === "hours" ? 72 : 30,
                        ),
                      }))
                    }
                  >
                    <SelectTrigger
                      className="w-36 bg-background border-input"
                      data-ocid="routine.reminder.unit.select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">minutes before</SelectItem>
                      <SelectItem value="hours">hours before</SelectItem>
                      <SelectItem value="days">days before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            )}
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 sm:flex-none"
              data-ocid="routine.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 sm:flex-none font-semibold"
              style={{
                background: "oklch(0.78 0.14 72)",
                color: "oklch(0.12 0.008 260)",
              }}
              data-ocid="routine.submit_button"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-1.5 w-3.5 h-3.5" />
                  {editRoutine ? "Update" : "Create"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Manage Categories Dialog ─────────────────────────────────────────────────

interface ManageCategoriesDialogProps {
  open: boolean;
  onClose: () => void;
  categories: string[];
  routines: Routine[];
  onRenameCategory: (oldName: string, newName: string) => Promise<void>;
  onDeleteCategory: (name: string) => Promise<void>;
  isUpdating: boolean;
}

function ManageCategoriesDialog({
  open,
  onClose,
  categories,
  routines,
  onRenameCategory,
  onDeleteCategory,
  isUpdating,
}: ManageCategoriesDialogProps) {
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Category weights state — loaded fresh when dialog opens
  const [weights, setWeights] = useState<CategoryWeight[]>(() =>
    loadCategoryWeights(),
  );

  // Re-sync weights when categories list changes (e.g., new category added)
  useEffect(() => {
    if (!open) return;
    const saved = loadCategoryWeights();
    const merged: CategoryWeight[] = categories.map((cat) => {
      const existing = saved.find((w) => w.name === cat);
      return existing ?? { name: cat, weight: 0 };
    });
    setWeights(merged);
  }, [open, categories]);

  const totalWeight = weights.reduce((sum, w) => sum + (w.weight || 0), 0);
  const isValidTotal = Math.round(totalWeight) === 100;

  const handleWeightChange = (catName: string, rawValue: string) => {
    const parsed = Number.parseFloat(rawValue);
    const value = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
    setWeights((prev) =>
      prev.map((w) => (w.name === catName ? { ...w, weight: value } : w)),
    );
  };

  const handleAutoDistribute = () => {
    if (categories.length === 0) return;
    const distributed = distributeEqualWeights(categories);
    setWeights(distributed);
  };

  const handleSaveWeights = () => {
    saveCategoryWeights(weights);
    toast.success("Category weights saved");
  };

  const countForCategory = (cat: string) =>
    routines.filter((r) => parseCategoryMeta(r.description) === cat).length;

  const handleStartRename = (cat: string) => {
    setEditingCat(cat);
    setRenameValue(cat);
  };

  const handleConfirmRename = async () => {
    if (!editingCat || !renameValue.trim() || renameValue.trim() === editingCat)
      return;
    await onRenameCategory(editingCat, renameValue.trim());
    setEditingCat(null);
    setRenameValue("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md bg-card border-border text-foreground max-h-[90vh] overflow-y-auto"
        data-ocid="categories.dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <Settings2
              className="w-4 h-4"
              style={{ color: "oklch(0.78 0.14 72)" }}
            />
            Manage Categories
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Rename, delete, or assign weights to your task categories.
          </DialogDescription>
        </DialogHeader>

        {/* Category list with weight inputs */}
        <div className="space-y-2 mt-2">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No categories yet. Add one when creating a routine.
            </p>
          ) : (
            <>
              {/* Column headers */}
              <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="flex-1">Category</span>
                <span className="w-16 text-center">Weight %</span>
                <span className="w-14 text-right">Routines</span>
                <span className="w-14" />
              </div>

              {categories.map((cat, idx) => {
                const count = countForCategory(cat);
                const isEditing = editingCat === cat;
                const weightEntry = weights.find((w) => w.name === cat);
                const currentWeight = weightEntry?.weight ?? 0;

                return (
                  <div
                    key={cat}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background/50"
                    data-ocid={`categories.item.${idx + 1}`}
                  >
                    <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleConfirmRename();
                          }
                          if (e.key === "Escape") setEditingCat(null);
                        }}
                        className="h-7 text-sm bg-background border-input flex-1"
                        maxLength={50}
                        data-ocid="categories.rename.input"
                      />
                    ) : (
                      <span className="flex-1 text-sm font-medium truncate min-w-0">
                        {cat}
                      </span>
                    )}

                    {/* Weight input */}
                    {!isEditing && (
                      <div className="w-16 shrink-0">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={currentWeight}
                          onChange={(e) =>
                            handleWeightChange(cat, e.target.value)
                          }
                          className="h-7 w-full text-center text-sm bg-background border-input px-1"
                          data-ocid={`categories.weight.input.${idx + 1}`}
                        />
                      </div>
                    )}

                    <span className="text-xs text-muted-foreground shrink-0 w-14 text-right">
                      {count} {count === 1 ? "routine" : "routines"}
                    </span>

                    {isEditing ? (
                      <div className="flex items-center gap-1 shrink-0 w-14 justify-end">
                        <Button
                          size="icon"
                          className="w-6 h-6"
                          style={{
                            background: "oklch(0.78 0.14 72)",
                            color: "oklch(0.12 0.008 260)",
                          }}
                          onClick={handleConfirmRename}
                          disabled={isUpdating}
                          data-ocid="categories.rename.confirm_button"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-6 h-6 text-muted-foreground"
                          onClick={() => setEditingCat(null)}
                          data-ocid="categories.rename.cancel_button"
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0 w-14 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleStartRename(cat)}
                          disabled={isUpdating}
                          data-ocid={`categories.edit_button.${idx + 1}`}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDelete(cat)}
                          disabled={isUpdating}
                          data-ocid={`categories.delete_button.${idx + 1}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Weight total + controls */}
              {categories.length > 0 && (
                <div
                  className="px-3 py-2.5 rounded-lg border space-y-2"
                  style={{
                    background: isValidTotal
                      ? "oklch(0.72 0.16 150 / 0.06)"
                      : "oklch(0.65 0.2 28 / 0.06)",
                    borderColor: isValidTotal
                      ? "oklch(0.72 0.16 150 / 0.3)"
                      : "oklch(0.65 0.2 28 / 0.3)",
                  }}
                  data-ocid="categories.weight_total.card"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      Total weight
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{
                        color: isValidTotal
                          ? "oklch(0.72 0.16 150)"
                          : "oklch(0.65 0.2 28)",
                      }}
                    >
                      {totalWeight}%
                      {!isValidTotal && (
                        <span className="text-xs font-normal ml-1">
                          (must equal 100%)
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs border-border gap-1"
                      onClick={handleAutoDistribute}
                      data-ocid="categories.auto_distribute.button"
                    >
                      Auto-distribute
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!isValidTotal}
                      className="flex-1 h-8 text-xs font-semibold gap-1"
                      style={
                        isValidTotal
                          ? {
                              background: "oklch(0.78 0.14 72)",
                              color: "oklch(0.12 0.008 260)",
                            }
                          : {}
                      }
                      onClick={handleSaveWeights}
                      data-ocid="categories.save_weights.button"
                    >
                      <Check className="w-3 h-3" />
                      Save Weights
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full"
            data-ocid="categories.close_button"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent
          className="bg-card border-border text-foreground"
          data-ocid="categories.delete.dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete Category?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Delete{" "}
              <span className="font-semibold text-foreground">
                "{confirmDelete}"
              </span>
              ? Routines in this category will become Uncategorised.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-border text-foreground"
              data-ocid="categories.delete.cancel_button"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmDelete) {
                  await onDeleteCategory(confirmDelete);
                  setConfirmDelete(null);
                }
              }}
              disabled={isUpdating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="categories.delete.confirm_button"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 w-3.5 h-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

// ─── Assign Uncategorised Dialog ──────────────────────────────────────────────

interface AssignUncategorisedDialogProps {
  open: boolean;
  onClose: () => void;
  uncategorisedRoutines: Routine[];
  categories: string[];
  onAddCategory: (cat: string) => void;
  onAssign: (routineIds: bigint[], category: string) => Promise<void>;
  isAssigning: boolean;
}

function AssignUncategorisedDialog({
  open,
  onClose,
  uncategorisedRoutines,
  categories,
  onAddCategory,
  onAssign,
  isAssigning,
}: AssignUncategorisedDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(uncategorisedRoutines.map((r) => r.id.toString())),
  );
  const [targetCategory, setTargetCategory] = useState<string>("");

  // Reset when dialog opens/routines change
  useEffect(() => {
    if (open) {
      setSelectedIds(
        new Set(uncategorisedRoutines.map((r) => r.id.toString())),
      );
      setTargetCategory("");
    }
  }, [open, uncategorisedRoutines]);

  const toggleRoutine = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === uncategorisedRoutines.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(
        new Set(uncategorisedRoutines.map((r) => r.id.toString())),
      );
    }
  };

  const handleConfirm = async () => {
    if (!targetCategory || selectedIds.size === 0) return;
    const ids = uncategorisedRoutines
      .filter((r) => selectedIds.has(r.id.toString()))
      .map((r) => r.id);
    await onAssign(ids, targetCategory);
  };

  const allChecked = selectedIds.size === uncategorisedRoutines.length;
  const someChecked =
    selectedIds.size > 0 && selectedIds.size < uncategorisedRoutines.length;
  const canConfirm = targetCategory.trim() !== "" && selectedIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md bg-card border-border text-foreground"
        data-ocid="uncategorised.assign.dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <FolderInput
              className="w-4 h-4"
              style={{ color: "oklch(0.78 0.14 72)" }}
            />
            Assign to Category
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Move selected uncategorised routines into a category.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Category picker */}
          <div className="space-y-1.5">
            <Label className="text-sm text-foreground/80">
              Target category
            </Label>
            <CategorySelector
              value={targetCategory}
              categories={categories}
              onChange={setTargetCategory}
              onAddCategory={(cat) => {
                onAddCategory(cat);
                setTargetCategory(cat);
              }}
            />
          </div>

          {/* Routine list with checkboxes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-foreground/80">
                Routines to move
              </Label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-medium transition-colors"
                style={{ color: "oklch(0.78 0.14 72)" }}
              >
                {allChecked ? "Deselect all" : "Select all"}
              </button>
            </div>

            {/* Select-all checkbox row */}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background/60 border border-border/50">
              <Checkbox
                id="assign-select-all"
                checked={
                  allChecked ? true : someChecked ? "indeterminate" : false
                }
                onCheckedChange={toggleAll}
                className="border-border"
              />
              <Label
                htmlFor="assign-select-all"
                className="text-xs text-muted-foreground cursor-pointer select-none font-medium"
              >
                {selectedIds.size} of {uncategorisedRoutines.length} selected
              </Label>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
              {uncategorisedRoutines.map((routine, i) => {
                const idStr = routine.id.toString();
                const checked = selectedIds.has(idStr);
                return (
                  <label
                    key={idStr}
                    htmlFor={`assign-routine-${i}`}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors cursor-pointer ${
                      checked
                        ? "border-border bg-background/80"
                        : "border-transparent bg-transparent hover:bg-background/40"
                    }`}
                  >
                    <Checkbox
                      id={`assign-routine-${i}`}
                      checked={checked}
                      onCheckedChange={() => toggleRoutine(idStr)}
                      className="border-border shrink-0"
                      data-ocid={`uncategorised.assign.routine.checkbox.${i + 1}`}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground truncate block">
                        {routine.name}
                      </span>
                      {getCleanDescription(routine.description) && (
                        <span className="text-xs text-muted-foreground truncate block">
                          {getCleanDescription(routine.description)}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1 sm:flex-none"
            data-ocid="uncategorised.assign.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canConfirm || isAssigning}
            onClick={handleConfirm}
            className="flex-1 sm:flex-none font-semibold"
            style={{
              background: canConfirm ? "oklch(0.78 0.14 72)" : undefined,
              color: canConfirm ? "oklch(0.12 0.008 260)" : undefined,
            }}
            data-ocid="uncategorised.assign.confirm_button"
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 w-3.5 h-3.5 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <FolderInput className="mr-1.5 w-3.5 h-3.5" />
                Assign {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Quick Assign Popover (per-row) ───────────────────────────────────────────

interface QuickAssignPopoverProps {
  routineIndex: number;
  categories: string[];
  onAddCategory: (cat: string) => void;
  onAssign: (category: string) => Promise<void>;
  isAssigning: boolean;
}

function QuickAssignPopover({
  routineIndex,
  categories,
  onAddCategory,
  onAssign,
  isAssigning,
}: QuickAssignPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState("");

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setSelectedCat("");
  };

  const handleConfirm = async () => {
    if (!selectedCat) return;
    await onAssign(selectedCat);
    setOpen(false);
    setSelectedCat("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="w-8 h-8 text-muted-foreground hover:text-foreground"
          title="Assign to category"
          data-ocid={`routine.assign_category.button.${routineIndex + 1}`}
        >
          <Tag className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3 bg-card border-border shadow-lg"
        align="end"
        data-ocid="routine.assign_category.popover"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Tag
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: "oklch(0.78 0.14 72)" }}
            />
            <p className="text-sm font-semibold text-foreground">
              Assign category
            </p>
          </div>
          <CategorySelector
            value={selectedCat}
            categories={categories}
            onChange={setSelectedCat}
            onAddCategory={(cat) => {
              onAddCategory(cat);
              setSelectedCat(cat);
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-1 text-muted-foreground"
              onClick={() => handleOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedCat || isAssigning}
              onClick={handleConfirm}
              className="flex-1 font-semibold"
              style={
                selectedCat
                  ? {
                      background: "oklch(0.78 0.14 72)",
                      color: "oklch(0.12 0.008 260)",
                    }
                  : {}
              }
            >
              {isAssigning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Assign
                </>
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Routine Row ──────────────────────────────────────────────────────────────

interface RoutineRowProps {
  routine: Routine;
  index: number;
  onEdit: (routine: Routine) => void;
  onDelete: (routine: Routine) => void;
  onAssignCategory?: (routine: Routine, category: string) => Promise<void>;
  categories?: string[];
  onAddCategory?: (cat: string) => void;
  isAssigningCategory?: boolean;
}

function formatReminderChip(routine: Routine): string {
  const { value, unit } = routine.reminderOffset;
  const n = Number(value);
  if (unit === "minutes") return `${n} min before`;
  if (unit === "hours") return `${n}h before`;
  if (unit === "days") return `${n} day${n !== 1 ? "s" : ""} before`;
  return "";
}

function RoutineRow({
  routine,
  index,
  onEdit,
  onDelete,
  onAssignCategory,
  categories = [],
  onAddCategory,
  isAssigningCategory = false,
}: RoutineRowProps) {
  const isFreq = isFrequencyRoutine(routine);
  const freqMeta = isFreq ? parseFrequencyMeta(routine.description) : null;
  const displayDescription = getCleanDescription(routine.description);
  const category = parseCategoryMeta(routine.description);
  const isUncategorised = !category;
  // Determine if this is a "Daily" or "Non-daily" task for badge display
  const isDaily = (() => {
    if (isFreq && freqMeta) {
      return freqMeta.count === 7 && freqMeta.period === "week";
    }
    const nums = routine.repeatDays.map(Number).sort();
    return nums.join(",") === "0,1,2,3,4,5,6";
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="bg-card border border-border rounded-xl px-4 py-3.5 flex items-start gap-3 hover:border-foreground/10 transition-colors"
      data-ocid={`routine.item.${index + 1}`}
    >
      {/* Time indicator */}
      <div
        className="w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 text-center mt-0.5"
        style={{ background: "oklch(0.78 0.14 72 / 0.1)" }}
      >
        {isFreq ? (
          <RefreshCw
            className="w-3.5 h-3.5"
            style={{ color: "oklch(0.78 0.14 72)" }}
          />
        ) : (
          <Clock
            className="w-3.5 h-3.5 mb-0.5"
            style={{ color: "oklch(0.78 0.14 72)" }}
          />
        )}
        <span
          className="text-[9px] font-mono font-bold leading-none mt-0.5"
          style={{ color: "oklch(0.78 0.14 72)" }}
        >
          {formatTime12h(routine.scheduledTime).replace(" ", "\n")}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-sm text-foreground truncate">
            {routine.name}
          </h3>
          {/* Daily / Non-daily badge */}
          <span
            className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
            style={
              isDaily
                ? {
                    background: "oklch(0.78 0.14 72 / 0.15)",
                    color: "oklch(0.78 0.14 72)",
                  }
                : {
                    background: "oklch(0.14 0.01 260)",
                    color: "oklch(0.55 0.01 260)",
                    border: "1px solid oklch(0.28 0.015 255)",
                  }
            }
          >
            {isDaily ? "Daily" : "Non-daily"}
          </span>
          {category && (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
              style={{
                background: "oklch(0.55 0.14 280 / 0.15)",
                color: "oklch(0.72 0.14 280)",
              }}
            >
              <Tag className="w-2.5 h-2.5" />
              {category}
            </span>
          )}
          {routine.reminderEnabled && (
            <div
              className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                background: "oklch(0.78 0.14 72 / 0.12)",
                color: "oklch(0.78 0.14 72)",
              }}
              title={`Reminder: ${formatReminderChip(routine)}`}
            >
              <Bell className="w-2.5 h-2.5" />
              {formatReminderChip(routine)}
            </div>
          )}
        </div>

        {displayDescription && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {displayDescription}
          </p>
        )}

        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {isFreq && freqMeta ? (
            <>
              <RefreshCw className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-muted-foreground">
                {formatFrequencyLabel(freqMeta.count, freqMeta.period)}
              </span>
              <Badge
                variant="secondary"
                className="text-[9px] px-1.5 py-0 h-4 ml-0.5"
                style={{
                  background: "oklch(0.78 0.14 72 / 0.1)",
                  color: "oklch(0.78 0.14 72)",
                }}
              >
                flexible
              </Badge>
            </>
          ) : (
            <>
              <CalendarDays className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-muted-foreground">
                {formatRepeatDays(routine.repeatDays)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {isUncategorised && onAssignCategory && onAddCategory && (
          <QuickAssignPopover
            routineIndex={index}
            categories={categories}
            onAddCategory={onAddCategory}
            onAssign={(cat) => onAssignCategory(routine, cat)}
            isAssigning={isAssigningCategory}
          />
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onEdit(routine)}
          className="w-8 h-8 text-muted-foreground hover:text-foreground"
          data-ocid={`routine.edit_button.${index + 1}`}
        >
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(routine)}
          className="w-8 h-8 text-muted-foreground hover:text-destructive"
          data-ocid={`routine.delete_button.${index + 1}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Category Group Section ───────────────────────────────────────────────────

interface CategoryGroupProps {
  categoryName: string;
  routines: Routine[];
  startIndex: number;
  onEdit: (routine: Routine) => void;
  onDelete: (routine: Routine) => void;
  onAssignCategory?: (routine: Routine, category: string) => Promise<void>;
  onBulkAssign?: () => void;
  categories?: string[];
  onAddCategory?: (cat: string) => void;
  isAssigningCategory?: boolean;
}

function CategoryGroup({
  categoryName,
  routines,
  startIndex,
  onEdit,
  onDelete,
  onAssignCategory,
  onBulkAssign,
  categories,
  onAddCategory,
  isAssigningCategory,
}: CategoryGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isUncategorised = categoryName === "Uncategorised";

  return (
    <div className="space-y-2">
      {/* Category header */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex-1 flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-foreground/5 transition-colors group"
          data-ocid={`category.${categoryName.toLowerCase().replace(/[^a-z0-9]/g, "_")}.toggle`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FolderOpen
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: "oklch(0.72 0.14 280)" }}
            />
            <span
              className="text-xs font-semibold uppercase tracking-wider truncate"
              style={{ color: "oklch(0.72 0.14 280)" }}
            >
              {categoryName}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
              style={{
                background: "oklch(0.55 0.14 280 / 0.12)",
                color: "oklch(0.72 0.14 280)",
              }}
            >
              {routines.length}
            </span>
          </div>
          <div className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
            {collapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </div>
        </button>

        {/* Assign to category button — only for Uncategorised */}
        {isUncategorised && onBulkAssign && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onBulkAssign();
            }}
            className="h-7 px-2.5 text-xs gap-1.5 shrink-0 font-medium transition-colors"
            style={{ color: "oklch(0.78 0.14 72)" }}
            title="Assign all uncategorised to a category"
            data-ocid="uncategorised.assign_button"
          >
            <FolderInput className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Assign to category</span>
          </Button>
        )}
      </div>

      {/* Routines in this group */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 pl-2 border-l-2"
            style={{ borderColor: "oklch(0.55 0.14 280 / 0.25)" }}
          >
            {routines.map((routine, i) => (
              <RoutineRow
                key={routine.id.toString()}
                routine={routine}
                index={startIndex + i}
                onEdit={onEdit}
                onDelete={onDelete}
                onAssignCategory={
                  isUncategorised ? onAssignCategory : undefined
                }
                categories={categories}
                onAddCategory={onAddCategory}
                isAssigningCategory={isAssigningCategory}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoutinesPage() {
  const { data: routines = [], isLoading } = useGetAllRoutines();
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();

  const [categories, setCategories] = useState<string[]>(() =>
    loadCategories(),
  );
  const [showForm, setShowForm] = useState(false);
  const [editRoutine, setEditRoutine] = useState<Routine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [isCategoryUpdating, setIsCategoryUpdating] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const addCategory = (cat: string) => {
    if (!cat.trim() || categories.includes(cat.trim())) return;
    const updated = [...categories, cat.trim()];
    setCategories(updated);
    saveCategories(updated);
  };

  const handleCreate = async (data: RoutineFormData) => {
    const { repeatDays, description } = buildRepeatDaysAndDescription(data);
    const reminderOffset = buildReminderOffset(data);
    try {
      await createRoutine.mutateAsync({
        name: data.name.trim(),
        description,
        scheduledTime: data.scheduledTime,
        repeatDays,
        reminderEnabled: data.reminderEnabled,
        reminderOffset,
      });
      toast.success(`"${data.name}" routine created!`);
      setShowForm(false);
    } catch {
      toast.error("Failed to create routine. Try again.");
    }
  };

  const handleUpdate = async (data: RoutineFormData) => {
    if (!editRoutine) return;
    const { repeatDays, description } = buildRepeatDaysAndDescription(data);
    const reminderOffset = buildReminderOffset(data);
    const updates: RoutineUpdate = {
      name: data.name.trim(),
      description,
      scheduledTime: data.scheduledTime,
      repeatDays,
      reminderEnabled: data.reminderEnabled,
      reminderOffset,
    };
    try {
      await updateRoutine.mutateAsync({ id: editRoutine.id, updates });
      toast.success("Routine updated!");
      setEditRoutine(null);
    } catch {
      toast.error("Failed to update routine. Try again.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRoutine.mutateAsync(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete routine. Try again.");
    }
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName.trim() === oldName) return;
    setIsCategoryUpdating(true);
    try {
      // Update all routines that belong to this category
      const affected = routines.filter(
        (r) => parseCategoryMeta(r.description) === oldName,
      );
      await Promise.all(
        affected.map((r) => {
          const newDesc = encodeCategoryMeta(
            newName.trim(),
            stripCategoryMeta(r.description),
          );
          return updateRoutine.mutateAsync({
            id: r.id,
            updates: { description: newDesc },
          });
        }),
      );

      // Update local categories list
      const updated = categories.map((c) =>
        c === oldName ? newName.trim() : c,
      );
      setCategories(updated);
      saveCategories(updated);
      toast.success(`Category renamed to "${newName.trim()}"`);
    } catch {
      toast.error("Failed to rename category. Try again.");
    } finally {
      setIsCategoryUpdating(false);
    }
  };

  const handleDeleteCategory = async (name: string) => {
    setIsCategoryUpdating(true);
    try {
      // Remove category from all affected routines (make them uncategorised)
      const affected = routines.filter(
        (r) => parseCategoryMeta(r.description) === name,
      );
      await Promise.all(
        affected.map((r) => {
          const newDesc = stripCategoryMeta(r.description);
          return updateRoutine.mutateAsync({
            id: r.id,
            updates: { description: newDesc },
          });
        }),
      );

      // Remove from categories list
      const updated = categories.filter((c) => c !== name);
      setCategories(updated);
      saveCategories(updated);
      toast.success(`Category "${name}" deleted`);
    } catch {
      toast.error("Failed to delete category. Try again.");
    } finally {
      setIsCategoryUpdating(false);
    }
  };

  const handleBulkAssign = async (routineIds: bigint[], category: string) => {
    setIsAssigning(true);
    try {
      // Ensure category is persisted in the list
      if (!categories.includes(category.trim())) {
        addCategory(category.trim());
      }

      const affected = routines.filter((r) =>
        routineIds.some((id) => id === r.id),
      );
      await Promise.all(
        affected.map((r) => {
          const newDesc = encodeCategoryMeta(
            category.trim(),
            stripCategoryMeta(r.description),
          );
          return updateRoutine.mutateAsync({
            id: r.id,
            updates: { description: newDesc },
          });
        }),
      );

      toast.success(
        `${routineIds.length} routine${routineIds.length !== 1 ? "s" : ""} moved to "${category.trim()}"`,
      );
      setShowAssignDialog(false);
    } catch {
      toast.error("Failed to assign routines. Try again.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAssignSingleRoutine = async (
    routine: Routine,
    category: string,
  ) => {
    setIsAssigning(true);
    try {
      if (!categories.includes(category.trim())) {
        addCategory(category.trim());
      }
      const newDesc = encodeCategoryMeta(
        category.trim(),
        stripCategoryMeta(routine.description),
      );
      await updateRoutine.mutateAsync({
        id: routine.id,
        updates: { description: newDesc },
      });
      toast.success(`"${routine.name}" moved to "${category.trim()}"`);
    } catch {
      toast.error("Failed to assign routine. Try again.");
    } finally {
      setIsAssigning(false);
    }
  };

  // Group routines by category
  const groupedRoutines = (() => {
    const groups = new Map<string, Routine[]>();

    for (const routine of routines) {
      const cat = parseCategoryMeta(routine.description) ?? "";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(routine);
    }

    // Sort: named categories first (in order from categories list), then uncategorised last
    const result: { categoryName: string; items: Routine[] }[] = [];

    for (const cat of categories) {
      const items = groups.get(cat);
      if (items && items.length > 0) {
        result.push({ categoryName: cat, items });
      }
    }

    // Categories in routines but not in the stored list (edge case)
    for (const [cat, items] of groups.entries()) {
      if (cat !== "" && !categories.includes(cat)) {
        result.push({ categoryName: cat, items });
      }
    }

    // Uncategorised last
    const uncatItems = groups.get("") ?? [];
    if (uncatItems.length > 0) {
      result.push({ categoryName: "Uncategorised", items: uncatItems });
    }

    return result;
  })();

  // Flat index for deterministic row markers
  let globalIndex = 0;

  return (
    <div className="min-h-screen pb-20 md:pb-8" data-ocid="tasks.section">
      {/* Header */}
      <div
        className="px-4 md:px-8 py-6 border-b border-border"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.165 0.012 255) 0%, oklch(0.13 0.008 260) 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Tasks
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {routines.length} task{routines.length !== 1 ? "s" : ""}{" "}
              configured
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowForm(true)}
              className="gap-1.5 font-semibold"
              style={{
                background: "oklch(0.78 0.14 72)",
                color: "oklch(0.12 0.008 260)",
              }}
              data-ocid="routine.add_button"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Task</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full bg-card rounded-xl" />
            ))}
          </div>
        ) : routines.length === 0 ? (
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
              <ListChecks
                className="w-10 h-10"
                style={{ color: "oklch(0.78 0.14 72)" }}
              />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground mb-2">
              No tasks yet
            </h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              Create your first task to start building powerful daily habits.
            </p>
            <Button
              onClick={() => setShowForm(true)}
              className="font-semibold gap-2"
              style={{
                background: "oklch(0.78 0.14 72)",
                color: "oklch(0.12 0.008 260)",
              }}
              data-ocid="routine.add_button"
            >
              <Plus className="w-4 h-4" />
              Create first task
            </Button>
          </motion.div>
        ) : (
          <AnimatePresence>
            <div className="space-y-6">
              {groupedRoutines.map(({ categoryName, items }) => {
                const startIdx = globalIndex;
                globalIndex += items.length;

                return (
                  <CategoryGroup
                    key={categoryName}
                    categoryName={categoryName}
                    routines={items}
                    startIndex={startIdx}
                    onEdit={setEditRoutine}
                    onDelete={setDeleteTarget}
                    onBulkAssign={
                      categoryName === "Uncategorised"
                        ? () => setShowAssignDialog(true)
                        : undefined
                    }
                    onAssignCategory={handleAssignSingleRoutine}
                    categories={categories}
                    onAddCategory={addCategory}
                    isAssigningCategory={isAssigning}
                  />
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Create form dialog */}
      {showForm && (
        <RoutineFormDialog
          open={showForm}
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
          isPending={createRoutine.isPending}
          categories={categories}
          onAddCategory={addCategory}
        />
      )}

      {/* Edit form dialog */}
      {editRoutine && (
        <RoutineFormDialog
          open={!!editRoutine}
          onClose={() => setEditRoutine(null)}
          editRoutine={editRoutine}
          onSubmit={handleUpdate}
          isPending={updateRoutine.isPending}
          categories={categories}
          onAddCategory={addCategory}
        />
      )}

      {/* Manage Categories dialog */}
      <ManageCategoriesDialog
        open={showManageCategories}
        onClose={() => setShowManageCategories(false)}
        categories={categories}
        routines={routines}
        onRenameCategory={handleRenameCategory}
        onDeleteCategory={handleDeleteCategory}
        isUpdating={isCategoryUpdating}
      />

      {/* Assign Uncategorised dialog */}
      <AssignUncategorisedDialog
        open={showAssignDialog}
        onClose={() => setShowAssignDialog(false)}
        uncategorisedRoutines={routines.filter(
          (r) => !parseCategoryMeta(r.description),
        )}
        categories={categories}
        onAddCategory={addCategory}
        onAssign={handleBulkAssign}
        isAssigning={isAssigning}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent
          className="bg-card border-border text-foreground"
          data-ocid="routine.dialog"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Delete Routine?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                "{deleteTarget?.name}"
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-border text-foreground"
              data-ocid="routine.delete.cancel_button"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteRoutine.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="routine.delete.confirm_button"
            >
              {deleteRoutine.isPending ? (
                <>
                  <Loader2 className="mr-2 w-3.5 h-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
