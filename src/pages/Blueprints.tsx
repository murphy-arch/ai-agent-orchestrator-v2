import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackContext";
import { useToast } from "@/components/ToastProvider";
import {
  Loader2,
  CheckCircle2,
  ArrowRight,
  LayoutTemplate,
  Search,
  Bot,
  Zap,
  Star,
  Cpu,
  Building2,
  Tag,
  X,
  Network,
  ExternalLink,
} from "lucide-react";

const categoryIcons: Record<string, React.ReactNode> = {
  support: <Zap className="h-4 w-4 text-blue-500" />,
  operational: <Cpu className="h-4 w-4 text-orange-500" />,
  sales: <Star className="h-4 w-4 text-green-500" />,
  creative: <LayoutTemplate className="h-4 w-4 text-purple-500" />,
  analytical: <Network className="h-4 w-4 text-cyan-500" />,
  strategic: <Star className="h-4 w-4 text-amber-500" />,
  technical: <Cpu className="h-4 w-4 text-emerald-500" />,
};

const categoryLabels: Record<string, string> = {
  support: "Support",
  operational: "Operations",
  sales: "Sales",
  creative: "Creative",
  analytical: "Analytics",
  strategic: "Strategy",
  technical: "Technical",
};

const complexityColors: Record<number, string> = {
  1: "bg-gray-100 text-gray-600",
  2: "bg-green-100 text-green-700",
  3: "bg-blue-100 text-blue-700",
  4: "bg-purple-100 text-purple-700",
  5: "bg-red-100 text-red-700",
};

