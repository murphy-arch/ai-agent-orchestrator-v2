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

function LegacyRedirect({ to }: { to: string }) {
  const lastStackId = localStorage.getItem("lastStackId");
  if (lastStackId) {
    return <Navigate to={to.replace(":stackId", lastStackId)} replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function App() {
  const { data: user } = trpc.auth.me.useQuery();

  if (!user) {
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
