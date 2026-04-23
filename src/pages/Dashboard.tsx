import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Loader2,
  MessageSquare,
  ArrowRight,
  Boxes,
  Users,
  Crown,
  Shield,
  UserCircle,
  X,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/trpc";
import { GlobalChatWidget } from "@/components/GlobalChatWidget";

interface CreateStackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function CreateStackModal({ isOpen, onClose }: CreateStackModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const utils = trpc.useUtils();

  const createMutation = trpc.stack.create.useMutation({
    onSuccess: () => {
      utils.stack.list.invalidate();
      setName("");
      setDescription("");
      setError("");
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Stack name is required");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Create New Stack</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="stack-name" className="block text-sm font-medium text-gray-700">
              Stack Name <span className="text-red-500">*</span>
            </label>
            <input
              id="stack-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Customer Support AI"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="stack-desc" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="stack-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this stack for?"
              rows={3}
              className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Stack
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-green-50", text: "text-green-700", label: "Active" },
    archived: { bg: "bg-gray-100", text: "text-gray-600", label: "Archived" },
    suspended: { bg: "bg-red-50", text: "text-red-700", label: "Suspended" },
  };
  const c = config[status] ?? config.active;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    owner: { icon: <Crown className="h-3 w-3" />, label: "Owner", color: "text-amber-700 bg-amber-50" },
    admin: { icon: <Shield className="h-3 w-3" />, label: "Admin", color: "text-blue-700 bg-blue-50" },
    member: { icon: <UserCircle className="h-3 w-3" />, label: "Member", color: "text-gray-600 bg-gray-100" },
  };
  const c = config[role] ?? config.member;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.color}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function StackCard({
  stack,
  userRole,
}: {
  stack: { id: number; name: string; description: string | null; status: string | null; slug: string };
  userRole: string;
}) {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = trpc.stack.getStats.useQuery({ stackId: stack.id });

  const handleOpenStack = () => {
    navigate(`/stacks/${stack.id}/architecture`);
  };

  return (
    <div className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-300">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Boxes className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">{stack.name}</h3>
            <p className="text-xs text-gray-400">{stack.slug}</p>
          </div>
        </div>
        <StatusBadge status={stack.status ?? "active"} />
      </div>

      {stack.description && (
        <p className="mb-4 text-sm text-gray-500 line-clamp-2">{stack.description}</p>
      )}

      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <Users className="h-4 w-4 text-gray-400" />
          <span>{statsLoading ? "—" : `${stats?.agentCount ?? 0} agents`}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <MessageSquare className="h-4 w-4 text-gray-400" />
          <span>{statsLoading ? "—" : `${stats?.messageCount ?? 0} messages`}</span>
        </div>
        <div className="ml-auto">
          <RoleBadge role={userRole} />
        </div>
      </div>

      <div className="mt-auto flex gap-2">
        <button
          onClick={handleOpenStack}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Open Stack
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: stacks, isLoading } = trpc.stack.list.useQuery();
  const { data: user } = trpc.auth.me.useQuery();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your AI Agent Stacks</h1>
            <p className="mt-1 text-sm text-gray-500">
              {user?.name ? `Welcome back, ${user.name}` : "Manage your AI agent orchestrators"}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Stack
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : !stacks || stacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
              <Boxes className="h-8 w-8 text-blue-400" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">No stacks yet</h2>
            <p className="mt-1 max-w-sm text-center text-sm text-gray-500">
              Create your first AI agent stack to start orchestrating intelligent workflows.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create Your First Stack
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stacks.map((stack) => (
              <StackCard key={stack.id} stack={stack} userRole={(stack as Record<string, unknown>).role as string ?? "member"} />
            ))}
          </div>
        )}
      </main>

      {/* Create Stack Modal */}
      <CreateStackModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />

      {/* Global Chat Widget */}
      <GlobalChatWidget />
    </div>
  );
}
