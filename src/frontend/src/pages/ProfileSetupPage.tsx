import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useSaveUserProfile } from "../hooks/useQueries";

interface ProfileSetupPageProps {
  onComplete: () => void;
}

export default function ProfileSetupPage({
  onComplete,
}: ProfileSetupPageProps) {
  const [name, setName] = useState("");
  const saveProfile = useSaveUserProfile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      await saveProfile.mutateAsync({ name: trimmed });
      toast.success("Welcome to RoutineOS!");
      onComplete();
    } catch {
      toast.error("Failed to save profile. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="flex justify-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-glow-amber"
            style={{ background: "oklch(0.78 0.14 72)" }}
          >
            <Zap className="w-7 h-7 text-black" strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="text-3xl font-display font-bold text-center text-foreground mb-2">
          Welcome aboard!
        </h1>
        <p className="text-center text-muted-foreground mb-8 text-sm">
          What should we call you?
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground/80">
              Your name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                placeholder="e.g. Alex"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-9 h-11 bg-card border-border"
                autoFocus
                maxLength={50}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={!name.trim() || saveProfile.isPending}
            className="w-full h-11 font-semibold rounded-xl"
            style={{
              background: name.trim() ? "oklch(0.78 0.14 72)" : undefined,
              color: name.trim() ? "oklch(0.12 0.008 260)" : undefined,
            }}
          >
            {saveProfile.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Let's go →"
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
