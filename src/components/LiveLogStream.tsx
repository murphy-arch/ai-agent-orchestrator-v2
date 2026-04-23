import { useState, useEffect, useRef, useCallback } from "react";
import { Radio, Pause, Play, X, Filter, Clock, Hash, AlertCircle, Bot, Webhook, MessageSquare } from "lucide-react";

interface LogEntry {
  id?: number;
  agentId: number;
  eventType: string;
  message: string;
  tokensUsed?: number;
  latency?: number;
  createdAt?: string;
}

const EVENT_COLORS: Record<string, { bg: string; text: string; icon: typeof Bot }> = {
  chat: { bg: "rgba(59,106,255,0.15)", text: "#3B6AFF", icon: MessageSquare },
  webhook: { bg: "rgba(74,222,128,0.15)", text: "#4ADE80", icon: Webhook },
  error: { bg: "rgba(248,113,113,0.15)", text: "#F87171", icon: AlertCircle },
  test: { bg: "rgba(251,191,36,0.15)", text: "#FBBF24", icon: Bot },
  status_change: { bg: "rgba(167,139,250,0.15)", text: "#A78BFA", icon: Radio },
};

export default function LiveLogStream({ agentId, onClose }: { agentId?: number; onClose?: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [isConnected, setIsConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const url = agentId
      ? `/api/logs/stream?agentId=${agentId}`
      : "/api/logs/stream";

    const evtSource = new EventSource(url);

    evtSource.onopen = () => {
      setIsConnected(true);
    };

    evtSource.onmessage = (event) => {
      if (isPaused) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") return;
        setLogs((prev) => {
          const next = [data, ...prev];
          return next.slice(0, 500); // Keep last 500 logs
        });
      } catch {
        // Ignore parse errors
      }
    };

    evtSource.onerror = () => {
      setIsConnected(false);
      evtSource.close();
      // Auto-reconnect after 3s
      reconnectTimeout.current = setTimeout(() => connect(), 3000);
    };

    return evtSource;
  }, [agentId, isPaused]);

  useEffect(() => {
    const source = connect();
    return () => {
      source.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  // Auto-scroll to top when new logs arrive
  useEffect(() => {
    if (scrollRef.current && !isPaused) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs, isPaused]);

  const filteredLogs = filter === "all"
    ? logs
    : logs.filter((l) => l.eventType === filter);

  const eventTypes = Array.from(new Set(logs.map((l) => l.eventType)));

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--surface-primary)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Radio size={14} style={{ color: isConnected ? "#4ADE80" : "#F87171" }} />
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
            Live Logs
          </span>
          <span
            className="status-badge"
            style={{
              background: isConnected ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
              color: isConnected ? "#4ADE80" : "#F87171",
              fontSize: "9px",
            }}
          >
            {isConnected ? "Live" : "Reconnecting..."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: "var(--text-muted)" }}
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: "var(--border)" }}>
        <Filter size={12} style={{ color: "var(--text-muted)" }} />
        <button
          onClick={() => setFilter("all")}
          className="px-2 py-0.5 rounded text-xs transition-colors"
          style={{
            background: filter === "all" ? "var(--accent-muted)" : "var(--surface-secondary)",
            color: filter === "all" ? "var(--accent)" : "var(--text-muted)",
            border: filter === "all" ? "1px solid var(--accent)" : "1px solid var(--border)",
          }}
        >
          all
        </button>
        {eventTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className="px-2 py-0.5 rounded text-xs transition-colors capitalize"
            style={{
              background: filter === type ? `${EVENT_COLORS[type]?.text || "#666"}15` : "var(--surface-secondary)",
              color: filter === type ? EVENT_COLORS[type]?.text || "#666" : "var(--text-muted)",
              border: filter === type ? `1px solid ${EVENT_COLORS[type]?.text || "#666"}30` : "1px solid var(--border)",
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Log List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
        {filteredLogs.length === 0 && (
          <div className="text-center py-8" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
            {isPaused ? "Stream paused. Click play to resume." : "Waiting for activity..."}
          </div>
        )}

        {filteredLogs.map((log, i) => {
          const meta = EVENT_COLORS[log.eventType] || EVENT_COLORS.status_change;
          const Icon = meta.icon;

          return (
            <div
              key={log.id || i}
              className="flex items-start gap-2 px-2 py-1.5 rounded-lg"
              style={{ background: "var(--surface-secondary)", border: "1px solid var(--border)" }}
            >
              <Icon size={12} style={{ color: meta.text, marginTop: 2, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: "11px", color: "var(--text-primary)", wordBreak: "break-word" }}>
                  {log.message}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="status-badge"
                    style={{ background: meta.bg, color: meta.text, fontSize: "8px" }}
                  >
                    {log.eventType}
                  </span>
                  {log.latency && (
                    <span className="flex items-center gap-0.5" style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                      <Clock size={8} /> {log.latency}ms
                    </span>
                  )}
                  {log.tokensUsed && (
                    <span className="flex items-center gap-0.5" style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                      <Hash size={8} /> {log.tokensUsed}
                    </span>
                  )}
                  {log.createdAt && (
                    <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          {logs.length} events
        </span>
        <button
          onClick={() => setLogs([])}
          className="text-xs transition-colors hover:text-red-400"
          style={{ color: "var(--text-muted)" }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
