import { useState } from "react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackContext";
import { Brain, Plus, Trash2, Search, Tag, Star } from "lucide-react";
import HelpTooltip from "@/components/HelpTooltip";

export default function Memory() {
  const { stackId } = useStack();
  const utils = trpc.useUtils();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newConfidence, setNewConfidence] = useState(100);

  const { data: memories, isLoading } = trpc.memory.list.useQuery({ stackId });
  const upsertMutation = trpc.memory.upsert.useMutation({
    onSuccess: () => {
      utils.memory.list.invalidate({ stackId });
      setShowAdd(false);
      setNewKey("");
      setNewValue("");
    },
  });
  const deleteMutation = trpc.memory.delete.useMutation({
    onSuccess: () => utils.memory.list.invalidate({ stackId }),
  });

  const filtered = searchQuery
    ? memories?.filter(
        (m) =>
          m.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.value.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : memories;

  const categories = Array.from(new Set(memories?.map((m) => m.category).filter(Boolean) ?? [])) as string[];
  const [activeCategory, setActiveCategory] = useState<string>("");

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            Memory
            <HelpTooltip text="A key-value store that agents can access during execution. Use it for user preferences, account details, or any facts the agent should remember across conversations." />
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Facts and context that agents recall during workflow execution.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          Add Memory
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search memories..."
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 focus:border-purple-500 focus:outline-none"
        />
      </div>

      {/* Category filters */}
      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory("")}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === "" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? "" : cat)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-purple-600 text-white"
                  : "bg-purple-50 text-purple-700 hover:bg-purple-100"
              }`}
            >
              <Tag className="h-3 w-3" />
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Add memory form */}
      {showAdd && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">New Memory</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500">Key</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="user_preference"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Category</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="general"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Value</label>
              <textarea
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="The user prefers formal tone in emails."
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500">Confidence: {newConfidence}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={newConfidence}
                  onChange={(e) => setNewConfidence(Number(e.target.value))}
                  className="mt-1 w-32"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  upsertMutation.mutate({
                    stackId,
                    key: newKey,
                    value: newValue,
                    category: newCategory,
                    confidence: newConfidence,
                  })
                }
                disabled={!newKey.trim() || !newValue.trim() || upsertMutation.isPending}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {upsertMutation.isPending ? "Saving..." : "Save Memory"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memory list */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Loading memories...</div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered
            .filter((m) => !activeCategory || m.category === activeCategory)
            .map((memory) => (
            <div
              key={memory.id}
              className="group flex items-start justify-between rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900">{memory.key}</span>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                    {memory.category}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {memory.confidence}
                  </span>
                </div>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{memory.value}</p>
                <p className="mt-1 text-xs text-gray-400">
                  Updated {new Date(memory.updatedAt ?? memory.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => deleteMutation.mutate({ stackId, memoryId: memory.id })}
                className="ml-4 rounded-md p-2 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-opacity"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <Brain className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No memories yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Add memories manually here, or use Memory nodes in your workflow to store them automatically.
          </p>
        </div>
      )}
    </div>
  );
}
