import { useState, useEffect } from "react";
import {
  Plus,
  Loader2,
  Bot,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Thermometer,
  Hash,
} from "lucide-react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackLayout";

interface AgentFormData {
  name: string;
  description: string;
  systemPrompt: string;
  hierarchyRole: "orchestrator" | "manager" | "worker";
  modelProvider: "openai" | "anthropic" | "google";
  modelName: string;
  temperature: number;
  maxTokens: number;
  apiKeyId: number | null;
}

const defaultForm: AgentFormData = {
  name: "",
  description: "",
  systemPrompt: "",
  hierarchyRole: "worker",
  modelProvider: "openai",
  modelName: "gpt-4o",
  temperature: 70,
  maxTokens: 2048,
  apiKeyId: null,
};

function hierarchyColor(role: string): string {
  switch (role) {
    case "orchestrator":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "manager":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-gray-50 text-gray-600 border-gray-200";
  }
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "google":
      return "Google";
    default:
      return provider;
  }
}

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent?: {
    id: number;
    name: string;
    description: string | null;
    systemPrompt: string | null;
    hierarchyRole: string | null;
    modelProvider: string | null;
    modelName: string | null;
    temperature: number | null;
    maxTokens: number | null;
  } | null;
  apiKeys: { id: number; provider: string; keyLabel: string }[];
}

