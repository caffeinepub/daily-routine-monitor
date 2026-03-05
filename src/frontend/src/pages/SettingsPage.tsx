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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart2, CalendarRange, Minus, Plus, Settings } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useNWeeksPreference } from "../hooks/useNWeeksPreference";
import { useWeekStartPreference } from "../hooks/useWeekStartPreference";
import {
  WEEK_MODE_LABELS,
  type WeekStartMode,
  getWeekStartWithMode,
} from "../utils/routineHelpers";

function formatWeekRange(mode: WeekStartMode): string {
  const startStr = getWeekStartWithMode(mode);
  const startDate = new Date(`${startStr}T00:00:00`);

  let endDate: Date;
  if (mode === "rolling7") {
    endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
  } else {
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
  }

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

const WEEK_MODE_ORDER: WeekStartMode[] = [
  "rolling7",
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

export default function SettingsPage() {
  const { mode, setMode } = useWeekStartPreference();
  const { nWeeks, setNWeeks, MIN_N, MAX_N } = useNWeeksPreference();

  const handleChange = (value: string) => {
    setMode(value as WeekStartMode);
    toast.success("Week definition updated");
  };

  const weekRange = formatWeekRange(mode);

  return (
    <div className="min-h-screen pb-20 md:pb-8" data-ocid="settings.section">
      {/* Header */}
      <div
        className="relative overflow-hidden px-4 md:px-8 py-6 md:py-8"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.165 0.012 255) 0%, oklch(0.13 0.008 260) 100%)",
          borderBottom: "1px solid oklch(0.28 0.015 255)",
        }}
      >
        {/* Ambient glow */}
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
              <Settings
                className="w-4.5 h-4.5"
                style={{ color: "oklch(0.78 0.14 72)" }}
              />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground tracking-tight">
                Settings
              </h1>
              <p className="text-sm text-muted-foreground">
                Customize how the app works for you
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Card
            className="border-border/60 shadow-card-lift"
            style={{ background: "oklch(0.165 0.012 255)" }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "oklch(0.78 0.14 72 / 0.12)" }}
                >
                  <CalendarRange
                    className="w-4 h-4"
                    style={{ color: "oklch(0.78 0.14 72)" }}
                  />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Week Definition
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Choose how "this week" is calculated for weekly task
                    completion counts
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="week-mode-select"
                  className="text-sm font-medium text-foreground"
                >
                  Week starts on
                </Label>
                <Select value={mode} onValueChange={handleChange}>
                  <SelectTrigger
                    id="week-mode-select"
                    className="w-full md:w-72"
                    data-ocid="settings.week_mode.select"
                  >
                    <SelectValue placeholder="Select week definition" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEK_MODE_ORDER.map((key, idx) => (
                      <SelectItem
                        key={key}
                        value={key}
                        data-ocid={`settings.week_mode.item.${idx + 1}`}
                      >
                        {WEEK_MODE_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Current week range preview */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                style={{
                  background: "oklch(0.78 0.14 72 / 0.08)",
                  border: "1px solid oklch(0.78 0.14 72 / 0.2)",
                }}
              >
                <CalendarRange
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "oklch(0.78 0.14 72)" }}
                />
                <span className="text-muted-foreground">
                  This week:&nbsp;
                  <span className="font-medium text-foreground">
                    {weekRange}
                  </span>
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                This affects how weekly task completion counts are calculated on
                the dashboard. Changes take effect immediately.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Success Rate History Card */}
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
                  <BarChart2
                    className="w-4 h-4"
                    style={{ color: "oklch(0.72 0.14 280)" }}
                  />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Success Rate History
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Number of past weeks to show in the success rate chart
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Past weeks to show
                </Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="w-8 h-8 shrink-0 border-border"
                    disabled={nWeeks <= MIN_N}
                    onClick={() => {
                      setNWeeks(nWeeks - 1);
                      toast.success(`Now showing ${nWeeks - 1} weeks`);
                    }}
                    data-ocid="settings.n_weeks.decrease_button"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={MIN_N}
                      max={MAX_N}
                      value={nWeeks}
                      onChange={(e) => {
                        const val = Number.parseInt(e.target.value, 10);
                        if (!Number.isNaN(val)) {
                          setNWeeks(val);
                        }
                      }}
                      onBlur={() => toast.success(`Showing ${nWeeks} weeks`)}
                      className="w-16 text-center bg-background border-input font-semibold text-lg"
                      data-ocid="settings.n_weeks.input"
                    />
                    <span className="text-sm text-muted-foreground">
                      {nWeeks === 1 ? "week" : "weeks"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="w-8 h-8 shrink-0 border-border"
                    disabled={nWeeks >= MAX_N}
                    onClick={() => {
                      setNWeeks(nWeeks + 1);
                      toast.success(`Now showing ${nWeeks + 1} weeks`);
                    }}
                    data-ocid="settings.n_weeks.increase_button"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                The success rate charts on the dashboard will show data for the
                past {nWeeks} {nWeeks === 1 ? "week" : "weeks"}. Range: {MIN_N}–
                {MAX_N} weeks.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
