import { useState, useRef } from "react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackContext";
import {
  BookOpen,
  Upload,
  Trash2,
  Loader2,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import HelpTooltip from "@/components/HelpTooltip";

export default function KnowledgeBase() {
  const { stackId } = useStack();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    content: string;
    similarity: number;
    documentId: number;
    chunkIndex: number;
  }> | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: documents, isLoading } = trpc.document.list.useQuery({ stackId });
  const { data: agents } = trpc.agent.list.useQuery({ stackId });
  const deleteMutation = trpc.document.delete.useMutation({
    onSuccess: () => utils.document.list.invalidate({ stackId }),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const enabledAgent = agents?.find((a) => a.isEnabled);
    if (!enabledAgent) {
      setUploadError("No active agent found. Create and enable an agent first.");
      return;
    }

    setUploading(true);
    setUploadError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("agentId", String(enabledAgent.id));

    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/upload/${stackId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed");
      } else {
        utils.document.list.invalidate({ stackId });
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchResults(null);

    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(
        `/trpc/document.search?input=${encodeURIComponent(JSON.stringify({ json: { stackId, query, topK: 5 } }))}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      const results = data.result?.data?.json ?? [];
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50">
            <BookOpen className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">Knowledge Base <HelpTooltip text="RAG (Retrieval-Augmented Generation): upload documents and the system will automatically search them for relevant information to include in agent prompts." /></h1>
            <p className="text-xs text-gray-500">Upload documents for RAG-powered agents</p>
          </div>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload Document
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {uploadError}
        </div>
      )}

      {/* Search */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Test Retrieval</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question to test document retrieval..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
        {searchResults && searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            {searchResults.map((r, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase text-gray-400">
                    Doc {r.documentId} · Chunk {r.chunkIndex}
                  </span>
                  <span className="text-xs font-medium text-teal-600">
                    {(r.similarity * 100).toFixed(1)}% match
                  </span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-4">{r.content}</p>
              </div>
            ))}
          </div>
        )}
        {searchResults && searchResults.length === 0 && (
          <p className="mt-4 text-sm text-gray-400">No relevant chunks found.</p>
        )}
      </div>

      {/* Documents Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <FileText className="h-4 w-4 text-gray-500" />
            Documents
          </h2>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            </div>
          ) : documents && documents.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Size</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="transition-colors hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      {doc.status === "processed" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : doc.status === "error" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{doc.name}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 uppercase">
                        {doc.fileType}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() =>
                          deleteMutation.mutate({ stackId, documentId: doc.id })
                        }
                        title="Delete"
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
              No documents yet. Upload .txt or .md files to build your knowledge base.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
