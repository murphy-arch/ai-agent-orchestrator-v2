import { useState } from "react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackContext";
import {
  LayoutTemplate,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Copy,
  Trash2,
  MessageSquare,
  FileText,
  GitBranch,
  BookOpen,
  Code2,
  BarChart3,
  Network,
  Bot,
  Zap,
  Brain,
  Users,
  TrendingUp,
} from "lucide-react";

const categoryIcons: Record<string, React.ReactNode> = {
  support: <MessageSquare className="h-5 w-5 text-blue-500" />,
  content: <FileText className="h-5 w-5 text-purple-500" />,
  routing: <GitBranch className="h-5 w-5 text-amber-500" />,
  knowledge: <BookOpen className="h-5 w-5 text-teal-500" />,
  engineering: <Code2 className="h-5 w-5 text-orange-500" />,
  analytics: <BarChart3 className="h-5 w-5 text-cyan-500" />,
  orchestration: <Network className="h-5 w-5 text-violet-500" />,
  sales: <TrendingUp className="h-5 w-5 text-green-500" />,
};

const categoryLabels: Record<string, string> = {
  support: "Support",
  content: "Content",
  routing: "Routing",
  knowledge: "Knowledge",
  engineering: "Engineering",
  analytics: "Analytics",
  orchestration: "Orchestration",
  sales: "Sales",
  general: "General",
};

const nodeTypeIcons: Record<string, React.ReactNode> = {
  agent: <Bot className="h-3.5 w-3.5" />,
  orchestrator: <Brain className="h-3.5 w-3.5" />,
  trigger: <Zap className="h-3.5 w-3.5" />,
  input: <Zap className="h-3.5 w-3.5" />,
  output: <ArrowRight className="h-3.5 w-3.5" />,
  memory: <BookOpen className="h-3.5 w-3.5" />,
  knowledge: <BookOpen className="h-3.5 w-3.5" />,
  "variable-set": <FileText className="h-3.5 w-3.5" />,
  delay: <Zap className="h-3.5 w-3.5" />,
  loop: <GitBranch className="h-3.5 w-3.5" />,
  parallel: <Network className="h-3.5 w-3.5" />,
  team: <Users className="h-3.5 w-3.5" />,
};

const roleBadgeColors: Record<string, string> = {
  orchestrator: "bg-purple-100 text-purple-700 border-purple-200",
  manager: "bg-blue-100 text-blue-700 border-blue-200",
  worker: "bg-emerald-100 text-emerald-700 border-blue-200",
};

interface TemplateNode {
  id: number;
  type: string;
  data?: {
    label?: string;
    agentSpec?: {
      name: string;
      hierarchyRole?: string;
      modelName?: string;
    };
  };
}

function getAgentRoles(nodes: TemplateNode[]): { role: string; name: string }[] {
  return nodes
    .filter((n) => (n.type === "agent" || n.type === "orchestrator") && n.data?.agentSpec)
    .map((n) => ({
      role: n.data!.agentSpec!.hierarchyRole || "worker",
      name: n.data!.agentSpec!.name || n.data!.label || "Agent",
    }));
}

function getNodeTypeCounts(nodes: TemplateNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const n of nodes) {
    counts[n.type] = (counts[n.type] || 0) + 1;
  }
  return counts;
}

export default function Templates() {
  const { stackId } = useStack();
  const utils = trpc.useUtils();
  const [appliedId, setAppliedId] = useState<number | null>(null);

  const { data: templates, isLoading } = trpc.template.list.useQuery({});
  const applyMutation = trpc.template.use.useMutation({
    onSuccess: (_, vars) => {
      setAppliedId(vars.templateId);
      setTimeout(() => setAppliedId(null), 2000);
      utils.agent.list.invalidate({ stackId });
    },
    onError: (err) => {
      console.error("[Templates] apply failed:", err);
      alert(err.message || "Failed to apply template");
    },
  });
  const deleteMutation = trpc.template.delete.useMutation({
    onSuccess: () => utils.template.list.invalidate(),
    onError: (err) => {
      console.error("[Templates] delete failed:", err);
      alert(err.message || "Failed to delete template");
    },
  });

  const categories = Array.from(
    new Set(templates?.map((t: { category: string | null }) => t.category) ?? [])
  ) as string[];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
            <LayoutTemplate className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Templates</h1>
            <p className="text-xs text-gray-500">
              Pre-built agent workflows you can deploy instantly
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="space-y-8">
          {categories.map((cat: string) => (
            <section key={cat}>
              <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
                {categoryLabels[cat] ?? cat}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {templates
                  ?.filter((t: { category: string | null }) => t.category === cat)
                  .map((template: any) => {
                    const nodes = (template.nodes ?? []) as TemplateNode[];
                    const roles = getAgentRoles(nodes);
                    const nodeCounts = getNodeTypeCounts(nodes);

                    return (
                      <div
                        key={template.id}
                        className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-gray-300"
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {categoryIcons[cat] ?? (
                              <LayoutTemplate className="h-5 w-5 text-gray-400" />
                            )}
                            <h3 className="text-sm font-semibold text-gray-900">
                              {template.name}
                            </h3>
                          </div>
                          {template.usageCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                              <Copy className="h-3 w-3" />
                              {template.usageCount}
                            </span>
                          )}
                        </div>

                        <p className="mb-3 flex-1 text-xs text-gray-500 line-clamp-3">
                          {template.description}
                        </p>

                        {/* Node type breakdown */}
                        <div className="mb-3 flex flex-wrap gap-1">
                          {Object.entries(nodeCounts).map(([type, count]) => (
                            <span
                              key={type}
                              className="inline-flex items-center gap-1 rounded bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 capitalize"
                            >
                              {nodeTypeIcons[type] ?? null}
                              {type.replace(/-/g, " ")}
                              {count > 1 && ` ×${count}`}
                            </span>
                          ))}
                        </div>

                        {/* Agent roles included */}
                        {roles.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-1">
                            {roles.map((r, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                  roleBadgeColors[r.role] ?? roleBadgeColors.worker
                                }`}
                                title={r.role}
                              >
                                {r.role === "orchestrator"
                                  ? "👑"
                                  : r.role === "manager"
                                  ? "📋"
                                  : "🔧"}
                                {r.name}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              applyMutation.mutate({
                                stackId,
                                templateId: template.id,
                              })
                            }
                            disabled={applyMutation.isPending}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {appliedId === template.id ? (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                Applied
                              </>
                            ) : applyMutation.isPending &&
                              applyMutation.variables?.templateId === template.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Applying...
                              </>
                            ) : (
                              <>
                                <ArrowRight className="h-4 w-4" />
                                Use Template
                              </>
                            )}
                          </button>
                          <button
                            onClick={() =>
                              deleteMutation.mutate({ templateId: template.id })
                            }
                            title="Delete template"
                            className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:bg-gray-50 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          ))}

          {(!templates || templates.length === 0) && (
            <p className="py-8 text-center text-sm text-gray-400">
              No templates available yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
