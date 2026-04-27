import { useState } from "react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackContext";
import {
  Database as DatabaseIcon,
  Search,
  FileText,
  Trash2,
  Download,
  Clock,
  Bot,
  Tag,
  X,
  Loader2,
  Filter,
  Archive,
  Eye,
} from "lucide-react";
import HelpTooltip from "@/components/HelpTooltip";

const CONTENT_TYPE_COLORS: Record<string, string> = {
  text: "bg-gray-100 text-gray-700",
  markdown: "bg-blue-100 text-blue-700",
  json: "bg-amber-100 text-amber-700",
  code: "bg-purple-100 text-purple-700",
  image: "bg-pink-100 text-pink-700",
};

const SOURCE_LABELS: Record<string, string> = {
  workflow: "Workflow",
  console: "Console",
  team: "Team",
  manual: "Manual",
};

export default function DatabasePage() {
  const { stackId } = useStack();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: outputs, isLoading } = trpc.output.list.useQuery({
    stackId,
    search: search || undefined,
    contentType: filterType || undefined,
    source: filterSource || undefined,
  });

  const { data: stats } = trpc.output.stats.useQuery({ stackId });

  const { data: selectedOutput } = trpc.output.getById.useQuery(
    { stackId, id: selectedId! },
    { enabled: !!selectedId }
  );

  const utils = trpc.useUtils();

  const deleteMutation = trpc.output.delete.useMutation({
    onSuccess: () => {
      utils.output.list.invalidate({ stackId });
      utils.output.stats.invalidate({ stackId });
      setDeleteId(null);
      if (selectedId === deleteId) setSelectedId(null);
    },
  });

  const handleDownload = (output: NonNullable<typeof outputs>[number]) => {
    const blob = new Blob([output.content], { type: output.mimeType ?? "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = output.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase() + ".txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes?: number | null) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
            <DatabaseIcon className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">Database <HelpTooltip text="A file storage system that automatically collects all work completed by agents — from console chats, team collaborations, and workflow executions. Browse, search, preview, and download." /></h1>
            <p className="text-xs text-gray-500">Agent outputs and completed work</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {stats && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="px-2 py-1 rounded-md bg-gray-50 border">
                {stats.totalCount} files
              </span>
              <span className="px-2 py-1 rounded-md bg-gray-50 border">
                {formatSize(stats.totalSizeBytes)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {stats && stats.byType.length > 0 && (
        <div className="flex gap-2 mb-4 shrink-0 flex-wrap">
          {stats.byType.map((t) => (
            <button
              key={t.contentType ?? "unknown"}
              onClick={() => setFilterType(filterType === (t.contentType ?? "") ? "" : (t.contentType ?? ""))}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                filterType === (t.contentType ?? "")
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {t.contentType ?? "unknown"} ({t.count})
            </button>
          ))}
        </div>
      )}

      {/* Search + filters */}
      <div className="flex gap-3 mb-4 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search outputs by name or content..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All sources</option>
          <option value="workflow">Workflow</option>
          <option value="console">Console</option>
          <option value="team">Team</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {/* Content area */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* File list */}
        <div className={`flex flex-col border rounded-xl bg-white overflow-hidden ${selectedId ? "w-1/3" : "w-full"}`}>
          <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Files</span>
            {(filterType || filterSource || search) && (
              <button
                onClick={() => { setFilterType(""); setFilterSource(""); setSearch(""); }}
                className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : !outputs || outputs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-400">No outputs yet</p>
                <p className="text-[11px] text-gray-300 mt-1">
                  Agent work will appear here automatically
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {outputs.map((output) => (
                  <div
                    key={output.id}
                    onClick={() => setSelectedId(output.id)}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      selectedId === output.id
                        ? "bg-emerald-50 border-l-2 border-l-emerald-500"
                        : "hover:bg-gray-50 border-l-2 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {output.name}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          CONTENT_TYPE_COLORS[output.contentType ?? "text"] ?? CONTENT_TYPE_COLORS.text
                        }`}
                      >
                        {output.contentType ?? "text"}
                      </span>
                    </div>
                    {output.description && (
                      <p className="mt-1 text-[11px] text-gray-500 truncate">{output.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(output.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatSize(output.sizeBytes)}
                      </span>
                      {output.source && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {SOURCE_LABELS[output.source] ?? output.source}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview pane */}
        {selectedId && (
          <div className="w-2/3 border rounded-xl bg-white flex flex-col overflow-hidden">
            {selectedOutput ? (
              <>
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{selectedOutput.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500">
                        {new Date(selectedOutput.createdAt).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-gray-400">·</span>
                      <span className="text-[10px] text-gray-500">{formatSize(selectedOutput.sizeBytes)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDownload(selectedOutput)}
                      className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(selectedOutput.id)}
                      className="p-1.5 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {(selectedOutput.tags as string[] | null)?.length ? (
                  <div className="px-4 py-2 border-b flex items-center gap-1.5 flex-wrap">
                    <Tag className="h-3 w-3 text-gray-400" />
                    {(selectedOutput.tags as string[]).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="flex-1 overflow-y-auto p-4">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 rounded-lg p-4 border">
                    {selectedOutput.content}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900">Delete output?</h3>
            <p className="mt-1 text-xs text-gray-500">This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({ stackId, id: deleteId })}
                disabled={deleteMutation.isPending}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
