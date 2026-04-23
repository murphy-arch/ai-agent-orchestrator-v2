import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Bot, AlertTriangle } from "lucide-react";
import type { AgentNodeData } from "@/stores/flowStore";

const hierarchyColors: Record<string, string> = {
  primary: "#3B6AFF",
  secondary: "#A78BFA",
  worker: "rgba(255,255,255,0.3)",
};

const AgentNode = memo(({ data, selected }: { data: AgentNodeData; selected?: boolean }) => {
  const hColor = hierarchyColors[data.hierarchyRole] || hierarchyColors.worker;

  return (
    <div
      className="rounded-xl px-4 py-3 min-w-[180px] transition-all duration-200"
      style={{
        background: "rgba(59,106,255,0.08)",
        border: selected
          ? `2px solid ${hColor}`
          : data.hasCredentials
          ? `1px solid ${hColor}40`
          : "1px solid rgba(59,106,255,0.15)",
        boxShadow: selected
          ? `0 0 20px ${hColor}20`
          : "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#3B6AFF", width: 8, height: 8, border: "2px solid #141416" }}
      />

      <div className="flex items-center gap-2 mb-1">
        <Bot size={14} style={{ color: "#3B6AFF" }} />
        <span
          className="status-badge"
          style={{
            background: `${hColor}15`,
            color: hColor,
            fontSize: "8px",
          }}
        >
          {data.hierarchyRole}
        </span>
        {!data.hasCredentials && (
          <AlertTriangle size={10} style={{ color: "#F87171" }} />
        )}
      </div>

      <div
        className="font-medium truncate"
        style={{ fontSize: "13px", color: "#fff", maxWidth: 160 }}
      >
        {data.agentName}
      </div>

      <div
        className="font-mono-ui truncate"
        style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}
      >
        {data.model}
      </div>

      <div className="flex items-center gap-1.5 mt-1.5">
        <span
          className="status-badge"
          style={{
            background: data.status === "active"
              ? "rgba(74,222,128,0.15)"
              : "rgba(255,255,255,0.06)",
            color: data.status === "active" ? "#4ADE80" : "rgba(255,255,255,0.35)",
            fontSize: "8px",
          }}
        >
          {data.status}
        </span>
        <span
          className="status-badge"
          style={{
            background:
              data.spawnMode === "spawnable"
                ? "rgba(96,165,250,0.15)"
                : "rgba(74,222,128,0.15)",
            color: data.spawnMode === "spawnable" ? "#60A5FA" : "#4ADE80",
            fontSize: "8px",
          }}
        >
          {data.spawnMode}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "#3B6AFF", width: 8, height: 8, border: "2px solid #141416" }}
      />
    </div>
  );
});

AgentNode.displayName = "AgentNode";
export default AgentNode;
