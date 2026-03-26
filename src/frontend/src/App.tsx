import { Toaster } from "@/components/ui/sonner";
import MindYourMind from "./pages/MindYourMind";

export default function App() {
  return (
    <>
      <MindYourMind />
      <Toaster position="top-right" />
    </>
  );
}
