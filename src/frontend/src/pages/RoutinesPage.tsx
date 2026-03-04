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
  Clock,
  Edit2,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
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
  DAY_LABELS,
  encodeFrequencyMeta,
  formatFrequencyLabel,
  formatRepeatDays,
  formatTime12h,
  isFrequencyRoutine,
  parseFrequencyMeta,
  stripFrequencyMeta,
} from "../utils/routineHelpers";

// ─── Form State ───────────────────────────────────────────────────────────────

type ScheduleMode = "specific" | "flexible";

interface RoutineFormData {
  name: string;
  description: string;
  scheduledTime: string;
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
}

const defaultForm: RoutineFormData = {
  name: "",
  description: "",
  scheduledTime: "08:00",
  scheduleMode: "specific",
  repeatDays: [1, 2, 3, 4, 5],
  freqCount: 3,
  freqPeriod: "week",
  reminderEnabled: false,
  reminderValue: 30,
  reminderUnit: "minutes",
};

const PRESETS = [
  { label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Weekends", days: [0, 6] },
  { label: "Mon/Wed/Fri", days: [1, 3, 5] },
  { label: "Tue/Thu", days: [2, 4] },
];

function formDataFromRoutine(routine: Routine): RoutineFormData {
  const freqMeta = parseFrequencyMeta(routine.description);
  const isFreq = freqMeta !== null;
  const reminderUnit =
    routine.reminderOffset.unit === "minutes" ||
    routine.reminderOffset.unit === "hours" ||
    routine.reminderOffset.unit === "days"
      ? (routine.reminderOffset.unit as "minutes" | "hours" | "days")
      : "minutes";

  return {
    name: routine.name,
    description: stripFrequencyMeta(routine.description),
    scheduledTime: routine.scheduledTime,
    scheduleMode: isFreq ? "flexible" : "specific",
    repeatDays: isFreq ? [0, 1, 2, 3, 4, 5, 6] : routine.repeatDays.map(Number),
    freqCount: freqMeta?.count ?? 3,
    freqPeriod: freqMeta?.period ?? "week",
    reminderEnabled: routine.reminderEnabled,
    reminderValue: Number(routine.reminderOffset.value),
    reminderUnit,
  };
}

function buildRepeatDaysAndDescription(form: RoutineFormData): {
  repeatDays: bigint[];
  description: string;
} {
  if (form.scheduleMode === "flexible") {
    return {
      repeatDays: [0n, 1n, 2n, 3n, 4n, 5n, 6n],
      description: encodeFrequencyMeta(
        form.freqCount,
        form.freqPeriod,
        form.description.trim(),
      ),
    };
  }
  return {
    repeatDays: [...form.repeatDays].sort().map(BigInt),
    description: form.description.trim(),
  };
}

function buildReminderOffset(form: RoutineFormData): ReminderOffset {
  if (!form.reminderEnabled) {
    return { value: 30n, unit: "minutes" };
  }
  return { value: BigInt(form.reminderValue), unit: form.reminderUnit };
}

// ─── Form Dialog ──────────────────────────────────────────────────────────────

interface RoutineFormDialogProps {
  open: boolean;
  onClose: () => void;
  editRoutine?: Routine | null;
  onSubmit: (data: RoutineFormData) => Promise<void>;
  isPending: boolean;
}

function RoutineFormDialog({
  open,
  onClose,
  editRoutine,
  onSubmit,
  isPending,
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
            {editRoutine ? "Edit Routine" : "New Routine"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {editRoutine
              ? "Update your routine details."
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

          {/* Schedule Type Toggle */}
          <div className="space-y-3">
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

// ─── Routine Row ──────────────────────────────────────────────────────────────

interface RoutineRowProps {
  routine: Routine;
  index: number;
  onEdit: (routine: Routine) => void;
  onDelete: (routine: Routine) => void;
}

function formatReminderChip(routine: Routine): string {
  const { value, unit } = routine.reminderOffset;
  const n = Number(value);
  if (unit === "minutes") return `${n} min before`;
  if (unit === "hours") return `${n}h before`;
  if (unit === "days") return `${n} day${n !== 1 ? "s" : ""} before`;
  return "";
}

function RoutineRow({ routine, index, onEdit, onDelete }: RoutineRowProps) {
  const isFreq = isFrequencyRoutine(routine);
  const freqMeta = isFreq ? parseFrequencyMeta(routine.description) : null;
  const displayDescription = isFreq
    ? stripFrequencyMeta(routine.description)
    : routine.description;

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RoutinesPage() {
  const { data: routines = [], isLoading } = useGetAllRoutines();
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();

  const [showForm, setShowForm] = useState(false);
  const [editRoutine, setEditRoutine] = useState<Routine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);

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

  return (
    <div className="min-h-screen pb-20 md:pb-8" data-ocid="routines.section">
      {/* Header */}
      <div
        className="px-4 md:px-8 py-6 border-b border-border"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.165 0.012 255) 0%, oklch(0.13 0.008 260) 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              My Routines
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {routines.length} routine{routines.length !== 1 ? "s" : ""}{" "}
              configured
            </p>
          </div>
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
            <span className="hidden sm:inline">Add Routine</span>
            <span className="sm:hidden">Add</span>
          </Button>
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
              No routines yet
            </h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              Create your first routine to start building powerful daily habits.
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
              Create first routine
            </Button>
          </motion.div>
        ) : (
          <AnimatePresence>
            <div className="space-y-2.5">
              {routines.map((routine, i) => (
                <RoutineRow
                  key={routine.id.toString()}
                  routine={routine}
                  index={i}
                  onEdit={setEditRoutine}
                  onDelete={setDeleteTarget}
                />
              ))}
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
        />
      )}

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
