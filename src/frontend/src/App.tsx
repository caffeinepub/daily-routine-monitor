import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import Layout from "./components/app/Layout";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useGetCallerUserProfile } from "./hooks/useQueries";
import DashboardPage from "./pages/DashboardPage";
import HistoryPage from "./pages/HistoryPage";
import LoginPage from "./pages/LoginPage";
import ProfileSetupPage from "./pages/ProfileSetupPage";
import RoutinesPage from "./pages/RoutinesPage";
import SettingsPage from "./pages/SettingsPage";

type Page = "dashboard" | "routines" | "history" | "settings";

function AppContent() {
  const { identity } = useInternetIdentity();
  const isAuthenticated = !!identity;

  const {
    data: userProfile,
    isLoading: profileLoading,
    isFetched: profileFetched,
  } = useGetCallerUserProfile();

  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  // Not authenticated — show login
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Still loading profile — show nothing (prevents flash)
  if (profileLoading || !profileFetched) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "oklch(0.78 0.14 72)" }}
          >
            <svg
              className="w-5 h-5 text-black"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-label="Loading"
              role="img"
            >
              <title>Loading</title>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div
            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{
              borderColor: "oklch(0.78 0.14 72)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      </div>
    );
  }

  // Profile not set — show setup
  const showProfileSetup =
    isAuthenticated && profileFetched && userProfile === null;

  if (showProfileSetup) {
    return (
      <ProfileSetupPage
        onComplete={() => {
          // Profile saved, re-render will pick it up
        }}
      />
    );
  }

  const userName = userProfile?.name ?? "User";

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return (
          <DashboardPage
            userName={userName}
            onNavigateToRoutines={() => setCurrentPage("routines")}
          />
        );
      case "routines":
        return <RoutinesPage />;
      case "history":
        return <HistoryPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return (
          <DashboardPage
            userName={userName}
            onNavigateToRoutines={() => setCurrentPage("routines")}
          />
        );
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      userName={userName}
    >
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <>
      <AppContent />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "oklch(0.165 0.012 255)",
            border: "1px solid oklch(0.28 0.015 255)",
            color: "oklch(0.94 0.012 80)",
          },
        }}
      />
    </>
  );
}
