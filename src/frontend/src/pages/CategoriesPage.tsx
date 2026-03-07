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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  Edit2,
  FolderOpen,
  Info,
  Loader2,
  Plus,
  Scale,
  Tag,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { RoutineUpdate } from "../backend.d";
import { useGetAllRoutines, useUpdateRoutine } from "../hooks/useQueries";
import {
  type CategoryWeight,
  distributeEqualWeights,
  encodeCategoryMeta,
  loadCategoryWeights,
  parseCategoryMeta,
  saveCategoryWeights,
  stripCategoryMeta,
} from "../utils/routineHelpers";

// ─── Local storage helpers ─────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { data: routines = [] } = useGetAllRoutines();
  const updateRoutine = useUpdateRoutine();

  const [categories, setCategories] = useState<string[]>(() =>
    loadCategories(),
  );
  const [weights, setWeights] = useState<CategoryWeight[]>(() =>
    loadCategoryWeights(),
  );
  const [newCatInput, setNewCatInput] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Re-sync weights whenever categories list changes
  useEffect(() => {
    const saved = loadCategoryWeights();
    const merged: CategoryWeight[] = categories.map((cat) => {
      const existing = saved.find((w) => w.name === cat);
      return existing ?? { name: cat, weight: 0 };
    });
    setWeights(merged);
  }, [categories]);

  const totalWeight = weights.reduce((sum, w) => sum + (w.weight || 0), 0);
  const isValidTotal = Math.round(totalWeight) === 100;

  const countForCategory = (cat: string) =>
    routines.filter((r) => parseCategoryMeta(r.description) === cat).length;

  // ── Add ──────────────────────────────────────────────────────────────────────
  const handleAdd = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      toast.error(`Category "${trimmed}" already exists`);
      return;
    }
    const updated = [...categories, trimmed];
    setCategories(updated);
    saveCategories(updated);
    setNewCatInput("");
    toast.success(`Category "${trimmed}" added`);
  };

  // ── Rename ───────────────────────────────────────────────────────────────────
  const handleConfirmRename = async () => {
    if (!editingCat || !renameValue.trim() || renameValue.trim() === editingCat)
      return;
    const newName = renameValue.trim();
    setIsUpdating(true);
    try {
      const affected = routines.filter(
        (r) => parseCategoryMeta(r.description) === editingCat,
      );
      await Promise.all(
        affected.map((r) => {
          const newDesc = encodeCategoryMeta(
            newName,
            stripCategoryMeta(r.description),
          );
          const updates: RoutineUpdate = { description: newDesc };
          return updateRoutine.mutateAsync({ id: r.id, updates });
        }),
      );
      const updated = categories.map((c) => (c === editingCat ? newName : c));
      setCategories(updated);
      saveCategories(updated);
      // Also rename in weights
      setWeights((prev) =>
        prev.map((w) => (w.name === editingCat ? { ...w, name: newName } : w)),
      );
      saveCategoryWeights(
        weights.map((w) =>
          w.name === editingCat ? { ...w, name: newName } : w,
        ),
      );
      toast.success(`Category renamed to "${newName}"`);
    } catch {
      toast.error("Failed to rename category. Try again.");
    } finally {
      setIsUpdating(false);
      setEditingCat(null);
      setRenameValue("");
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDeleteCategory = async (name: string) => {
    setIsUpdating(true);
    try {
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
      const updated = categories.filter((c) => c !== name);
      setCategories(updated);
      saveCategories(updated);
      setWeights((prev) => prev.filter((w) => w.name !== name));
      saveCategoryWeights(weights.filter((w) => w.name !== name));
      toast.success(`Category "${name}" deleted`);
      setConfirmDelete(null);
    } catch {
      toast.error("Failed to delete category. Try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Weights ──────────────────────────────────────────────────────────────────
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

  // ── Guidance banners ─────────────────────────────────────────────────────────
  const catCount = categories.length;
  const tooFew = catCount > 0 && catCount < 3;
  const tooMany = catCount > 5;

  return (
    <div className="min-h-screen pb-20 md:pb-8" data-ocid="categories.section">
      {/* Header */}
      <div
        className="relative overflow-hidden px-4 md:px-8 py-6 md:py-8"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.165 0.012 255) 0%, oklch(0.13 0.008 260) 100%)",
          borderBottom: "1px solid oklch(0.28 0.015 255)",
        }}
      >
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-5 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, oklch(0.78 0.14 72) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "oklch(0.78 0.14 72 / 0.15)" }}
            >
              <Tag
                className="w-4.5 h-4.5"
                style={{ color: "oklch(0.78 0.14 72)" }}
              />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground tracking-tight">
                Categories
              </h1>
              <p className="text-sm text-muted-foreground">
                Define categories and assign weights that reflect your
                priorities
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Recommendation banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div
            className="flex gap-3 p-4 rounded-xl border text-sm"
            style={{
              background: "oklch(0.78 0.14 72 / 0.06)",
              borderColor: "oklch(0.78 0.14 72 / 0.25)",
            }}
            data-ocid="categories.guidance.card"
          >
            <Info
              className="w-4.5 h-4.5 shrink-0 mt-0.5"
              style={{ color: "oklch(0.78 0.14 72)" }}
            />
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                Recommendation: 3–5 categories
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We recommend defining{" "}
                <span className="font-semibold text-foreground">
                  3 to 5 categories
                </span>{" "}
                for the best balance of granularity and clarity. Good examples:
                Health, Work, Learning, Personal, Spiritual. You are free to
                define any number — more or fewer — to suit your needs.
              </p>
              {tooFew && (
                <p
                  className="text-xs font-medium mt-1"
                  style={{ color: "oklch(0.78 0.14 72)" }}
                >
                  💡 You have {catCount} categor{catCount === 1 ? "y" : "ies"}.
                  Consider adding more to organise your tasks better.
                </p>
              )}
              {tooMany && (
                <p
                  className="text-xs font-medium mt-1"
                  style={{ color: "oklch(0.72 0.14 280)" }}
                >
                  ⚠️ You have {catCount} categories. Consider consolidating some
                  to keep the weight distribution manageable.
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Add new category */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
        >
          <Card
            className="border-border/60 shadow-card-lift"
            style={{ background: "oklch(0.165 0.012 255)" }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Plus
                  className="w-4 h-4"
                  style={{ color: "oklch(0.78 0.14 72)" }}
                />
                Add New Category
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Type a name and press Enter or click Add
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="e.g. Health, Work, Personal..."
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAdd();
                      }
                    }}
                    className="pl-9 bg-background border-input"
                    maxLength={50}
                    data-ocid="categories.add.input"
                  />
                </div>
                <Button
                  onClick={handleAdd}
                  disabled={!newCatInput.trim()}
                  className="gap-1.5 font-semibold shrink-0"
                  style={
                    newCatInput.trim()
                      ? {
                          background: "oklch(0.78 0.14 72)",
                          color: "oklch(0.12 0.008 260)",
                        }
                      : {}
                  }
                  data-ocid="categories.add.button"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Category list + weights */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          <Card
            className="border-border/60 shadow-card-lift"
            style={{ background: "oklch(0.165 0.012 255)" }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "oklch(0.72 0.14 280 / 0.12)" }}
                >
                  <Scale
                    className="w-4 h-4"
                    style={{ color: "oklch(0.72 0.14 280)" }}
                  />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Categories & Weights
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Assign a weight (%) to each category. The weights must sum
                    to exactly 100% for the weighted success rate to work.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {categories.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-12 text-center"
                  data-ocid="categories.empty_state"
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: "oklch(0.78 0.14 72 / 0.1)" }}
                  >
                    <Tag
                      className="w-7 h-7"
                      style={{ color: "oklch(0.78 0.14 72)" }}
                    />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    No categories yet
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Add your first category above to start organising your tasks
                    and tracking weighted success rates.
                  </p>
                </div>
              ) : (
                <>
                  {/* Column headers */}
                  <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <span className="flex-1">Category name</span>
                    <span className="w-20 text-center">Weight %</span>
                    <span className="w-16 text-right">Tasks</span>
                    <span className="w-16" />
                  </div>

                  {categories.map((cat, idx) => {
                    const count = countForCategory(cat);
                    const isEditing = editingCat === cat;
                    const weightEntry = weights.find((w) => w.name === cat);
                    const currentWeight = weightEntry?.weight ?? 0;

                    return (
                      <div
                        key={cat}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors hover:border-foreground/10"
                        style={{
                          background: "oklch(0.13 0.01 260)",
                          borderColor: "oklch(0.25 0.015 255)",
                        }}
                        data-ocid={`categories.item.${idx + 1}`}
                      >
                        <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

                        {/* Name / rename input */}
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
                            data-ocid={`categories.rename.input.${idx + 1}`}
                          />
                        ) : (
                          <span className="flex-1 text-sm font-medium text-foreground truncate min-w-0">
                            {cat}
                          </span>
                        )}

                        {/* Weight input */}
                        {!isEditing && (
                          <div className="w-20 shrink-0">
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

                        {/* Task count */}
                        <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
                          {count} {count === 1 ? "task" : "tasks"}
                        </span>

                        {/* Action buttons */}
                        {isEditing ? (
                          <div className="flex items-center gap-1 shrink-0 w-16 justify-end">
                            <Button
                              size="icon"
                              className="w-6 h-6"
                              style={{
                                background: "oklch(0.78 0.14 72)",
                                color: "oklch(0.12 0.008 260)",
                              }}
                              onClick={() => void handleConfirmRename()}
                              disabled={isUpdating}
                              data-ocid={`categories.rename.confirm_button.${idx + 1}`}
                            >
                              {isUpdating ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-6 h-6 text-muted-foreground"
                              onClick={() => setEditingCat(null)}
                              data-ocid={`categories.rename.cancel_button.${idx + 1}`}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0 w-16 justify-end">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-7 h-7 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingCat(cat);
                                setRenameValue(cat);
                              }}
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
                  <div
                    className="px-4 py-3.5 rounded-xl border space-y-3 mt-2"
                    style={{
                      background: isValidTotal
                        ? "oklch(0.72 0.16 150 / 0.06)"
                        : "oklch(0.65 0.2 28 / 0.06)",
                      borderColor: isValidTotal
                        ? "oklch(0.72 0.16 150 / 0.35)"
                        : "oklch(0.65 0.2 28 / 0.35)",
                    }}
                    data-ocid="categories.weight_total.card"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          Total weight
                        </span>
                        {isValidTotal && (
                          <Badge
                            className="text-[10px] font-semibold"
                            style={{
                              background: "oklch(0.72 0.16 150 / 0.15)",
                              color: "oklch(0.72 0.16 150)",
                            }}
                          >
                            ✓ Valid
                          </Badge>
                        )}
                      </div>
                      <span
                        className="text-base font-bold font-mono"
                        style={{
                          color: isValidTotal
                            ? "oklch(0.72 0.16 150)"
                            : "oklch(0.65 0.2 28)",
                        }}
                      >
                        {Math.round(totalWeight * 10) / 10}%
                        {!isValidTotal && (
                          <span className="text-xs font-normal ml-1.5 text-muted-foreground">
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
                        className="flex-1 h-8 text-xs border-border gap-1.5"
                        onClick={handleAutoDistribute}
                        data-ocid="categories.auto_distribute.button"
                      >
                        Auto-distribute evenly
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!isValidTotal}
                        className="flex-1 h-8 text-xs font-semibold gap-1.5"
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

                    {!isValidTotal && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Adjust the weights above so they total 100%, or click
                        "Auto-distribute" to split evenly.
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Info card */}
        {categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.15 }}
          >
            <div
              className="flex gap-3 p-4 rounded-xl border text-xs"
              style={{
                background: "oklch(0.72 0.14 280 / 0.05)",
                borderColor: "oklch(0.72 0.14 280 / 0.2)",
              }}
            >
              <Info
                className="w-4 h-4 shrink-0 mt-0.5"
                style={{ color: "oklch(0.72 0.14 280)" }}
              />
              <div className="space-y-1 text-muted-foreground leading-relaxed">
                <p>
                  <span className="font-semibold text-foreground">
                    How weights affect your score:
                  </span>{" "}
                  A category with weight 60% contributes 60% of its task
                  completion rate to your overall weekly success rate. Higher
                  weight = more impact on your score.
                </p>
                <p>
                  Go to the{" "}
                  <span className="font-medium text-foreground">
                    Tasks page
                  </span>{" "}
                  to assign tasks to these categories. Tasks without a category
                  are listed as "Uncategorised" and are excluded from the
                  weighted success rate.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Delete confirmation dialog */}
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
              ? All tasks in this category will become Uncategorised.
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
                  await handleDeleteCategory(confirmDelete);
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
    </div>
  );
}
