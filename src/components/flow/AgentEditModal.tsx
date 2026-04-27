import { useState, useEffect } from "react";
import { X, Bot, Loader2 } from "lucide-react";
import { trpc } from "@/trpc";

interface AgentEditModalProps {
  stackId: number;
  agentId: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function AgentEditModal({ stackId, agentId, onClose, onSaved }: AgentEditModalProps) {
  const { data: agent, isLoading } = trpc.agent.getById.useQuery({ stackId, agentId });
  const [form, setForm] = useState({
    name: "",
    description: "",
    systemPrompt: "",
    temperature: 70,
    maxTokens: 2048,
  });

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name,
        description: agent.description ?? "",
        systemPrompt: agent.systemPrompt ?? "",
        temperature: agent.temperature ?? 70,
        maxTokens: agent.maxTokens ?? 2048,
      });
    }
  }, [agent]);

  const updateMutation = trpc.agent.update.useMutation({
    onSuccess: () => onSaved(),
  });

  const handleSave = () => {
    updateMutation.mutate({
      stackId,
      agentId,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      systemPrompt: form.systemPrompt.trim() || undefined,
      temperature: form.temperature,
      maxTokens: form.maxTokens,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg rounded-2xl border overflow-hidden bg-white border-gray-200 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-blue-600" />
            <span className="text-sm font-semibold text-gray-900">Edit Agent</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : agent ? (
            <>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">System Prompt</label>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                  rows={4}
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50 border-gray-200 text-gray-900 resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Temperature: {(form.temperature / 100).toFixed(2)}
                </label>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={form.temperature}
                  onChange={(e) => setForm((f) => ({ ...f, temperature: Number(e.target.value) }))}
                  className="w-full mt-2 accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Precise (0.0)</span>
                  <span>Creative (2.0)</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Max Tokens</label>
                <input
                  type="number"
                  min={256}
                  max={16384}
                  value={form.maxTokens}
                  onChange={(e) => setForm((f) => ({ ...f, maxTokens: Number(e.target.value) }))}
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50 border-gray-200 text-gray-900"
                />
              </div>

              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                <div className="font-medium text-gray-700 mb-1">Model</div>
                <div>{agent.modelProvider} · {agent.modelName}</div>
                <div className="mt-1 font-medium text-gray-700">Hierarchy</div>
                <div className="capitalize">{agent.hierarchyRole ?? "worker"}</div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">Agent not found</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending || !form.name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
