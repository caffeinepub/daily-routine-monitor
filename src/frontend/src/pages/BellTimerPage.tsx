import { Bell, Pause, Play, RotateCcw, Settings, Volume2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "work" | "rest" | "done";
export type ToneType = "soft-chime" | "sharp-bell" | "deep-gong";

interface ToneConfig {
  waveform: OscillatorType;
  baseFreq: number;
  decay: number;
  gain: number;
}

const TONE_CONFIGS: Record<ToneType, ToneConfig> = {
  "soft-chime": { waveform: "sine", baseFreq: 523, decay: 2, gain: 0.7 },
  "sharp-bell": { waveform: "triangle", baseFreq: 880, decay: 1.5, gain: 0.65 },
  "deep-gong": { waveform: "sine", baseFreq: 131, decay: 3, gain: 0.9 },
};

const TONE_LABELS: Record<ToneType, string> = {
  "soft-chime": "Soft Chime",
  "sharp-bell": "Sharp Bell",
  "deep-gong": "Deep Gong",
};

// ─── Audio Helpers ────────────────────────────────────────────────────────────

function playNote(
  ctx: AudioContext,
  freq: number,
  toneType: ToneType,
  volume: number,
  startOffset: number,
) {
  const cfg = TONE_CONFIGS[toneType];
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = cfg.waveform;
  const t = ctx.currentTime + startOffset;
  const vol = cfg.gain * (volume / 100);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + cfg.decay);
  osc.start(t);
  osc.stop(t + cfg.decay);
}

function playBell1(ctx: AudioContext, toneType: ToneType, volume: number) {
  const cfg = TONE_CONFIGS[toneType];
  playNote(ctx, cfg.baseFreq, toneType, volume, 0);
}

function playBell2(ctx: AudioContext, toneType: ToneType, volume: number) {
  const cfg = TONE_CONFIGS[toneType];
  playNote(ctx, cfg.baseFreq, toneType, volume, 0);
  playNote(ctx, cfg.baseFreq, toneType, volume * 0.8, 0.3);
}

function playBell3(ctx: AudioContext, toneType: ToneType, volume: number) {
  const cfg = TONE_CONFIGS[toneType];
  // Ascending 3-note chime — scale up from base freq
  const freqs = [cfg.baseFreq, cfg.baseFreq * 1.25, cfg.baseFreq * 1.5];
  for (let i = 0; i < freqs.length; i++) {
    playNote(ctx, freqs[i]!, toneType, volume, i * 0.3);
  }
}

// ─── Circular Progress Ring ───────────────────────────────────────────────────

interface RingProps {
  progress: number; // 0–1
  phase: Phase;
}

function ProgressRing({ progress, phase }: RingProps) {
  const size = 280;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const ringColor =
    phase === "rest"
      ? "oklch(0.72 0.16 150)"
      : phase === "done"
        ? "oklch(0.78 0.14 72)"
        : "oklch(0.65 0.18 35)";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: "rotate(-90deg)" }}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="oklch(0.22 0.015 255)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={ringColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transition: "stroke-dashoffset 0.9s linear, stroke 0.4s ease",
        }}
      />
    </svg>
  );
}

// ─── Tone Picker ──────────────────────────────────────────────────────────────

interface TonePickerProps {
  value: ToneType;
  disabled: boolean;
  onChange: (t: ToneType) => void;
}

function TonePicker({ value, disabled, onChange }: TonePickerProps) {
  const options: ToneType[] = ["soft-chime", "sharp-bell", "deep-gong"];
  return (
    <div
      className="flex rounded-lg overflow-hidden"
      style={{ border: "1px solid oklch(0.28 0.015 255)" }}
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className="flex-1 text-[10px] font-semibold px-2 py-1.5 transition-colors disabled:opacity-40"
          style={{
            background:
              value === opt ? "oklch(0.28 0.06 35)" : "oklch(0.18 0.012 255)",
            color:
              value === opt ? "oklch(0.82 0.16 35)" : "oklch(0.55 0.015 255)",
            borderRight:
              opt !== "deep-gong" ? "1px solid oklch(0.28 0.015 255)" : "none",
          }}
        >
          {TONE_LABELS[opt].split(" ")[1]}
        </button>
      ))}
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

interface SettingsPanelProps {
  totalCycles: number;
  workDuration: number;
  restDuration: number;
  volume: number;
  bell1Tone: ToneType;
  bell2Tone: ToneType;
  bell3Tone: ToneType;
  disabled: boolean;
  onChange: (
    key: "totalCycles" | "workDuration" | "restDuration",
    value: number,
  ) => void;
  onVolumeChange: (v: number) => void;
  onBellToneChange: (bell: 1 | 2 | 3, tone: ToneType) => void;
  onPreview: (bell: 1 | 2 | 3) => void;
}

