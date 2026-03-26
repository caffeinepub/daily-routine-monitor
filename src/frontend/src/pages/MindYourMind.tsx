import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Bell,
  ChevronDown,
  Pause,
  Play,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type BellTone = "soft-chime" | "sharp-bell" | "deep-gong";
type TimerStatus = "idle" | "running" | "paused" | "complete";

interface Settings {
  minInterval: number; // seconds
  maxInterval: number; // seconds
  sessionDuration: number; // seconds
  alertBellCount: number; // rings per random alert
  bellTone: BellTone;
  volume: number; // 0-1
}

const DEFAULT_SETTINGS: Settings = {
  minInterval: 120,
  maxInterval: 240,
  sessionDuration: 1800,
  alertBellCount: 3,
  bellTone: "soft-chime",
  volume: 0.7,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem("mind-your-mind-settings");
    if (raw) {
      const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      return parsed;
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem("mind-your-mind-settings", JSON.stringify(s));
  } catch {
    // ignore
  }
}

// ──────────────────────────────────────────────
// Web Audio bell synthesis
// ──────────────────────────────────────────────
function createAudioContext(): AudioContext {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
}

// Returns the duration of a single bell ring in ms
function getBellDurationMs(tone: BellTone): number {
  if (tone === "soft-chime") return 900;
  if (tone === "sharp-bell") return 500;
  return 2200; // deep-gong
}

function playBell(tone: BellTone, volume: number, audioCtx: AudioContext) {
  const gainNode = audioCtx.createGain();
  gainNode.connect(audioCtx.destination);

  if (tone === "soft-chime") {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      volume * 0.6,
      audioCtx.currentTime + 0.01,
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + 0.8,
    );
    osc.connect(gainNode);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.85);
  } else if (tone === "sharp-bell") {
    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      volume * 0.7,
      audioCtx.currentTime + 0.005,
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + 0.4,
    );
    osc.connect(gainNode);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.45);
  } else {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 2);
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      volume * 0.8,
      audioCtx.currentTime + 0.02,
    );
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2);
    osc.connect(gainNode);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 2.1);
  }
}

async function playBellSafe(
  tone: BellTone,
  volume: number,
  ctxRef: React.MutableRefObject<AudioContext | null>,
) {
  try {
    if (!ctxRef.current) {
      ctxRef.current = createAudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      await ctxRef.current.resume();
    }
    playBell(tone, volume, ctxRef.current);
  } catch {
    // ignore audio errors
  }
}

// ──────────────────────────────────────────────
// SVG Progress Ring
// ──────────────────────────────────────────────
function ProgressRing({
  progress,
  size = 280,
  isComplete,
}: { progress: number; size?: number; isComplete: boolean }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg
      width={size}
      height={size}
      style={{ transform: "rotate(-90deg)" }}
      aria-hidden="true"
    >
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        stroke="oklch(0.88 0.02 210)"
      />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        stroke={isComplete ? "oklch(0.58 0.12 160)" : "oklch(0.52 0.12 195)"}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
      />
    </svg>
  );
}

// ──────────────────────────────────────────────
// Utility
// ──────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function randomIntervalMs(minSec: number, maxSec: number): number {
  const minMs = minSec * 1000;
  const maxMs = maxSec * 1000;
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

