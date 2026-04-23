import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Crown, AlertTriangle } from "lucide-react";
import type { AgentNodeData } from "@/stores/flowStore";

const OrchestratorNode = memo(({ data, selected }: { data: AgentNodeData; selected?: boolean }) => {
  return (
    <div
      className="rounded-xl px-4 py-3 min-w-[200px] transition-all duration-200"
      style={{
        background: "rgba(251,191,36,0.1)",
        border: selected
          ? "2px solid #FBBF24"
          : data.hasCredentials
          ? "1px solid rgba(251,191,36,0.4)"
          : "1px solid rgba(251,191,36,0.2)",
        boxShadow: selected
          ? "0 0 20px rgba(251,191,36,0.25)"
          : "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#FBBF24", width: 8, height: 8, border: "2px solid #141416" }}
      />

      <div className="flex items-center gap-2 mb-1">
        <Crown size={14} style={{ color: "#FBBF24" }} />
        <span style={{ fontSize: "10px", fontWeight: 600, color: "#FBBF24", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Orchestrator
        </span>
        {!data.hasCredentials && (
          <AlertTriangle size={10} style={{ color: "#F87171" }} />
        )}
      </div>

      <div
        className="font-medium truncate"
        style={{ fontSize: "13px", color: "#fff", maxWidth: 180 }}
      >
        {data.agentName}
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span
          className="font-mono-ui"
          style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)" }}
        >
          {data.model}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5">
        <span
          className="status-badge"
          style={{
            background: data.status === "active"
              ? "rgba(74,222,128,0.15)"
              : "rgba(255,255,255,0.06)",
            color: data.status === "active" ? "#4ADE80" : "rgba(255,255,255,0.4)",
            fontSize: "8px",
          }}
        >
          {data.status}
        </span>
        <span
          className="status-badge"
          style={{
            background: data.spawnMode === "spawnable"
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
        style={{ background: "#FBBF24", width: 8, height: 8, border: "2px solid #141416" }}
      />
    </div>
  );
});

OrchestratorNode.displayName = "OrchestratorNode";
export default OrchestratorNode;
