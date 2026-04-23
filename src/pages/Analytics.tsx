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
} from "lucide-react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackLayout";

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

  const { data: analytics, isLoading } = trpc.analytics.getAnalytics.useQuery({
    stackId,
    period,
  });
  const { data: agents } = trpc.agent.list.useQuery({ stackId });

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
          {/* Metrics Row */}
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
    </div>
  );
}
