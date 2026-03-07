import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FolderOpen,
  Info,
  LayoutDashboard,
  ListChecks,
  Lock,
  Smartphone,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";

type Page =
  | "home"
  | "dashboard"
  | "categories"
  | "tasks"
  | "history"
  | "settings";

interface LandingPageProps {
  onNavigate: (page: Page) => void;
}

const benefits = [
  {
    icon: ListChecks,
    title: "Structured Habit Tracking",
    desc: "Manage all your routines in one place — daily habits, weekly goals, and flexible schedules all under one roof.",
    color: "oklch(0.78 0.14 72)",
    bg: "oklch(0.78 0.14 72 / 0.1)",
  },
  {
    icon: Bell,
    title: "Smart Prompting",
    desc: "The dashboard highlights what is overdue, due soon, or upcoming so you always know exactly what needs attention next.",
    color: "oklch(0.72 0.14 280)",
    bg: "oklch(0.72 0.14 280 / 0.1)",
  },
  {
    icon: Tag,
    title: "Category-Based Organisation",
    desc: "Group your tasks under meaningful categories like Health, Work, or Personal, and assign priority weights to each.",
    color: "oklch(0.7 0.18 150)",
    bg: "oklch(0.7 0.18 150 / 0.1)",
  },
  {
    icon: BarChart3,
    title: "Meaningful Success Metrics",
    desc: "Weighted success rates at three levels — individual task, category, and overall — give you a precise picture of progress.",
    color: "oklch(0.78 0.14 72)",
    bg: "oklch(0.78 0.14 72 / 0.1)",
  },
  {
    icon: CalendarDays,
    title: "Flexible Scheduling",
    desc: "Define your own 'current week', set tasks as daily, weekly, or N-times-per-week. The exact day can be fixed or left open.",
    color: "oklch(0.72 0.14 280)",
    bg: "oklch(0.72 0.14 280 / 0.1)",
  },
  {
    icon: Lock,
    title: "Private & Multi-User",
    desc: "Each user logs in with Internet Identity and sees only their own private routines. No data is shared between users.",
    color: "oklch(0.7 0.18 150)",
    bg: "oklch(0.7 0.18 150 / 0.1)",
  },
  {
    icon: Smartphone,
    title: "Mobile-Ready PWA",
    desc: "Install the app on your Android home screen for quick access with a custom icon, launching full-screen without a browser bar.",
    color: "oklch(0.78 0.14 72)",
    bg: "oklch(0.78 0.14 72 / 0.1)",
  },
];

const steps = [
  {
    step: "01",
    title: "Create Categories",
    desc: "Go to the Categories page. Define 3–5 categories (e.g. Health, Work, Personal) and assign each a weight (%). The weights must sum to 100%. Categories with higher weights contribute more to your overall success rate.",
    icon: FolderOpen,
    page: "categories" as Page,
    pageLabel: "Go to Categories",
  },
  {
    step: "02",
    title: "Define Tasks",
    desc: "Go to the Tasks page. Add each routine, assign it to a category, set it as a Daily Task (every day) or Non-daily Task (N times per week or on specific days), pick a scheduled time, and optionally enable a reminder.",
    icon: ClipboardList,
    page: "tasks" as Page,
    pageLabel: "Go to Tasks",
  },
  {
    step: "03",
    title: "Log Completions Daily",
    desc: "Open the Dashboard each day. Mark tasks as Done when you complete them, or Skip if you are not doing them. If you made a mistake, use Undo to reverse it. Tasks are grouped by your chosen view.",
    icon: CheckCircle2,
    page: "dashboard" as Page,
    pageLabel: "Open Dashboard",
  },
  {
    step: "04",
    title: "Track Your Progress",
    desc: "The Success Rates panel on the Dashboard shows your Weekly and Daily success rates with drill-down from Overall → Categories → Tasks, and bar charts for the current week and past N weeks.",
    icon: TrendingUp,
    page: "dashboard" as Page,
    pageLabel: "View Progress",
  },
];

const calcRows = [
  {
    symbol: "B",
    label: "Planned instances",
    desc: "Total planned instances of a task during the current week. A daily task = 7/week. A 3×/week task = 3/week. A 1×/week task = 1/week.",
  },
  {
    symbol: "A",
    label: "Completed instances",
    desc: "Number of times the task was actually completed and logged during the current week.",
  },
];

