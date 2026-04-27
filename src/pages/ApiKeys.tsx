import { useState } from "react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackContext";
import {
  Key,
  Plus,
  Trash2,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Activity,
  Eye,
  EyeOff,
} from "lucide-react";

const DEFAULT_PERMISSIONS = ["run", "agents", "chat", "executions"];

export default function ApiKeys() {
  const { stackId } = useStack();
  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [rateLimit, setRateLimit] = useState(60);
  const [permissions, setPermissions] = useState<string[]>(DEFAULT_PERMISSIONS);
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const { data: keyList, isLoading } = trpc.publicApiKey.list.useQuery({ stackId });
  const createMutation = trpc.publicApiKey.create.useMutation({
    onSuccess: (data) => {
      utils.publicApiKey.list.invalidate({ stackId });
      setPlainKey(data.plainKey);
      setName("");
      setRateLimit(60);
      setPermissions(DEFAULT_PERMISSIONS);
      setShowAdd(false);
    },
  });
  const deleteMutation = trpc.publicApiKey.delete.useMutation({
    onSuccess: () => utils.publicApiKey.list.invalidate({ stackId }),
  });

  function togglePermission(perm: string) {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  function handleCreate() {
    if (!name.trim()) return;
    createMutation.mutate({ stackId, name, permissions, rateLimit });
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const permButtonClass = (active: boolean) =>
    active
      ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
      : "bg-gray-100 text-gray-500";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
            <Key className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">API Keys</h1>
            <p className="text-xs text-gray-500">Manage public API access for external integrations</p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowAdd(!showAdd);
            setPlainKey(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
        >
          <Plus className="h-4 w-4" />
          {showAdd ? "Cancel" : "New Key"}
        </button>
      </div>

      {showAdd && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-900">Create API Key</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production Integration"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Rate Limit (req/min)</label>
              <input
                type="number"
                min={1}
                max={10000}
                value={rateLimit}
                onChange={(e) => setRateLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-xs font-medium text-gray-700">Permissions</label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_PERMISSIONS.map((perm) => (
                  <button
                    key={perm}
                    onClick={() => togglePermission(perm)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${permButtonClass(
                      permissions.includes(perm)
                    )}`}
                  >
                    {perm}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Key
            </button>
          </div>
        </div>
      )}

      {plainKey && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900">Copy your API key now</h4>
              <p className="mb-3 text-xs text-amber-700">
                This key will only be shown once. Store it securely.
              </p>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={revealed ? "text" : "password"}
                    value={plainKey}
                    readOnly
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 pr-20 text-sm font-mono text-gray-800"
                  />
                  <button
                    onClick={() => setRevealed(!revealed)}
                    className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => handleCopy(plainKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-600"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Public API Endpoints</h3>
        <div className="space-y-2 text-xs">
          <div className="rounded-lg bg-gray-50 p-3 font-mono text-gray-700">
            <span className="font-semibold text-amber-700">POST</span> /api/v1/STACK_ID/run
            <p className="mt-1 text-gray-500">Trigger a workflow run. Body: {"{ message, variables? }"}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 font-mono text-gray-700">
            <span className="font-semibold text-blue-700">GET</span> /api/v1/STACK_ID/agents
            <p className="mt-1 text-gray-500">List all agents in the stack.</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 font-mono text-gray-700">
            <span className="font-semibold text-amber-700">POST</span> /api/v1/STACK_ID/agents/AGENT_ID/chat
            <p className="mt-1 text-gray-500">Chat with a specific agent. Body: {"{ message }"}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 font-mono text-gray-700">
            <span className="font-semibold text-blue-700">GET</span> /api/v1/STACK_ID/executions/RUN_ID
            <p className="mt-1 text-gray-500">Get execution run status and trace.</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Include your key in the <code className="rounded bg-gray-100 px-1 py-0.5">x-api-key</code> header.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Key className="h-4 w-4 text-gray-500" />
            Active Keys
          </h2>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : keyList && keyList.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Prefix</th>
                  <th className="px-5 py-3">Permissions</th>
                  <th className="px-5 py-3">Rate Limit</th>
                  <th className="px-5 py-3">Usage</th>
                  <th className="px-5 py-3">Last Used</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {keyList.map((k: NonNullable<typeof keyList>[number]) => (
                  <tr key={k.id} className="transition-colors hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-900">{k.name}</td>
                    <td className="px-5 py-3">
                      <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                        {k.keyPrefix}...
                      </code>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {((k.permissions as string[]) || []).map((p) => (
                          <span
                            key={p}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{k.rateLimit}/min</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Activity className="h-3 w-3" />
                        {k.requestCount ?? 0}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {k.lastUsedAt ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(k.lastUsedAt).toLocaleString()}
                        </div>
                      ) : (
                        "Never"
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm("Deactivate this API key? External services using it will lose access.")) {
                            deleteMutation.mutate({ id: k.id });
                          }
                        }}
                        title="Deactivate"
                        className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">
              No API keys yet. Create one to enable public access.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
