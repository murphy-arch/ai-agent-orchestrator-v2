import { Link, useLocation } from "react-router-dom";
import { useStack } from "./StackContext";
import {
  Bot,
  Workflow,
  BarChart3,
  Settings,
  BookOpen,
  UserCircle,
  ChevronLeft,
  Terminal,
  Brain,
  CalendarClock,
  LayoutTemplate,
  KeyRound,
  Users,
  Database,
  Home,
  Keyboard,
} from "lucide-react";
import type { ReactNode } from "react";
import HelpTooltip from "@/components/HelpTooltip";
import KeyboardShortcutsModal, { useKeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";

interface Stack {
  id: number;
  name: string;
  slug: string;
  status: string;
}

export default function AppLayout({
  stack,
  children,
}: {
  stack: Stack;
  children: ReactNode;
}) {
  const { stackId } = useStack();
  const location = useLocation();
  const { isOpen: shortcutsOpen, setIsOpen: setShortcutsOpen } = useKeyboardShortcutsModal();

  const navItems = [
    { to: `/stacks/${stackId}/architecture`, icon: Workflow, label: "Architecture", help: "Design visual workflows by connecting nodes. Agents, decisions, delays, loops, and parallel branches." },
    { to: `/stacks/${stackId}/agents`, icon: Bot, label: "Agents", help: "Create and configure AI agents. Set their role, personality, model, and API keys." },
    { to: `/stacks/${stackId}/memory`, icon: Brain, label: "Memory", help: "Store and retrieve context that agents can access during conversations. Like a long-term memory bank." },
    { to: `/stacks/${stackId}/knowledge`, icon: BookOpen, label: "Knowledge", help: "Upload documents for RAG (Retrieval-Augmented Generation). Agents can search and cite your documents." },
    { to: `/stacks/${stackId}/schedules`, icon: CalendarClock, label: "Schedules", help: "Set up cron schedules to automatically trigger workflows at specific times or intervals." },
    { to: `/stacks/${stackId}/templates`, icon: LayoutTemplate, label: "Templates", help: "Reusable workflow templates. Save a workflow design and instantiate it across different stacks." },
    { to: `/stacks/${stackId}/blueprints`, icon: LayoutTemplate, label: "Blueprints", help: "Pre-built agent team configurations with workflows. Instantly deploy complete stacks for common use cases." },
    { to: `/stacks/${stackId}/teams`, icon: Users, label: "Teams", help: "Group agents into multi-agent teams. An Orchestrator plans tasks and delegates to Worker agents." },
    { to: `/stacks/${stackId}/database`, icon: Database, label: "Database", help: "A file storage system for all work completed by agents. Browse, search, preview, and download outputs." },
    { to: `/stacks/${stackId}/api-keys`, icon: KeyRound, label: "API Keys", help: "Manage API keys for OpenAI, Anthropic, and Google. Each agent links to a key for billing separation." },
    { to: `/stacks/${stackId}/console`, icon: Terminal, label: "Console", help: "A live chat interface to test agents and teams one-on-one before deploying them to workflows." },
    { to: `/stacks/${stackId}/analytics`, icon: BarChart3, label: "Analytics", help: "View execution history, token usage, latency, and cost analytics for all agent runs." },
    { to: `/stacks/${stackId}/settings`, icon: Settings, label: "Settings", help: "Stack-level configuration including public API keys and webhook endpoints." },
  ];

  const globalItems = [
    { to: "/guide", icon: BookOpen, label: "Guide" },
    { to: "/user/settings", icon: UserCircle, label: "User Settings" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        {/* Stack header */}
        <div className="p-4 border-b">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="font-semibold text-lg truncate">{stack.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                stack.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {stack.status}
            </span>
          </div>
        </div>

        {/* Stack-scoped nav */}
        <nav className="flex-1 p-3 space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
            Stack
          </div>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive(item.to)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1">{item.label}</span>
              <HelpTooltip text={item.help} width="w-56" />
            </Link>
          ))}

          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2 mt-4">
            Global
          </div>
          {globalItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive(item.to)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Breadcrumb */}
        <div className="px-6 pt-4 pb-0 flex items-center justify-between">
          <nav className="flex items-center gap-1.5 text-xs text-gray-500">
            <Link to="/dashboard" className="flex items-center gap-1 hover:text-gray-800 transition-colors">
              <Home className="h-3 w-3" /> Dashboard
            </Link>
            <span className="text-gray-300">/</span>
            <Link to={`/stacks/${stackId}/architecture`} className="hover:text-gray-800 transition-colors truncate max-w-[120px]">
              {stack.name}
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-800 font-medium capitalize">
              {location.pathname.split("/").pop()?.replace(/-/g, " ") ?? ""}
            </span>
          </nav>
          <button
            onClick={() => setShortcutsOpen(true)}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
            title="Keyboard shortcuts"
          >
            <Keyboard className="h-3 w-3" />
            Press ? for shortcuts
          </button>
        </div>
        <div className="p-6">{children}</div>
      </main>
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
