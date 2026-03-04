import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, Clock, Loader2, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

const features = [
  { icon: CheckCircle2, text: "Track daily, weekly & custom routines" },
  { icon: Clock, text: "Get smart prompts when tasks are due" },
  { icon: Calendar, text: "View streaks and completion history" },
];

export default function LoginPage() {
  const { login, isLoggingIn, isInitializing, isLoginError, loginError } =
    useInternetIdentity();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, oklch(0.78 0.14 72) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-8"
          style={{
            background:
              "radial-gradient(circle, oklch(0.65 0.18 200) 0%, transparent 70%)",
          }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(0.94 0.012 80) 1px, transparent 1px), linear-gradient(90deg, oklch(0.94 0.012 80) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo mark */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="flex justify-center mb-8"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-glow-amber"
            style={{ background: "oklch(0.78 0.14 72)" }}
          >
            <Zap className="w-8 h-8 text-black" strokeWidth={2.5} />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-display font-bold text-foreground mb-3 tracking-tight">
            RoutineOS
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Your personal command center for building
            <br />
            powerful daily habits.
          </p>
        </motion.div>

        {/* Feature list */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-card border border-border rounded-xl p-5 mb-6 space-y-3"
        >
          {features.map(({ icon: Icon, text }, i) => (
            <motion.div
              key={text}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.08, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "oklch(0.78 0.14 72 / 0.15)" }}
              >
                <Icon
                  className="w-3.5 h-3.5"
                  style={{ color: "oklch(0.78 0.14 72)" }}
                />
              </div>
              <span className="text-sm text-foreground/80">{text}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Login button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.3 }}
        >
          <Button
            onClick={login}
            disabled={isLoggingIn || isInitializing}
            className="w-full h-12 text-base font-semibold rounded-xl shadow-glow-amber transition-all duration-200 hover:shadow-none"
            style={{
              background: "oklch(0.78 0.14 72)",
              color: "oklch(0.12 0.008 260)",
            }}
          >
            {isLoggingIn || isInitializing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isInitializing ? "Initializing..." : "Logging in..."}
              </>
            ) : (
              "Sign in to get started"
            )}
          </Button>

          {isLoginError && loginError && (
            <p className="text-center text-sm text-destructive mt-3">
              {loginError.message}
            </p>
          )}
        </motion.div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.3 }}
          className="text-center text-xs text-muted-foreground mt-6"
        >
          Powered by Internet Identity — secure & private
        </motion.p>
      </motion.div>
    </div>
  );
}
