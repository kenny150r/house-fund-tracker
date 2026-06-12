import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { DataProvider, useData } from "./context/DataContext";
import { isConfigured } from "./lib/supabase";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Holdings from "./pages/Holdings";
import Grants from "./pages/Grants";
import Income from "./pages/Income";
import Expenses from "./pages/Expenses";
import Scenarios from "./pages/Scenarios";
import Settings from "./pages/Settings";

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">{children}</div>
  );
}

function Gate() {
  const { user, loading: authLoading } = useAuth();

  if (!isConfigured) {
    return (
      <FullScreen>
        <div className="card max-w-md text-center">
          <h1 className="text-lg font-bold">Configuration needed</h1>
          <p className="mt-2 text-sm text-slate-600">
            Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> in your environment, then reload.
          </p>
        </div>
      </FullScreen>
    );
  }

  if (authLoading) {
    return (
      <FullScreen>
        <div className="text-slate-500">Loading…</div>
      </FullScreen>
    );
  }

  if (!user) return <Login />;

  return (
    <DataProvider>
      <AppRoutes />
    </DataProvider>
  );
}

function AppRoutes() {
  const { loading, needsOnboarding } = useData();

  if (loading) {
    return (
      <FullScreen>
        <div className="text-slate-500">Loading your household…</div>
      </FullScreen>
    );
  }

  if (needsOnboarding) return <Onboarding />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="holdings" element={<Holdings />} />
        <Route path="grants" element={<Grants />} />
        <Route path="income" element={<Income />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="scenarios" element={<Scenarios />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