const roleBadgeColors: Record<string, string> = {
  orchestrator: "bg-purple-100 text-purple-700 border-purple-200",
  manager: "bg-blue-100 text-blue-700 border-blue-200",
  worker: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

interface Blueprint {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  industry: string | null;
  category: string | null;
  complexityLevel: number | null;
  agentConfigs: Array<{
    agentFunctionSlug: string;
    name?: string;
    hierarchyRole?: string;
    modelProvider?: string;
    modelName?: string;
  }>;
  requiredIntegrations: string[];
  isPremium: boolean | null;
  usageCount: number | null;
}

export default function Blueprints() {
  const { stackId } = useStack();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { error: showError, success: showSuccess } = useToast();

  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [complexityFilter, setComplexityFilter] = useState<number | "">("");
  const [appliedBlueprint, setAppliedBlueprint] = useState<Blueprint | null>(null);
  const [applyResult, setApplyResult] = useState<{
    agentsCreated: Array<{ id: number; name: string; role: string; reused?: boolean }>;
    workflow: { nodesInserted: number; edgesInserted: number } | null;
  } | null>(null);

  const { data: blueprints, isLoading } = trpc.stackBlueprint.list.useQuery({
    search: search || undefined,
    industry: industryFilter || undefined,
    category: categoryFilter || undefined,
    complexityLevel: complexityFilter !== "" ? Number(complexityFilter) : undefined,
    limit: 200,
  });

  const applyMutation = trpc.stackBlueprint.use.useMutation({
    onSuccess: (data, vars) => {
      const bp = blueprints?.find((b: Blueprint) => b.id === vars.blueprintId);
      if (bp) setAppliedBlueprint(bp);
      setApplyResult({
        agentsCreated: data.agentsCreated,
        workflow: data.workflow,
      });
      utils.agent.list.invalidate({ stackId });
      utils.workflow.load.invalidate({ stackId });
      void utils.workflow.load.refetch({ stackId });
      showSuccess(`Applied "${data.blueprintName}" — ${data.agentsCreated.length} agent(s) created`);
    },
    onError: (err) => {
      console.error("[Blueprints] apply failed:", err);
      showError(err.message || "Failed to apply blueprint. Check console for details.");
    },
  });

  // Derive filter options from data
  const industries = Array.from(
    new Set(blueprints?.map((b: Blueprint) => b.industry).filter(Boolean) ?? [])
  ) as string[];
  const categories = Array.from(
    new Set(blueprints?.map((b: Blueprint) => b.category).filter(Boolean) ?? [])
  ) as string[];

  const filteredBlueprints = blueprints ?? [];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
            <LayoutTemplate className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Stack Blueprints</h1>
            <p className="text-xs text-gray-500">
              Pre-built agent teams and workflows for common use cases
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search blueprints..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabels[cat] ?? cat}
            </option>
          ))}
        </select>
        <select
          value={complexityFilter}
          onChange={(e) => setComplexityFilter(e.target.value === "" ? "" : Number(e.target.value))}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Complexity</option>
          {[1, 2, 3, 4, 5].map((c) => (
            <option key={c} value={c}>
              Level {c}
            </option>
          ))}
        </select>
        {(search || industryFilter || categoryFilter || complexityFilter !== "") && (
          <button
            onClick={() => {
              setSearch("");
              setIndustryFilter("");
              setCategoryFilter("");
              setComplexityFilter("");
            }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredBlueprints.map((bp: Blueprint) => {
            const agentCount = bp.agentConfigs?.length ?? 0;
            const integrations = bp.requiredIntegrations ?? [];

            return (
              <div
                key={bp.id}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-300"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {categoryIcons[bp.category ?? ""] ?? (
                      <LayoutTemplate className="h-4 w-4 text-gray-400" />
                    )}
                    <h3 className="text-sm font-semibold text-gray-900">{bp.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {bp.isPremium && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        <Star className="h-3 w-3" />
                        PREMIUM
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        complexityColors[bp.complexityLevel ?? 1]
                      }`}
                    >
                      L{bp.complexityLevel}
                    </span>
                  </div>
                </div>

                <p className="mb-3 flex-1 text-xs text-gray-500 line-clamp-3">
                  {bp.description}
                </p>

                {/* Meta badges */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {bp.industry && (
                    <span className="inline-flex items-center gap-1 rounded bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                      <Building2 className="h-3 w-3" />
                      {bp.industry}
                    </span>
                  )}
                  {bp.category && (
                    <span className="inline-flex items-center gap-1 rounded bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                      <Tag className="h-3 w-3" />
                      {categoryLabels[bp.category] ?? bp.category}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                    <Bot className="h-3 w-3" />
                    {agentCount} agent{agentCount !== 1 ? "s" : ""}
                  </span>
                  {bp.usageCount ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                      <Zap className="h-3 w-3" />
                      {bp.usageCount} uses
                    </span>
                  ) : null}
                </div>

                {/* Agent roles */}
                {bp.agentConfigs && bp.agentConfigs.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {bp.agentConfigs.map((cfg, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          roleBadgeColors[cfg.hierarchyRole ?? "worker"]
                        }`}
                      >
                        {cfg.hierarchyRole === "orchestrator"
                          ? "👑"
                          : cfg.hierarchyRole === "manager"
                          ? "📋"
                          : "🔧"}
                        {cfg.name ?? cfg.agentFunctionSlug}
                      </span>
                    ))}
                  </div>
                )}

                {/* Integrations */}
                {integrations.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {integrations.map((int: string) => (
                      <span
                        key={int}
                        className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600"
                      >
                        {int}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => {
                    console.log("[Blueprints] Applying blueprint", bp.id, "to stack", stackId);
                    applyMutation.mutate({
                      stackId,
                      blueprintId: bp.id,
                    });
                  }}
                  disabled={applyMutation.isPending}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {applyMutation.isPending && applyMutation.variables?.blueprintId === bp.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4" />
                      Use Blueprint
                    </>
                  )}
                </button>

                {/* Inline error for this blueprint */}
                {applyMutation.isError && applyMutation.variables?.blueprintId === bp.id && (
                  <p className="mt-2 text-xs text-red-600">
                    {applyMutation.error?.message || "Failed to apply"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filteredBlueprints.length === 0 && !isLoading && (
        <p className="py-8 text-center text-sm text-gray-400">
          No blueprints match your filters.
        </p>
      )}

      {/* Success Modal */}
      {appliedBlueprint && applyResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Blueprint Applied</h3>
              </div>
              <button
                onClick={() => {
                  setAppliedBlueprint(null);
                  setApplyResult(null);
                }}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{appliedBlueprint.name}</span> has
                been applied to your stack.
              </p>

              {/* Agents created */}
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  Agents Created ({applyResult.agentsCreated.length})
                </h4>
                <div className="space-y-1.5">
                  {applyResult.agentsCreated.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <Bot className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{agent.name}</span>
                      {agent.reused && (
                        <span className="text-[10px] text-amber-600 font-medium">(reused)</span>
                      )}
                      <span
                        className={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          roleBadgeColors[agent.role] ?? roleBadgeColors.worker
                        }`}
                      >
                        {agent.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workflow summary */}
              {applyResult.workflow && (
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Workflow
                  </h4>
                  <div className="flex gap-3 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Network className="h-4 w-4 text-gray-400" />
                      {applyResult.workflow.nodesInserted} nodes
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                      {applyResult.workflow.edgesInserted} edges
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setAppliedBlueprint(null);
                    setApplyResult(null);
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setAppliedBlueprint(null);
                    setApplyResult(null);
                    navigate(`/stacks/${stackId}/architecture`);
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  View in Architecture
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