function SettingsPanel({
  totalCycles,
  workDuration,
  restDuration,
  volume,
  bell1Tone,
  bell2Tone,
  bell3Tone,
  disabled,
  onChange,
  onVolumeChange,
  onBellToneChange,
  onPreview,
}: SettingsPanelProps) {
  const numField = (
    label: string,
    key: "totalCycles" | "workDuration" | "restDuration",
    value: number,
    min: number,
    max: number,
  ) => (
    <div className="flex items-center justify-between gap-3">
      <label
        htmlFor={`setting-${key}`}
        className="text-sm font-medium"
        style={{ color: "oklch(0.68 0.015 255)" }}
      >
        {label}
      </label>
      <input
        id={`setting-${key}`}
        data-ocid={`timer.${key}.input`}
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = Number.parseInt(e.target.value, 10);
          if (!Number.isNaN(v) && v >= min && v <= max) onChange(key, v);
        }}
        className="w-20 text-center text-sm rounded-md px-2 py-1.5 outline-none transition-colors disabled:opacity-40"
        style={{
          background: "oklch(0.18 0.012 255)",
          border: "1px solid oklch(0.28 0.015 255)",
          color: "oklch(0.94 0.012 80)",
        }}
      />
    </div>
  );

  const bellTones: {
    bell: 1 | 2 | 3;
    label: string;
    desc: string;
    tone: ToneType;
    color: string;
  }[] = [
    {
      bell: 1,
      label: "Bell 1",
      desc: "End of Work",
      tone: bell1Tone,
      color: "oklch(0.72 0.18 35)",
    },
    {
      bell: 2,
      label: "Bell 2",
      desc: "End of Rest",
      tone: bell2Tone,
      color: "oklch(0.72 0.16 150)",
    },
    {
      bell: 3,
      label: "Bell 3",
      desc: "Complete",
      tone: bell3Tone,
      color: "oklch(0.78 0.14 72)",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="mt-4 rounded-xl p-4 space-y-4"
      style={{
        background: "oklch(0.165 0.012 255)",
        border: "1px solid oklch(0.26 0.015 255)",
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "oklch(0.5 0.015 255)" }}
      >
        Settings
      </p>

      {/* Volume Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="setting-volume"
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ color: "oklch(0.68 0.015 255)" }}
          >
            <Volume2 className="w-3.5 h-3.5" />
            Volume
          </label>
          <span
            className="text-xs font-mono tabular-nums"
            style={{ color: "oklch(0.55 0.015 255)" }}
          >
            {volume}%
          </span>
        </div>
        <input
          id="setting-volume"
          data-ocid="timer.volume.input"
          type="range"
          min={0}
          max={100}
          value={volume}
          disabled={disabled}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-40"
          style={{ accentColor: "oklch(0.65 0.18 35)" }}
        />
      </div>

      {/* Timer Settings */}
      <div
        className="space-y-3 pt-1"
        style={{ borderTop: "1px solid oklch(0.24 0.012 255)" }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-widest pt-1"
          style={{ color: "oklch(0.42 0.012 255)" }}
        >
          Timer
        </p>
        {numField("Total Cycles", "totalCycles", totalCycles, 1, 20)}
        {numField("Work Duration (sec)", "workDuration", workDuration, 5, 300)}
        {numField("Rest Duration (sec)", "restDuration", restDuration, 1, 120)}
      </div>

      {/* Bell Tone Pickers */}
      <div
        className="space-y-3 pt-1"
        style={{ borderTop: "1px solid oklch(0.24 0.012 255)" }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-widest pt-1"
          style={{ color: "oklch(0.42 0.012 255)" }}
        >
          Bell Tones
        </p>
        {bellTones.map(({ bell, label, desc, tone, color }) => (
          <div key={bell} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold" style={{ color }}>
                  {label}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: "oklch(0.45 0.012 255)" }}
                >
                  · {desc}
                </span>
              </div>
              <button
                type="button"
                data-ocid={`timer.bell${bell}.preview.button`}
                disabled={disabled}
                onClick={() => onPreview(bell)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors disabled:opacity-40 active:scale-95"
                style={{
                  background: "oklch(0.22 0.015 255)",
                  color: "oklch(0.65 0.015 255)",
                  border: "1px solid oklch(0.3 0.015 255)",
                }}
              >
                <Play className="w-2.5 h-2.5" />
                Preview
              </button>
            </div>
            <TonePicker
              value={tone}
              disabled={disabled}
              onChange={(t) => onBellToneChange(bell, t)}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BellTimerPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [running, setRunning] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [totalCycles, setTotalCycles] = useState(5);
  const [workDuration, setWorkDuration] = useState(30);
  const [restDuration, setRestDuration] = useState(5);
  const [timeLeft, setTimeLeft] = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [bellFlash, setBellFlash] = useState(false);

  // Tone customization state
  const [bell1Tone, setBell1Tone] = useState<ToneType>("soft-chime");
  const [bell2Tone, setBell2Tone] = useState<ToneType>("soft-chime");
  const [bell3Tone, setBell3Tone] = useState<ToneType>("soft-chime");
  const [volume, setVolume] = useState(80);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const triggerFlash = useCallback(() => {
    setBellFlash(true);
    setTimeout(() => setBellFlash(false), 600);
  }, []);

  const handlePreview = useCallback(
    (bell: 1 | 2 | 3) => {
      const ctx = getAudioCtx();
      if (bell === 1) playBell1(ctx, bell1Tone, volume);
      else if (bell === 2) playBell2(ctx, bell2Tone, volume);
      else playBell3(ctx, bell3Tone, volume);
    },
    [getAudioCtx, bell1Tone, bell2Tone, bell3Tone, volume],
  );

  const handleBellToneChange = useCallback(
    (bell: 1 | 2 | 3, tone: ToneType) => {
      if (bell === 1) setBell1Tone(tone);
      else if (bell === 2) setBell2Tone(tone);
      else setBell3Tone(tone);
    },
    [],
  );

  // Timer tick
  useEffect(() => {
    if (!running) return;

    const id = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev > 1) return prev - 1;

        const ctx = getAudioCtx();
        triggerFlash();

        if (phase === "work") {
          playBell1(ctx, bell1Tone, volume);
          setPhase("rest");
          return restDuration;
        }

        if (currentCycle < totalCycles) {
          playBell2(ctx, bell2Tone, volume);
          setCurrentCycle((c) => c + 1);
          setPhase("work");
          return workDuration;
        }

        playBell3(ctx, bell3Tone, volume);
        setPhase("done");
        setRunning(false);
        return 0;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [
    running,
    phase,
    currentCycle,
    totalCycles,
    workDuration,
    restDuration,
    getAudioCtx,
    triggerFlash,
    bell1Tone,
    bell2Tone,
    bell3Tone,
    volume,
  ]);

  const handlePlay = () => {
    if (phase === "idle" || phase === "done") {
      setCurrentCycle(1);
      setPhase("work");
      setTimeLeft(workDuration);
      setRunning(true);
    } else {
      setRunning((r) => !r);
    }
  };

  const handleReset = () => {
    setRunning(false);
    setPhase("idle");
    setCurrentCycle(1);
    setTimeLeft(workDuration);
  };

  const handleSettingChange = (
    key: "totalCycles" | "workDuration" | "restDuration",
    value: number,
  ) => {
    if (key === "totalCycles") setTotalCycles(value);
    if (key === "workDuration") {
      setWorkDuration(value);
      if (phase === "idle") setTimeLeft(value);
    }
    if (key === "restDuration") setRestDuration(value);
  };

  const totalDuration = phase === "rest" ? restDuration : workDuration;
  const progress =
    phase === "done"
      ? 1
      : phase === "idle"
        ? 0
        : (totalDuration - timeLeft) / totalDuration;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const phaseBadgeConfig: Record<
    Phase,
    { label: string; color: string; bg: string }
  > = {
    idle: {
      label: "READY",
      color: "oklch(0.68 0.015 255)",
      bg: "oklch(0.22 0.015 255)",
    },
    work: {
      label: "WORK",
      color: "oklch(0.82 0.16 35)",
      bg: "oklch(0.22 0.08 35)",
    },
    rest: {
      label: "REST",
      color: "oklch(0.78 0.14 150)",
      bg: "oklch(0.2 0.06 150)",
    },
    done: {
      label: "DONE",
      color: "oklch(0.78 0.14 72)",
      bg: "oklch(0.22 0.08 72)",
    },
  };

  const badge = phaseBadgeConfig[phase];
  const settingsDisabled = running || (phase !== "idle" && phase !== "done");
  const timerColor =
    phase === "rest"
      ? "oklch(0.72 0.16 150)"
      : phase === "done"
        ? "oklch(0.78 0.14 72)"
        : "oklch(0.72 0.18 35)";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ background: "oklch(0.10 0.008 260)" }}
    >
      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col items-center gap-5"
        style={{
          background: bellFlash
            ? "oklch(0.19 0.03 35)"
            : "oklch(0.155 0.012 255)",
          border: "1px solid oklch(0.26 0.015 255)",
          boxShadow: "0 8px 40px -8px oklch(0.05 0.008 260)",
          transition: "background 0.3s ease",
        }}
        data-ocid="timer.card"
      >
        {/* App Title */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell
              className="w-4 h-4"
              style={{ color: "oklch(0.65 0.18 35)" }}
            />
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "oklch(0.5 0.015 255)" }}
            >
              Interval Bell Timer
            </span>
          </div>
          <button
            type="button"
            data-ocid="timer.settings.toggle"
            onClick={() => setShowSettings((s) => !s)}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              color: showSettings
                ? "oklch(0.72 0.18 35)"
                : "oklch(0.55 0.015 255)",
              background: showSettings ? "oklch(0.22 0.06 35)" : "transparent",
            }}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Phase Badge */}
        <AnimatePresence mode="wait">
          <motion.span
            key={phase}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.2 }}
            className="text-xs font-bold tracking-[0.18em] px-3 py-1 rounded-full"
            style={{ color: badge.color, background: badge.bg }}
            data-ocid="timer.phase.badge"
          >
            {badge.label}
          </motion.span>
        </AnimatePresence>

        {/* Ring + Digits */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: 280, height: 280 }}
        >
          <ProgressRing progress={progress} phase={phase} />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <AnimatePresence mode="wait">
              <motion.span
                key={`${phase}-${timeLeft}`}
                initial={{ opacity: 0.6, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15 }}
                className="font-display font-bold tabular-nums leading-none"
                style={{
                  fontSize: 72,
                  color: timerColor,
                  letterSpacing: "-0.04em",
                }}
                data-ocid="timer.countdown"
              >
                {phase === "done"
                  ? "✓"
                  : formatTime(phase === "idle" ? workDuration : timeLeft)}
              </motion.span>
            </AnimatePresence>
            <span
              className="text-sm font-medium mt-1"
              style={{ color: "oklch(0.52 0.015 255)" }}
              data-ocid="timer.cycle.label"
            >
              {phase === "done"
                ? "Complete!"
                : `Cycle ${currentCycle} of ${totalCycles}`}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-ocid="timer.play_button"
            onClick={handlePlay}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
            style={{
              background: "oklch(0.65 0.18 35)",
              color: "oklch(0.98 0.005 80)",
              boxShadow: "0 4px 16px -4px oklch(0.65 0.18 35 / 0.5)",
            }}
          >
            {running ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {running
              ? "Pause"
              : phase === "done" || phase === "idle"
                ? "Start"
                : "Resume"}
          </button>

          <button
            type="button"
            data-ocid="timer.reset_button"
            onClick={handleReset}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
            style={{
              background: "transparent",
              border: "1px solid oklch(0.32 0.015 255)",
              color: "oklch(0.6 0.015 255)",
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>

        {/* Bell Legend */}
        <div
          className="w-full rounded-xl p-3 grid grid-cols-3 gap-2 text-center"
          style={{ background: "oklch(0.13 0.01 260)" }}
        >
          {[
            {
              label: "Bell 1",
              desc: "End of Work",
              tone: bell1Tone,
              color: "oklch(0.72 0.18 35)",
            },
            {
              label: "Bell 2",
              desc: "End of Rest",
              tone: bell2Tone,
              color: "oklch(0.72 0.16 150)",
            },
            {
              label: "Bell 3",
              desc: "Complete",
              tone: bell3Tone,
              color: "oklch(0.78 0.14 72)",
            },
          ].map((b) => (
            <div key={b.label} className="flex flex-col items-center gap-0.5">
              <span
                className="text-[10px] font-bold"
                style={{ color: b.color }}
              >
                {b.label}
              </span>
              <span
                className="text-[10px]"
                style={{ color: "oklch(0.45 0.012 255)" }}
              >
                {b.desc}
              </span>
              <span
                className="text-[9px] mt-0.5"
                style={{ color: "oklch(0.38 0.012 255)" }}
              >
                {TONE_LABELS[b.tone]}
              </span>
            </div>
          ))}
        </div>

        {/* Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <div className="w-full">
              <SettingsPanel
                totalCycles={totalCycles}
                workDuration={workDuration}
                restDuration={restDuration}
                volume={volume}
                bell1Tone={bell1Tone}
                bell2Tone={bell2Tone}
                bell3Tone={bell3Tone}
                disabled={settingsDisabled}
                onChange={handleSettingChange}
                onVolumeChange={setVolume}
                onBellToneChange={handleBellToneChange}
                onPreview={handlePreview}
              />
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <p className="mt-8 text-xs" style={{ color: "oklch(0.38 0.01 260)" }}>
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "oklch(0.55 0.015 255)" }}
        >
          caffeine.ai
        </a>
      </p>
    </div>
  );
}