// ──────────────────────────────────────────────
// MinSecInput – minutes + seconds dual input
// ──────────────────────────────────────────────
function MinSecInput({
  label,
  value,
  onChange,
  disabled,
  hint,
  minSeconds = 1,
  maxSeconds = 7200,
}: {
  label: string;
  value: number; // total seconds
  onChange: (totalSeconds: number) => void;
  disabled: boolean;
  hint?: string;
  minSeconds?: number;
  maxSeconds?: number;
}) {
  const mins = Math.floor(value / 60);
  const secs = value % 60;

  function handleMinsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const m = Math.max(0, Math.min(999, Number(e.target.value) || 0));
    onChange(m * 60 + secs);
  }

  function handleSecsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const s = Math.max(0, Math.min(59, Number(e.target.value) || 0));
    onChange(mins * 60 + s);
  }

  function handleBlur() {
    const clamped = Math.max(minSeconds, Math.min(maxSeconds, value));
    if (clamped !== value) onChange(clamped);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-foreground/80">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex items-center gap-1.5">
        <div className="flex flex-col items-center gap-0.5">
          <Input
            type="number"
            min={0}
            max={999}
            value={mins}
            disabled={disabled}
            onChange={handleMinsChange}
            onBlur={handleBlur}
            className="w-16 text-center bg-white border-border focus:ring-primary/30 disabled:opacity-40 px-1"
          />
          <span className="text-[10px] text-muted-foreground">min</span>
        </div>
        <span className="text-lg font-semibold text-muted-foreground mb-3">
          :
        </span>
        <div className="flex flex-col items-center gap-0.5">
          <Input
            type="number"
            min={0}
            max={59}
            value={secs}
            disabled={disabled}
            onChange={handleSecsChange}
            onBlur={handleBlur}
            className="w-16 text-center bg-white border-border focus:ring-primary/30 disabled:opacity-40 px-1"
          />
          <span className="text-[10px] text-muted-foreground">sec</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Number input helper (used for bell count)
// ──────────────────────────────────────────────
function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
  ocid,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled: boolean;
  ocid: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium text-foreground/80">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        data-ocid={ocid}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v) && v >= min && v <= max) onChange(v);
        }}
        className="w-full bg-white border-border focus:ring-primary/30 disabled:opacity-40"
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function MindYourMind() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [nextBellSeconds, setNextBellSeconds] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [bellAnimating, setBellAnimating] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bellTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Continuous completion bell loop
  const continuousBellIntervalRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const sessionEndTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const nextBellAtRef = useRef<number>(0);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  function clearAllTimers() {
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    if (bellTimeoutRef.current) clearTimeout(bellTimeoutRef.current);
    if (completionTimeoutRef.current)
      clearTimeout(completionTimeoutRef.current);
    if (continuousBellIntervalRef.current)
      clearInterval(continuousBellIntervalRef.current);
    tickIntervalRef.current = null;
    bellTimeoutRef.current = null;
    completionTimeoutRef.current = null;
    continuousBellIntervalRef.current = null;
  }

  const triggerBellAnimation = useCallback(() => {
    setBellAnimating(true);
    setTimeout(() => setBellAnimating(false), 700);
  }, []);

  const scheduleBell = useCallback(() => {
    const intervalMs = randomIntervalMs(
      settings.minInterval,
      settings.maxInterval,
    );
    const bellAt = Date.now() + intervalMs;
    nextBellAtRef.current = bellAt;
    setNextBellSeconds(Math.round(intervalMs / 1000));

    bellTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      if (now < sessionEndTimeRef.current) {
        for (let i = 0; i < settings.alertBellCount; i++) {
          setTimeout(() => {
            playBellSafe(settings.bellTone, settings.volume, audioCtxRef);
            if (i === 0) triggerBellAnimation();
          }, i * 1200);
        }
        scheduleBell();
      }
    }, intervalMs);
  }, [settings, triggerBellAnimation]);

  const startTick = useCallback((endTime: number) => {
    tickIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      const nextIn = Math.max(
        0,
        Math.round((nextBellAtRef.current - Date.now()) / 1000),
      );
      setNextBellSeconds(nextIn);
    }, 500);
  }, []);

  // Start a continuous looping bell that repeats until clearAllTimers is called
  const startContinuousBell = useCallback(
    (tone: BellTone, volume: number) => {
      const ringPeriodMs = getBellDurationMs(tone) + 600; // gap between rings
      // Ring immediately, then repeat
      playBellSafe(tone, volume, audioCtxRef);
      triggerBellAnimation();
      continuousBellIntervalRef.current = setInterval(() => {
        playBellSafe(tone, volume, audioCtxRef);
        triggerBellAnimation();
      }, ringPeriodMs);
    },
    [triggerBellAnimation],
  );

  function handleStart() {
    const totalMs = settings.sessionDuration * 1000;
    const endTime = Date.now() + totalMs;
    sessionEndTimeRef.current = endTime;
    setRemainingSeconds(settings.sessionDuration);
    setStatus("running");
    setSettingsOpen(false);

    startTick(endTime);
    scheduleBell();

    completionTimeoutRef.current = setTimeout(() => {
      clearAllTimers();
      setStatus("complete");
      setRemainingSeconds(0);
      setNextBellSeconds(null);
      startContinuousBell(settings.bellTone, settings.volume);
    }, totalMs);
  }

  function handlePause() {
    if (status === "running") {
      pausedAtRef.current = Date.now();
      clearAllTimers();
      setStatus("paused");
    } else if (status === "paused") {
      const pausedDuration = Date.now() - pausedAtRef.current;
      sessionEndTimeRef.current += pausedDuration;
      nextBellAtRef.current += pausedDuration;

      const endTime = sessionEndTimeRef.current;
      setStatus("running");
      startTick(endTime);

      const bellDelay = Math.max(0, nextBellAtRef.current - Date.now());
      setNextBellSeconds(Math.round(bellDelay / 1000));
      bellTimeoutRef.current = setTimeout(() => {
        if (Date.now() < sessionEndTimeRef.current) {
          for (let i = 0; i < settings.alertBellCount; i++) {
            setTimeout(() => {
              playBellSafe(settings.bellTone, settings.volume, audioCtxRef);
              if (i === 0) triggerBellAnimation();
            }, i * 1200);
          }
          scheduleBell();
        }
      }, bellDelay);

      const remaining = Math.max(0, sessionEndTimeRef.current - Date.now());
      completionTimeoutRef.current = setTimeout(() => {
        clearAllTimers();
        setStatus("complete");
        setRemainingSeconds(0);
        setNextBellSeconds(null);
        startContinuousBell(settings.bellTone, settings.volume);
      }, remaining);
    }
  }

  function handleReset() {
    clearAllTimers();
    setStatus("idle");
    setRemainingSeconds(0);
    setNextBellSeconds(null);
    setSettingsOpen(true);
  }

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  const totalSeconds = settings.sessionDuration;
  const progress =
    status === "idle"
      ? 1
      : totalSeconds > 0
        ? remainingSeconds / totalSeconds
        : 0;
  const isActive = status === "running" || status === "paused";
  const isComplete = status === "complete";

  function formatNextBell(secs: number | null): string {
    if (secs === null || secs <= 0) return "—";
    if (secs < 60) return `${secs}s`;
    const mins = secs / 60;
    const rounded = Math.round(mins * 2) / 2;
    if (rounded < 1) return "< 1 min";
    return `~${rounded} min`;
  }

  function getStatusText(): string {
    if (status === "idle") return "Ready to begin";
    if (status === "running") return "Session Active";
    if (status === "paused") return "Paused";
    return "Session Complete";
  }

  function getStatusColor(): string {
    if (status === "running") return "text-teal-500";
    if (status === "paused") return "text-amber-500";
    if (status === "complete") return "text-sage-500";
    return "text-muted-foreground";
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="py-6 px-4 text-center">
        <h1 className="font-display text-3xl sm:text-4xl text-foreground tracking-tight">
          Mind Your Mind
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mindful bell meditation timer
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start px-4 pb-12 gap-8">
        {/* Session Complete overlay */}
        {isComplete && (
          <div
            className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-card-lift border border-border p-8 text-center animate-scale-in"
            data-ocid="session.success_state"
          >
            <div
              className={`text-6xl mb-4 ${bellAnimating ? "animate-bell-ring" : ""}`}
            >
              🙏
            </div>
            <h2 className="font-display text-2xl text-foreground mb-2">
              Session Complete
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              Well done. Tap below to stop the bell.
            </p>
            <Button
              size="lg"
              className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-medium"
              onClick={handleReset}
              data-ocid="session.primary_button"
            >
              Begin Again
            </Button>
          </div>
        )}

        {/* Timer Ring */}
        {!isComplete && (
          <div
            className="relative flex items-center justify-center"
            data-ocid="timer.panel"
          >
            <div
              className={`absolute rounded-full transition-all duration-1000 ${
                status === "running" ? "animate-pulse-ring" : ""
              }`}
              style={{
                width: 280,
                height: 280,
                background:
                  "radial-gradient(circle, oklch(0.55 0.14 195 / 0.08) 0%, transparent 70%)",
              }}
            />
            <ProgressRing progress={progress} size={280} isComplete={false} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <div
                className={`text-2xl transition-transform ${bellAnimating ? "animate-bell-ring" : ""}`}
                aria-hidden="true"
              >
                <Bell
                  size={28}
                  className={
                    status === "running"
                      ? "text-teal-500"
                      : "text-muted-foreground"
                  }
                  strokeWidth={1.5}
                />
              </div>
              <span
                className="font-mono text-4xl sm:text-5xl font-semibold tracking-tight text-foreground"
                data-ocid="timer.panel"
              >
                {status === "idle"
                  ? formatTime(settings.sessionDuration)
                  : formatTime(remainingSeconds)}
              </span>
              <span className={`text-sm font-medium mt-1 ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
          </div>
        )}

        {/* Next bell indicator */}
        {status === "running" && nextBellSeconds !== null && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
            <Bell size={13} strokeWidth={2} />
            <span>Next bell in {formatNextBell(nextBellSeconds)}</span>
          </div>
        )}
        {status === "paused" && (
          <div className="flex items-center gap-2 text-sm text-amber-500/80 animate-fade-in">
            <span>Session paused</span>
          </div>
        )}

        {/* Controls */}
        {!isComplete && (
          <div className="flex items-center gap-3" data-ocid="controls.panel">
            {status === "idle" ? (
              <Button
                size="lg"
                className="bg-teal-500 hover:bg-teal-600 text-white px-10 py-6 text-base rounded-2xl font-medium shadow-teal-glow"
                onClick={handleStart}
                data-ocid="session.primary_button"
              >
                <Play size={18} className="mr-2" />
                Start Session
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-6 text-base rounded-2xl font-medium border-border hover:border-primary/40"
                onClick={handlePause}
                data-ocid="session.toggle"
              >
                {status === "running" ? (
                  <>
                    <Pause size={18} className="mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play size={18} className="mr-2" />
                    Resume
                  </>
                )}
              </Button>
            )}

            {isActive && (
              <Button
                size="lg"
                variant="ghost"
                className="px-6 py-6 text-base rounded-2xl text-muted-foreground hover:text-destructive"
                onClick={handleReset}
                data-ocid="session.delete_button"
              >
                <RotateCcw size={18} />
              </Button>
            )}
          </div>
        )}

        {/* Settings panel */}
        {!isActive && !isComplete && (
          <div className="w-full max-w-sm">
            <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
              <CollapsibleTrigger
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white border border-border hover:border-primary/30 transition-colors text-sm font-medium text-foreground/70"
                data-ocid="settings.toggle"
              >
                <span className="flex items-center gap-2">
                  <Settings2 size={15} />
                  Settings
                </span>
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-200 ${settingsOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div
                  className="mt-3 bg-white border border-border rounded-2xl p-5 shadow-card-soft flex flex-col gap-5"
                  data-ocid="settings.panel"
                >
                  {/* Intervals */}
                  <div className="grid grid-cols-2 gap-4">
                    <MinSecInput
                      label="Min interval"
                      value={settings.minInterval}
                      minSeconds={1}
                      maxSeconds={settings.maxInterval}
                      onChange={(v) => {
                        const clamped = Math.min(v, settings.maxInterval);
                        updateSetting("minInterval", Math.max(1, clamped));
                      }}
                      disabled={isActive}
                    />
                    <MinSecInput
                      label="Max interval"
                      value={settings.maxInterval}
                      minSeconds={settings.minInterval}
                      maxSeconds={7200}
                      onChange={(v) => {
                        const clamped = Math.max(v, settings.minInterval);
                        updateSetting("maxInterval", Math.min(7200, clamped));
                      }}
                      disabled={isActive}
                    />
                  </div>

                  {/* Session duration */}
                  <MinSecInput
                    label="Session duration"
                    value={settings.sessionDuration}
                    minSeconds={1}
                    maxSeconds={10800}
                    onChange={(v) => {
                      updateSetting(
                        "sessionDuration",
                        Math.max(1, Math.min(10800, v)),
                      );
                    }}
                    disabled={isActive}
                    hint="Total active session length"
                  />

                  {/* Alert bell count */}
                  <NumberInput
                    label="Alert bell count"
                    value={settings.alertBellCount}
                    min={1}
                    max={20}
                    onChange={(v) => updateSetting("alertBellCount", v)}
                    disabled={isActive}
                    ocid="settings.input"
                    hint="Times the bell rings at each random interval"
                  />

                  {/* Bell tone */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-sm font-medium text-foreground/80">
                      Bell tone
                    </Label>
                    <Select
                      value={settings.bellTone}
                      onValueChange={(v) =>
                        updateSetting("bellTone", v as BellTone)
                      }
                      disabled={isActive}
                    >
                      <SelectTrigger
                        className="bg-white"
                        data-ocid="settings.select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="soft-chime">Soft Chime</SelectItem>
                        <SelectItem value="sharp-bell">Sharp Bell</SelectItem>
                        <SelectItem value="deep-gong">Deep Gong</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Volume */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-foreground/80">
                        Volume
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(settings.volume * 100)}%
                      </span>
                    </div>
                    <Slider
                      min={0}
                      max={1}
                      step={0.05}
                      value={[settings.volume]}
                      onValueChange={([v]) => updateSetting("volume", v)}
                      disabled={isActive}
                      data-ocid="settings.toggle"
                      className="[&_[role=slider]]:bg-teal-500 [&_[role=slider]]:border-teal-500"
                    />
                  </div>

                  {/* Preview bell */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-border text-foreground/60 hover:border-primary/30 hover:text-primary rounded-xl"
                    onClick={() => {
                      for (let i = 0; i < settings.alertBellCount; i++) {
                        setTimeout(() => {
                          playBellSafe(
                            settings.bellTone,
                            settings.volume,
                            audioCtxRef,
                          );
                          if (i === 0) triggerBellAnimation();
                        }, i * 1200);
                      }
                    }}
                    data-ocid="settings.secondary_button"
                  >
                    <Bell size={14} className="mr-2" />
                    Preview Bell
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()}.{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary transition-colors"
        >
          Built with love using caffeine.ai
        </a>
      </footer>
    </div>
  );
}