export default function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="min-h-screen pb-20 md:pb-0" data-ocid="landing.section">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, oklch(0.14 0.015 260) 0%, oklch(0.11 0.01 270) 60%, oklch(0.10 0.008 280) 100%)",
          borderBottom: "1px solid oklch(0.28 0.015 255)",
        }}
      >
        {/* Ambient glows */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-10 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse, oklch(0.78 0.14 72) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-5 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, oklch(0.72 0.14 280) 0%, transparent 70%)",
          }}
        />

        <div className="relative max-w-5xl mx-auto px-4 md:px-8 pt-14 pb-16">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex justify-center mb-6"
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold border"
              style={{
                background: "oklch(0.78 0.14 72 / 0.1)",
                borderColor: "oklch(0.78 0.14 72 / 0.35)",
                color: "oklch(0.78 0.14 72)",
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Build habits that last
            </div>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center space-y-4"
          >
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "oklch(0.78 0.14 72)" }}
              >
                <Zap className="w-8 h-8 text-black" strokeWidth={2.5} />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight text-foreground">
              Daily Routine Monitor
            </h1>
            <p
              className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
              style={{ color: "oklch(0.75 0.015 255)" }}
            >
              An app to help you improve your Daily routine tasks
            </p>
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8"
          >
            <Button
              onClick={() => onNavigate("dashboard")}
              size="lg"
              className="gap-2 font-semibold px-8 h-12 text-base"
              style={{
                background: "oklch(0.78 0.14 72)",
                color: "oklch(0.12 0.008 260)",
              }}
              data-ocid="landing.primary_button"
            >
              <LayoutDashboard className="w-5 h-5" />
              Open Dashboard
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => onNavigate("categories")}
              variant="outline"
              size="lg"
              className="gap-2 font-medium px-6 h-12 text-base border-border hover:bg-foreground/5"
              data-ocid="landing.secondary_button"
            >
              <FolderOpen className="w-4 h-4" />
              Set Up Categories
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8">
        {/* ── Broad Objective ──────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="pt-12 pb-8"
          data-ocid="landing.objective.section"
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "oklch(0.78 0.14 72 / 0.12)" }}
            >
              <Target
                className="w-4.5 h-4.5"
                style={{ color: "oklch(0.78 0.14 72)" }}
              />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              What this app does
            </h2>
          </div>

          <div
            className="rounded-2xl p-6 md:p-8 border"
            style={{
              background: "oklch(0.155 0.012 255)",
              borderColor: "oklch(0.28 0.015 255)",
            }}
          >
            <p
              className="text-base md:text-lg leading-relaxed"
              style={{ color: "oklch(0.82 0.012 255)" }}
            >
              The Daily Routine Monitor is a personal productivity app designed
              to help you{" "}
              <span
                className="font-semibold"
                style={{ color: "oklch(0.78 0.14 72)" }}
              >
                build and sustain consistent daily and weekly habits
              </span>
              . It prompts you to complete planned routines, tracks completions
              over time, and measures how effectively you are following through
              — giving a clear,{" "}
              <span className="font-semibold text-foreground">
                data-driven picture
              </span>{" "}
              of your personal discipline and progress.
            </p>
            <p
              className="text-base leading-relaxed mt-4"
              style={{ color: "oklch(0.72 0.012 255)" }}
            >
              Tasks are organised into weighted categories, so you can reflect
              what matters most to you in your success measurement. Whether you
              want to track morning workouts, work tasks, learning goals, or
              personal wellness — the app adapts to your life.
            </p>
          </div>
        </motion.section>

        <Separator
          className="opacity-30"
          style={{ borderColor: "oklch(0.28 0.015 255)" }}
        />

        {/* ── Key Benefits ─────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="py-12"
          data-ocid="landing.benefits.section"
        >
          <div className="flex items-center gap-3 mb-8">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "oklch(0.72 0.14 280 / 0.12)" }}
            >
              <Sparkles
                className="w-4.5 h-4.5"
                style={{ color: "oklch(0.72 0.14 280)" }}
              />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              Key Benefits
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map((benefit, i) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                >
                  <Card
                    className="h-full border-border/60 hover:border-foreground/15 transition-colors"
                    style={{ background: "oklch(0.155 0.012 255)" }}
                    data-ocid={`landing.benefit.card.${i + 1}`}
                  >
                    <CardContent className="p-5">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                        style={{ background: benefit.bg }}
                      >
                        <Icon
                          className="w-4.5 h-4.5"
                          style={{ color: benefit.color }}
                        />
                      </div>
                      <h3 className="font-semibold text-sm text-foreground mb-1.5">
                        {benefit.title}
                      </h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {benefit.desc}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        <Separator
          className="opacity-30"
          style={{ borderColor: "oklch(0.28 0.015 255)" }}
        />

        {/* ── How to Use ───────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="py-12"
          data-ocid="landing.howto.section"
        >
          <div className="flex items-center gap-3 mb-8">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "oklch(0.7 0.18 150 / 0.12)" }}
            >
              <BookOpen
                className="w-4.5 h-4.5"
                style={{ color: "oklch(0.7 0.18 150)" }}
              />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              How to Use the App
            </h2>
          </div>

          <div className="space-y-4">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <div
                    className="flex gap-4 md:gap-6 p-5 md:p-6 rounded-2xl border hover:border-foreground/15 transition-colors"
                    style={{
                      background: "oklch(0.155 0.012 255)",
                      borderColor: "oklch(0.25 0.015 255)",
                    }}
                    data-ocid={`landing.step.card.${i + 1}`}
                  >
                    {/* Step number */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-sm shrink-0"
                        style={{
                          background: "oklch(0.78 0.14 72 / 0.12)",
                          color: "oklch(0.78 0.14 72)",
                        }}
                      >
                        {step.step}
                      </div>
                      {i < steps.length - 1 && (
                        <div
                          className="w-px flex-1 min-h-[20px]"
                          style={{ background: "oklch(0.28 0.015 255)" }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "oklch(0.78 0.14 72 / 0.08)" }}
                        >
                          <Icon
                            className="w-3.5 h-3.5"
                            style={{ color: "oklch(0.78 0.14 72)" }}
                          />
                        </div>
                        <h3 className="font-semibold text-foreground">
                          {step.title}
                        </h3>
                      </div>
                      <p
                        className="text-sm leading-relaxed mb-3"
                        style={{ color: "oklch(0.72 0.012 255)" }}
                      >
                        {step.desc}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNavigate(step.page)}
                        className="h-7 px-3 text-xs gap-1.5 font-medium"
                        style={{ color: "oklch(0.78 0.14 72)" }}
                        data-ocid={`landing.step.link.${i + 1}`}
                      >
                        {step.pageLabel}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ── Get Started CTA ──────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="pb-12"
        >
          <div
            className="rounded-2xl p-8 text-center relative overflow-hidden border"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.16 0.02 260) 0%, oklch(0.14 0.015 270) 100%)",
              borderColor: "oklch(0.78 0.14 72 / 0.3)",
            }}
          >
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center, oklch(0.78 0.14 72) 0%, transparent 65%)",
              }}
            />
            <div className="relative">
              <div className="flex justify-center mb-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "oklch(0.78 0.14 72 / 0.15)" }}
                >
                  <Zap
                    className="w-6 h-6"
                    style={{ color: "oklch(0.78 0.14 72)" }}
                  />
                </div>
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                Ready to build better habits?
              </h2>
              <p
                className="text-sm mb-6 max-w-md mx-auto"
                style={{ color: "oklch(0.72 0.012 255)" }}
              >
                Start by setting up your categories and defining your first
                tasks. The dashboard will guide you from there.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={() => onNavigate("categories")}
                  size="lg"
                  className="gap-2 font-semibold px-8 h-11"
                  style={{
                    background: "oklch(0.78 0.14 72)",
                    color: "oklch(0.12 0.008 260)",
                  }}
                  data-ocid="landing.get_started.primary_button"
                >
                  <FolderOpen className="w-4.5 h-4.5" />
                  Set Up Categories
                </Button>
                <Button
                  onClick={() => onNavigate("dashboard")}
                  variant="ghost"
                  size="lg"
                  className="gap-2 font-medium px-6 h-11 text-foreground/70 hover:text-foreground"
                  data-ocid="landing.get_started.secondary_button"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        <Separator
          className="opacity-30"
          style={{ borderColor: "oklch(0.28 0.015 255)" }}
        />

        {/* ── How Success Rates Are Calculated ─────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="py-12"
          data-ocid="landing.calc.section"
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "oklch(0.72 0.14 280 / 0.12)" }}
            >
              <Calculator
                className="w-4.5 h-4.5"
                style={{ color: "oklch(0.72 0.14 280)" }}
              />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              How Success Rates Are Calculated
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-8 ml-12">
            A transparent look at the maths behind your progress scores.
          </p>

          {/* Definitions */}
          <div className="space-y-3 mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Definitions
            </h3>
            {calcRows.map((row) => (
              <div
                key={row.symbol}
                className="flex gap-4 p-4 rounded-xl border"
                style={{
                  background: "oklch(0.155 0.012 255)",
                  borderColor: "oklch(0.25 0.015 255)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-display font-bold text-lg shrink-0"
                  style={{
                    background: "oklch(0.78 0.14 72 / 0.12)",
                    color: "oklch(0.78 0.14 72)",
                  }}
                >
                  {row.symbol}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">
                    {row.label}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {row.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Formulas */}
          <div className="space-y-5 mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Formulas
            </h3>

            {/* Category Rate */}
            <Card
              className="border-border/60"
              style={{ background: "oklch(0.155 0.012 255)" }}
            >
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Tag
                    className="w-4 h-4"
                    style={{ color: "oklch(0.72 0.14 280)" }}
                  />
                  Category Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2">
                <div
                  className="font-mono text-sm px-4 py-3 rounded-lg"
                  style={{
                    background: "oklch(0.12 0.01 260)",
                    color: "oklch(0.78 0.14 72)",
                    border: "1px solid oklch(0.25 0.015 255)",
                  }}
                >
                  Category Rate = A / B
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Only tasks in that specific category are counted. Each task
                  has equal weight within a category.
                </p>
              </CardContent>
            </Card>

            {/* Weekly Rate */}
            <Card
              className="border-border/60"
              style={{ background: "oklch(0.155 0.012 255)" }}
            >
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp
                    className="w-4 h-4"
                    style={{ color: "oklch(0.78 0.14 72)" }}
                  />
                  Weekly Success Rate (Overall)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2">
                <div
                  className="font-mono text-sm px-4 py-3 rounded-lg"
                  style={{
                    background: "oklch(0.12 0.01 260)",
                    color: "oklch(0.78 0.14 72)",
                    border: "1px solid oklch(0.25 0.015 255)",
                  }}
                >
                  Weekly Rate = Σ (Category Rate × Category Weight)
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Weighted average across all categories. Categories with more
                  weight have a greater impact on your overall score.
                </p>
                {/* Example */}
                <div
                  className="rounded-lg p-3 mt-2"
                  style={{
                    background: "oklch(0.78 0.14 72 / 0.06)",
                    border: "1px solid oklch(0.78 0.14 72 / 0.2)",
                  }}
                >
                  <p
                    className="text-[11px] font-semibold mb-1.5"
                    style={{ color: "oklch(0.78 0.14 72)" }}
                  >
                    Example
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Health (weight 60%) completes 4 out of 7 daily tasks →
                    rate&nbsp;=&nbsp;4/7&nbsp;≈&nbsp;57.1%
                    <br />
                    Work (weight 40%) completes 3 out of 5 weekly tasks →
                    rate&nbsp;=&nbsp;3/5&nbsp;=&nbsp;60%
                    <br />
                    <span className="font-semibold text-foreground">
                      Weekly Rate = (57.1% × 60%) + (60% × 40%) ≈ 34.3% + 24% =
                      58.3%
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Daily Rate */}
            <Card
              className="border-border/60"
              style={{ background: "oklch(0.155 0.012 255)" }}
            >
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CalendarDays
                    className="w-4 h-4"
                    style={{ color: "oklch(0.7 0.18 150)" }}
                  />
                  Daily Success Rate (Today)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 space-y-2">
                <div
                  className="font-mono text-sm px-4 py-3 rounded-lg"
                  style={{
                    background: "oklch(0.12 0.01 260)",
                    color: "oklch(0.7 0.18 150)",
                    border: "1px solid oklch(0.25 0.015 255)",
                  }}
                >
                  Daily Rate = Σ (Category Rate × Re-normalised Weight)
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Same as weekly rate, but{" "}
                  <span className="font-medium text-foreground">
                    only daily tasks
                  </span>{" "}
                  (scheduled every single day) are considered. Weekly/non-daily
                  tasks are excluded. Category weights are re-normalised among
                  only the categories that have daily tasks, so they still sum
                  to 100%.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Colour coding */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Colour Coding
            </h3>
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "oklch(0.25 0.015 255)" }}
            >
              {[
                {
                  range: "≥ 80%",
                  label: "Green",
                  desc: "On track — excellent progress",
                  color: "oklch(0.72 0.16 150)",
                  bg: "oklch(0.72 0.16 150 / 0.08)",
                },
                {
                  range: "40–79%",
                  label: "Amber",
                  desc: "Moderate — room for improvement",
                  color: "oklch(0.78 0.14 72)",
                  bg: "oklch(0.78 0.14 72 / 0.06)",
                },
                {
                  range: "< 40%",
                  label: "Red",
                  desc: "Needs attention — below target",
                  color: "oklch(0.65 0.2 28)",
                  bg: "oklch(0.65 0.2 28 / 0.06)",
                },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className={`flex items-center gap-4 px-5 py-3.5 ${i < 2 ? "border-b" : ""}`}
                  style={{
                    background: row.bg,
                    borderColor: "oklch(0.25 0.015 255)",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ background: row.color }}
                  />
                  <Badge
                    className="shrink-0 font-mono text-[11px]"
                    style={{
                      background: `${row.color} / 0.15`,
                      color: row.color,
                      border: `1px solid ${row.color} / 0.3`,
                    }}
                  >
                    {row.range}
                  </Badge>
                  <span
                    className="text-sm font-semibold shrink-0"
                    style={{ color: row.color }}
                  >
                    {row.label}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {row.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Drill-down */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Drill-Down Visualisation
            </h3>
            <div
              className="p-5 rounded-xl border"
              style={{
                background: "oklch(0.155 0.012 255)",
                borderColor: "oklch(0.25 0.015 255)",
              }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                {[
                  {
                    level: "Level 1",
                    title: "Overall",
                    desc: "Weekly & daily rates + charts",
                  },
                  {
                    level: "Level 2",
                    title: "Categories",
                    desc: "Per-category A/B rates",
                  },
                  {
                    level: "Level 3",
                    title: "Tasks",
                    desc: "Individual task completion",
                  },
                ].map((lvl, i) => (
                  <div
                    key={lvl.level}
                    className="flex items-center gap-3 flex-1"
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className="px-3 py-2 rounded-lg text-center"
                        style={{
                          background: "oklch(0.78 0.14 72 / 0.1)",
                          border: "1px solid oklch(0.78 0.14 72 / 0.25)",
                        }}
                      >
                        <p
                          className="text-[10px] font-semibold uppercase tracking-wide"
                          style={{ color: "oklch(0.78 0.14 72)" }}
                        >
                          {lvl.level}
                        </p>
                        <p className="text-sm font-bold text-foreground">
                          {lvl.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {lvl.desc}
                        </p>
                      </div>
                    </div>
                    {i < 2 && (
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 hidden sm:block" />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                <Info className="inline w-3 h-3 mr-1" />
                Click "View by Category" on the dashboard to drill into category
                rates. Click any category to see individual task rates.
              </p>
            </div>
          </div>
        </motion.section>

        {/* ── Final CTA ─────────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="pb-12 text-center"
        >
          <Button
            onClick={() => onNavigate("dashboard")}
            size="lg"
            className="gap-2 font-semibold px-10 h-12 text-base"
            style={{
              background: "oklch(0.78 0.14 72)",
              color: "oklch(0.12 0.008 260)",
            }}
            data-ocid="landing.bottom.primary_button"
          >
            Get Started — Open Dashboard
            <ArrowRight className="w-5 h-5" />
          </Button>
        </motion.section>
      </div>

      {/* Footer */}
      <footer
        className="border-t py-6 text-center text-xs text-muted-foreground"
        style={{ borderColor: "oklch(0.28 0.015 255)" }}
      >
        © {new Date().getFullYear()}. Built with{" "}
        <span style={{ color: "oklch(0.78 0.14 72)" }}>♥</span> using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
            typeof window !== "undefined" ? window.location.hostname : "",
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors underline underline-offset-2"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
