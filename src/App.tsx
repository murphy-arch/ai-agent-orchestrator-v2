import { Routes, Route, Navigate } from "react-router-dom";
import { trpc } from "./trpc";
import StackLayout from "./components/layout/StackLayout";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import Architecture from "./pages/Architecture";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import UserSettings from "./pages/UserSettings";
import SetupGuide from "./pages/SetupGuide";
import Login from "./pages/Login";
import AgentConsole from "./pages/AgentConsole";
import Memory from "./pages/Memory";
import Schedules from "./pages/Schedules";
import KnowledgeBase from "./pages/KnowledgeBase";
import Templates from "./pages/Templates";
import Blueprints from "./pages/Blueprints";
import ApiKeys from "./pages/ApiKeys";
import Teams from "./pages/Teams";
import Database from "./pages/Database";
import { Loader2 } from "lucide-react";

function LegacyRedirect({ to }: { to: string }) {
  const lastStackId = localStorage.getItem("lastStackId");
  if (lastStackId) {
    return <Navigate to={to.replace(":stackId", lastStackId)} replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function App() {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery();
  console.log("[App] auth.me state:", { isLoading, hasUser: !!user, error: error?.message });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    console.log("[App] rendering login routes (user is null)");
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Legacy redirects */}
      <Route path="/agents" element={<LegacyRedirect to="/stacks/:stackId/agents" />} />
      <Route path="/architecture" element={<LegacyRedirect to="/stacks/:stackId/architecture" />} />
      <Route path="/analytics" element={<LegacyRedirect to="/stacks/:stackId/analytics" />} />
      <Route path="/settings" element={<LegacyRedirect to="/stacks/:stackId/settings" />} />
      <Route path="/console" element={<LegacyRedirect to="/stacks/:stackId/console" />} />

      {/* Main routes */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/stacks/:stackId" element={<StackLayout />}>
        <Route path="agents" element={<Agents />} />
        <Route path="architecture" element={<Architecture />} />
        <Route path="memory" element={<Memory />} />
        <Route path="schedules" element={<Schedules />} />
        <Route path="knowledge" element={<KnowledgeBase />} />
        <Route path="templates" element={<Templates />} />
        <Route path="blueprints" element={<Blueprints />} />
        <Route path="api-keys" element={<ApiKeys />} />
        <Route path="teams" element={<Teams />} />
        <Route path="database" element={<Database />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="console" element={<AgentConsole />} />
      </Route>
      <Route path="/guide" element={<SetupGuide />} />
      <Route path="/user/settings" element={<UserSettings />} />
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