function AgentModal({ isOpen, onClose, agent, apiKeys }: AgentModalProps) {
  const { stackId } = useStack();
  const utils = trpc.useUtils();
  const isEditing = !!agent;

  const [form, setForm] = useState<AgentFormData>(defaultForm);
  const [error, setError] = useState("");

  // Fetch agent credential when editing
  const { data: credential } = trpc.agent.getCredential.useQuery(
    { stackId, agentId: agent?.id ?? 0 },
    { enabled: isEditing && !!agent }
  );

  // Populate form when editing
  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name,
        description: agent.description ?? "",
        systemPrompt: agent.systemPrompt ?? "",
        hierarchyRole: (agent.hierarchyRole as AgentFormData["hierarchyRole"]) ?? "worker",
        modelProvider: (agent.modelProvider as AgentFormData["modelProvider"]) ?? "openai",
        modelName: agent.modelName ?? "gpt-4o",
        temperature: agent.temperature ?? 70,
        maxTokens: agent.maxTokens ?? 2048,
        apiKeyId: credential?.apiKeyId ?? null,
      });
    } else {
      setForm(defaultForm);
    }
  }, [agent, credential]);

  const createMutation = trpc.agent.create.useMutation({
    onSuccess: () => {
      utils.agent.list.invalidate({ stackId });
      handleClose();
    },
    onError: (err) => setError(err.message),
  });

  const updateMutation = trpc.agent.update.useMutation({
    onSuccess: () => {
      utils.agent.list.invalidate({ stackId });
      handleClose();
    },
    onError: (err) => setError(err.message),
  });

  if (!isOpen) return null;

  const handleClose = () => {
    setForm(defaultForm);
    setError("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Agent name is required");
      return;
    }

    const payload = {
      stackId,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      systemPrompt: form.systemPrompt.trim() || undefined,
      hierarchyRole: form.hierarchyRole,
      modelProvider: form.modelProvider,
      modelName: form.modelName.trim() || undefined,
      temperature: form.temperature,
      maxTokens: form.maxTokens,
      apiKeyId: form.apiKeyId ?? undefined,
    };

    if (isEditing && agent) {
      updateMutation.mutate({ ...payload, agentId: agent.id });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Edit Agent" : "Create Agent"}
          </h2>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Support Orchestrator"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What does this agent do?"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700">System Prompt</label>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
              placeholder="Instructions for how this agent should behave..."
              rows={3}
              className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Hierarchy Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Hierarchy Role</label>
            <select
              value={form.hierarchyRole}
              onChange={(e) =>
                setForm((f) => ({ ...f, hierarchyRole: e.target.value as AgentFormData["hierarchyRole"] }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="orchestrator">Orchestrator</option>
              <option value="manager">Manager</option>
              <option value="worker">Worker</option>
            </select>
          </div>

          {/* Model Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Model Provider</label>
            <select
              value={form.modelProvider}
              onChange={(e) =>
                setForm((f) => ({ ...f, modelProvider: e.target.value as AgentFormData["modelProvider"] }))
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
            </select>
          </div>

          {/* Model Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Model Name</label>
            <input
              type="text"
              value={form.modelName}
              onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
              placeholder="e.g., gpt-4o, claude-3-5-sonnet"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Linked API Key</label>
            <div className="relative mt-1">
              <select
                value={form.apiKeyId ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    apiKeyId: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">None (select a key)</option>
                {apiKeys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.keyLabel} ({key.provider})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Temperature */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Thermometer className="h-4 w-4" />
              Temperature: {(form.temperature / 100).toFixed(2)}
            </label>
            <input
              type="range"
              min={0}
              max={200}
              value={form.temperature}
              onChange={(e) => setForm((f) => ({ ...f, temperature: Number(e.target.value) }))}
              className="mt-2 w-full accent-blue-600"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>Precise (0.0)</span>
              <span>Creative (2.0)</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Hash className="h-4 w-4" />
              Max Tokens
            </label>
            <input
              type="number"
              min={256}
              max={16384}
              value={form.maxTokens}
              onChange={(e) => setForm((f) => ({ ...f, maxTokens: Number(e.target.value) }))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !form.name.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Agent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  agentName,
  onConfirm,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  onConfirm: () => void;
  isPending: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <Trash2 className="h-6 w-6 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Delete Agent</h2>
        <p className="mt-1 text-sm text-gray-500">
          Are you sure you want to delete <strong>{agentName}</strong>? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Agents() {
  const { stackId } = useStack();
  const utils = trpc.useUtils();

  const { data: agents, isLoading } = trpc.agent.list.useQuery({ stackId });
  const { data: settings } = trpc.settings.getStackSettings.useQuery({ stackId });
  const apiKeys = settings?.apiKeys ?? [];

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentModalProps["agent"]>(null);
  const [deletingAgent, setDeletingAgent] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const deleteMutation = trpc.agent.delete.useMutation({
    onSuccess: () => {
      utils.agent.list.invalidate({ stackId });
      setDeletingAgent(null);
    },
  });

  const handleDelete = () => {
    if (deletingAgent) {
      deleteMutation.mutate({ stackId, agentId: deletingAgent.id });
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
            <Bot className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Agents</h1>
            <p className="text-xs text-gray-500">Manage AI agents in this stack</p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingAgent(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Agent
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : !agents || agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
            <Bot className="h-7 w-7 text-blue-400" />
          </div>
          <h2 className="mt-3 text-base font-semibold text-gray-900">No agents yet</h2>
          <p className="mt-1 max-w-sm text-center text-sm text-gray-500">
            Create your first AI agent to start building your workflow.
          </p>
          <button
            onClick={() => {
              setEditingAgent(null);
              setShowCreateModal(true);
            }}
            className="mt-5 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Your First Agent
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
                    <Bot className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{agent.name}</h3>
                    <span
                      className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${hierarchyColor(
                        agent.hierarchyRole ?? "worker"
                      )}`}
                    >
                      {agent.hierarchyRole ?? "worker"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {agent.isEnabled ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>

              {agent.description && (
                <p className="mb-3 text-sm text-gray-500 line-clamp-2">{agent.description}</p>
              )}

              <div className="mb-4 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Cpu className="h-3.5 w-3.5 text-gray-400" />
                  <span>
                    {providerLabel(agent.modelProvider ?? "openai")} · {agent.modelName ?? "gpt-4o"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Thermometer className="h-3.5 w-3.5 text-gray-400" />
                  <span>Temp: {((agent.temperature ?? 70) / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Hash className="h-3.5 w-3.5 text-gray-400" />
                  <span>Max Tokens: {agent.maxTokens ?? 2048}</span>
                </div>
              </div>

              <div className="mt-auto flex gap-2 border-t border-gray-100 pt-3">
                <button
                  onClick={() => {
                    setEditingAgent(agent);
                    setShowCreateModal(true);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={() =>
                    setDeletingAgent({ id: agent.id, name: agent.name })
                  }
                  className="flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <AgentModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingAgent(null);
        }}
        agent={editingAgent}
        apiKeys={apiKeys}
      />

      <DeleteConfirmModal
        isOpen={deletingAgent !== null}
        onClose={() => setDeletingAgent(null)}
        agentName={deletingAgent?.name ?? ""}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
