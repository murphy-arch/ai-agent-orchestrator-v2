import { useState } from "react";
import {
  Loader2,
  MessageSquare,
  Users,
  Bot,
  TrendingUp,
  Clock,
  BarChart3,
  Activity,
  DollarSign,
  Zap,
  CheckCircle2,
  XCircle,
  Play,
  ChevronRight,
  X,
  Shield,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackContext";

type Period = "24h" | "7d" | "30d";

function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const periods: { value: Period; label: string }[] = [
    { value: "24h", label: "24 hours" },
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === p.value
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function SimpleBarChart({
  data,
}: {
  data: { label: string; value: number; color?: string }[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-24 flex-shrink-0 truncate text-xs font-medium text-gray-600">
            {d.label}
          </span>
          <div className="flex-1">
            <div
              className="h-6 rounded-md bg-blue-500 transition-all duration-500"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color,
                opacity: 0.85,
              }}
            />
          </div>
          <span className="w-8 text-right text-xs font-semibold text-gray-700">
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ data, color = "#2563eb" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const width = 100;
  const height = 40;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full overflow-visible" preserveAspectRatio="none">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`${pathD} L ${width},${height} L 0,${height} Z`}
        fill={color}
        opacity="0.08"
      />
    </svg>
  );
}

export default function Analytics() {
  const { stackId } = useStack();
  const [period, setPeriod] = useState<Period>("7d");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<{ id: number; runId: number; nodeId: number; context: string | null; prompt: string | null; timeoutMinutes: number | null; timeoutAction: string | null } | null>(null);
  const [approvalResponse, setApprovalResponse] = useState("");

  const { data: analytics, isLoading } = trpc.analytics.getAnalytics.useQuery({
    stackId,
    period,
  });
  const { data: agents } = trpc.agent.list.useQuery({ stackId });
  const { data: costSummary } = trpc.executionHistory.costSummary.useQuery({ stackId });
  const { data: executionRuns } = trpc.executionHistory.list.useQuery({ stackId, limit: 50 });
  const { data: selectedRun } = trpc.executionHistory.getById.useQuery(
    { stackId, runId: selectedRunId! },
    { enabled: selectedRunId !== null }
  );
  const { data: pendingApprovals, refetch: refetchApprovals } = trpc.executionHistory.listPendingApprovals.useQuery(
    { stackId },
    { refetchInterval: 10000 }
  );
  const resumeMutation = trpc.execution.resumePausedRun.useMutation({
    onSuccess: () => {
      refetchApprovals();
      setSelectedApproval(null);
      setApprovalResponse("");
    },
    onError: (err) => {
      console.error("[Analytics] resume failed:", err);
      alert(err.message || "Failed to resume workflow");
    },
  });

  const activeAgents = agents?.filter((a) => a.isEnabled).length ?? 0;

  // Build messages-by-agent data
  const messagesByAgent =
    analytics?.messagesByAgent?.map(
      (item: { agentName: string; count: number }) => ({
        label: item.agentName,
        value: item.count,
        color: "#3b82f6",
      })
    ) ?? [];

  // Build messages-by-day data
  const messagesByDay =
    analytics?.messagesByDay?.map(
      (item: { date: string; count: number }) => item.count
    ) ?? [];

  const messagesByDayLabels =
    analytics?.messagesByDay?.map(
      (item: { date: string; count: number }) => item.date
    ) ?? [];

  // Map agentActivity to recentActivity shape
  const recentActivity =
    analytics?.agentActivity?.map(
      (item: { agentName: string; messageCount: number }) => ({
        id: item.agentName,
        agentName: item.agentName,
        source: "web",
        preview: `${item.messageCount} messages`,
        timestamp: new Date().toISOString(),
      })
    ) ?? [];

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Analytics</h1>
            <p className="text-xs text-gray-500">Monitor stack performance</p>
          </div>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Cost & Usage Metrics */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total Runs"
              value={costSummary?.totalRuns ?? 0}
              icon={<Play className="h-5 w-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="Total Tokens"
              value={costSummary?.totalTokens ?? 0}
              icon={<Zap className="h-5 w-5 text-purple-600" />}
              color="bg-purple-50"
            />
            <MetricCard
              title="Est. Cost"
              value={`$${(costSummary?.totalCost ?? 0).toFixed(4)}`}
              icon={<DollarSign className="h-5 w-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="Avg Duration"
              value={`${costSummary?.avgDuration ?? 0}ms`}
              icon={<Clock className="h-5 w-5 text-amber-600" />}
              color="bg-amber-50"
            />
          </div>

          {/* Original Metrics Row */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total Conversations"
              value={analytics?.totalConversations ?? 0}
              icon={<Users className="h-5 w-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="Total Messages"
              value={analytics?.totalMessages ?? 0}
              icon={<MessageSquare className="h-5 w-5 text-purple-600" />}
              color="bg-purple-50"
            />
            <MetricCard
              title="Active Agents"
              value={activeAgents}
              icon={<Bot className="h-5 w-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="Avg. Response Time"
              value="—"
              icon={<TrendingUp className="h-5 w-5 text-amber-600" />}
              color="bg-amber-50"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Messages by Agent */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Bot className="h-4 w-4 text-gray-500" />
                Messages by Agent
              </h2>
              {messagesByAgent.length > 0 ? (
                <SimpleBarChart data={messagesByAgent} />
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">
                  No data available for this period
                </p>
              )}
            </div>

            {/* Messages by Day */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Activity className="h-4 w-4 text-gray-500" />
                Messages by Day
              </h2>
              {messagesByDay.length > 0 ? (
                <div>
                  <Sparkline data={messagesByDay} />
                  <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                    <span>{messagesByDayLabels[0] ?? ""}</span>
                    <span>{messagesByDayLabels[messagesByDayLabels.length - 1] ?? ""}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-7 gap-1">
                    {analytics?.messagesByDay?.map(
                      (item: { date: string; count: number }, i: number) => (
                        <div
                          key={i}
                          className="flex flex-col items-center rounded-md bg-gray-50 p-1.5"
                        >
                          <span className="text-xs font-semibold text-gray-700">
                            {item.count}
                          </span>
                          <span className="text-[9px] text-gray-400">
                            {new Date(item.date).toLocaleDateString(undefined, {
                              weekday: "narrow",
                            })}
                          </span>
                        </div>
                      )
                    ) ?? []}
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">
                  No data available for this period
                </p>
              )}
            </div>
          </div>

          {/* Pending Human Approvals */}
          {pendingApprovals && pendingApprovals.length > 0 && (
            <div className="mt-6 rounded-xl border border-orange-200 bg-white shadow-sm">
              <div className="border-b border-orange-100 px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Shield className="h-4 w-4 text-orange-500" />
                  Pending Human Approvals
                  <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-700">
                    {pendingApprovals.length}
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-orange-50/50 text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-3">Prompt</th>
                      <th className="px-5 py-3">Context Preview</th>
                      <th className="px-5 py-3">Timeout</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingApprovals.map((approval) => (
                      <tr key={approval.id} className="transition-colors hover:bg-orange-50/30">
                        <td className="px-5 py-3 max-w-xs">
                          <p className="text-sm font-medium text-gray-900 truncate" title={approval.prompt || ""}>
                            {approval.prompt || "Approval required"}
                          </p>
                          <p className="text-xs text-gray-400">Run #{approval.runId} • Node {approval.nodeId}</p>
                        </td>
                        <td className="px-5 py-3 max-w-xs truncate text-gray-500">
                          {approval.context || "—"}
                        </td>
                        <td className="px-5 py-3">
                          {approval.timeoutMinutes ? (
                            <span className="text-xs text-orange-600">{approval.timeoutMinutes}m</span>
                          ) : (
                            <span className="text-xs text-gray-400">None</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setSelectedApproval(approval as any)}
                            className="rounded-md bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-100"
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Execution Runs Table */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                Execution History
              </h2>
            </div>
            <div className="overflow-x-auto">
              {executionRuns && executionRuns.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Trigger</th>
                      <th className="px-5 py-3">Input</th>
                      <th className="px-5 py-3">Tokens</th>
                      <th className="px-5 py-3">Cost</th>
                      <th className="px-5 py-3">Duration</th>
                      <th className="px-5 py-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {executionRuns.map((run) => (
                      <tr
                        key={run.id}
                        className="transition-colors hover:bg-gray-50/50 cursor-pointer"
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <td className="px-5 py-3">
                          {run.status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : run.status === "failed" ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : run.status === "paused" ? (
                            <Shield className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {run.trigger}
                          </span>
                        </td>
                        <td className="max-w-xs truncate px-5 py-3 text-gray-500">
                          {run.inputMessage}
                        </td>
                        <td className="px-5 py-3 text-gray-700">{run.totalTokens ?? 0}</td>
                        <td className="px-5 py-3 text-gray-700">${Number(run.totalCost ?? 0).toFixed(4)}</td>
                        <td className="px-5 py-3 text-gray-700">{run.durationMs ?? 0}ms</td>
                        <td className="px-5 py-3 text-right text-xs text-gray-400">
                          {new Date(run.createdAt!).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">
                  No execution runs yet
                </p>
              )}
            </div>
          </div>

          {/* Recent Activity Table */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Clock className="h-4 w-4 text-gray-500" />
                Recent Activity
              </h2>
            </div>
            <div className="overflow-x-auto">
              {recentActivity.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-3">Agent</th>
                      <th className="px-5 py-3">Source</th>
                      <th className="px-5 py-3">Preview</th>
                      <th className="px-5 py-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentActivity.map(
                      (
                        item: {
                          id: number;
                          agentName: string;
                          source: string;
                          preview: string;
                          timestamp: string;
                        },
                        idx: number
                      ) => (
                        <tr key={idx} className="transition-colors hover:bg-gray-50/50">
                          <td className="px-5 py-3 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <Bot className="h-4 w-4 text-gray-400" />
                              {item.agentName}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              {item.source}
                            </span>
                          </td>
                          <td className="max-w-xs truncate px-5 py-3 text-gray-500">
                            {item.preview}
                          </td>
                          <td className="px-5 py-3 text-right text-xs text-gray-400">
                            {new Date(item.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">
                  No recent activity for this period
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Approval Review Modal */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Human Approval Required</h3>
                <p className="text-xs text-gray-500">
                  Run #{selectedApproval.runId} • Node {selectedApproval.nodeId}
                </p>
              </div>
              <button
                onClick={() => setSelectedApproval(null)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase">Approval Prompt</label>
                <p className="mt-1 text-sm text-gray-800 bg-gray-50 rounded-lg p-3">
                  {selectedApproval.prompt || "Please review and approve to continue."}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase">Context</label>
                <p className="mt-1 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {selectedApproval.context || "—"}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase">Your Response (optional)</label>
                <textarea
                  rows={3}
                  value={approvalResponse}
                  onChange={(e) => setApprovalResponse(e.target.value)}
                  placeholder="Add a comment or modified context..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setSelectedApproval(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    resumeMutation.mutate({
                      stackId,
                      runId: selectedApproval.runId,
                      decision: "reject",
                      response: approvalResponse,
                    });
                  }}
                  disabled={resumeMutation.isPending}
                  className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  <ThumbsDown className="h-4 w-4" />
                  Reject
                </button>
                <button
                  onClick={() => {
                    resumeMutation.mutate({
                      stackId,
                      runId: selectedApproval.runId,
                      decision: "approve",
                      response: approvalResponse,
                    });
                  }}
                  disabled={resumeMutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {resumeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <ThumbsUp className="h-4 w-4" />
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trace Viewer Modal */}
      {selectedRunId && selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Execution Trace</h3>
                <p className="text-xs text-gray-500">
                  Run #{selectedRun.id} • {selectedRun.status} • {selectedRun.totalTokens} tokens • ${Number(selectedRun.totalCost ?? 0).toFixed(4)}
                </p>
              </div>
              <button
                onClick={() => setSelectedRunId(null)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {(selectedRun.trace as Array<{
                step: number;
                nodeId: number;
                nodeType: string;
                timestamp: string;
                input: string;
                output?: string;
                tokensUsed?: number;
                latencyMs?: number;
                error?: string;
              }> | null)?.map((step, i) => (
                <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                      {step.step}
                    </span>
                    <span className="text-xs font-medium text-gray-500 uppercase">{step.nodeType}</span>
                    <span className="text-xs text-gray-400">Node {step.nodeId}</span>
                    {step.latencyMs && (
                      <span className="ml-auto text-xs text-gray-400">{step.latencyMs}ms</span>
                    )}
                  </div>
                  {step.error ? (
                    <div className="rounded bg-red-50 p-2 text-sm text-red-700">{step.error}</div>
                  ) : (
                    <>
                      <div className="mb-2">
                        <span className="text-[10px] font-medium text-gray-400 uppercase">Input</span>
                        <p className="text-sm text-gray-700">{step.input}</p>
                      </div>
                      {step.output && (
                        <div>
                          <span className="text-[10px] font-medium text-gray-400 uppercase">Output</span>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">{step.output}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )) ?? (
                <p className="text-center text-sm text-gray-500">No trace data available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
