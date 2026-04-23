import { Link, useLocation } from "react-router-dom";
import { useStack } from "./StackLayout";
import {
  Bot,
  Workflow,
  BarChart3,
  Settings,
  BookOpen,
  UserCircle,
  ChevronLeft,
  Terminal,
} from "lucide-react";
import type { ReactNode } from "react";

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

  const navItems = [
    { to: `/stacks/${stackId}/architecture`, icon: Workflow, label: "Architecture" },
    { to: `/stacks/${stackId}/agents`, icon: Bot, label: "Agents" },
    { to: `/stacks/${stackId}/console`, icon: Terminal, label: "Console" },
    { to: `/stacks/${stackId}/analytics`, icon: BarChart3, label: "Analytics" },
    { to: `/stacks/${stackId}/settings`, icon: Settings, label: "Settings" },
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
              {item.label}
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
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
