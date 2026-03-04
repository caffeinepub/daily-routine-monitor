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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays,
  Check,
  Clock,
  Edit2,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import type { Routine, RoutineUpdate } from "../backend.d";
import {
  useCreateRoutine,
  useDeleteRoutine,
  useGetAllRoutines,
  useUpdateRoutine,
} from "../hooks/useQueries";
import {
  DAY_LABELS,
  formatRepeatDays,
  formatTime12h,
} from "../utils/routineHelpers";

// ─── Form State ───────────────────────────────────────────────────────────────

interface RoutineFormData {
  name: string;
  description: string;
  scheduledTime: string;
  repeatDays: number[];
}

const defaultForm: RoutineFormData = {
  name: "",
  description: "",
  scheduledTime: "08:00",
  repeatDays: [1, 2, 3, 4, 5], // Weekdays default
};

const PRESETS = [
  { label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Weekends", days: [0, 6] },
  { label: "Mon/Wed/Fri", days: [1, 3, 5] },
  { label: "Tue/Thu", days: [2, 4] },
];

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
  const [form, setForm] = useState<RoutineFormData>(() => {
    if (editRoutine) {
      return {
        name: editRoutine.name,
        description: editRoutine.description,
        scheduledTime: editRoutine.scheduledTime,
        repeatDays: editRoutine.repeatDays.map(Number),
      };
    }
    return defaultForm;
  });

  const [errors, setErrors] = useState<{ name?: string }>({});

  // Reset form when dialog opens
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
    const newErrors: { name?: string } = {};
    if (!form.name.trim()) newErrors.name = "Name is required";
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md bg-card border-border text-foreground"
        data-ocid="routine.dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editRoutine ? "Edit Routine" : "New Routine"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {editRoutine
              ? "Update your routine details."
              : "Set up a new habit to track daily."}
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
                if (errors.name) setErrors({});
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

          {/* Repeat days */}
          <div className="space-y-2.5">
            <Label className="text-sm text-foreground/80">Repeat on</Label>

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
                    style={checked ? { background: "oklch(0.78 0.14 72)" } : {}}
                  >
                    {label[0]}
                  </button>
                );
              })}
            </div>
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

function RoutineRow({ routine, index, onEdit, onDelete }: RoutineRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className="bg-card border border-border rounded-xl px-4 py-3.5 flex items-center gap-3 hover:border-foreground/10 transition-colors"
      data-ocid={`routine.item.${index + 1}`}
    >
      {/* Time indicator */}
      <div
        className="w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 text-center"
        style={{ background: "oklch(0.78 0.14 72 / 0.1)" }}
      >
        <Clock
          className="w-3.5 h-3.5 mb-0.5"
          style={{ color: "oklch(0.78 0.14 72)" }}
        />
        <span
          className="text-[9px] font-mono font-bold leading-none"
          style={{ color: "oklch(0.78 0.14 72)" }}
        >
          {formatTime12h(routine.scheduledTime).replace(" ", "\n")}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-foreground truncate">
            {routine.name}
          </h3>
        </div>
        {routine.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {routine.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          <CalendarDays className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground">
            {formatRepeatDays(routine.repeatDays)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
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
    try {
      await createRoutine.mutateAsync({
        name: data.name.trim(),
        description: data.description.trim(),
        scheduledTime: data.scheduledTime,
        repeatDays: data.repeatDays.sort().map(BigInt),
      });
      toast.success(`"${data.name}" routine created!`);
      setShowForm(false);
    } catch {
      toast.error("Failed to create routine. Try again.");
    }
  };

  const handleUpdate = async (data: RoutineFormData) => {
    if (!editRoutine) return;
    const updates: RoutineUpdate = {
      name: data.name.trim(),
      description: data.description.trim(),
      scheduledTime: data.scheduledTime,
      repeatDays: data.repeatDays.sort().map(BigInt),
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
