import { memo } from "react";
import { Handle, Position } from "reactflow";
import { GitBranch } from "lucide-react";

interface ConditionNodeData {
  label?: string;
  condition?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const ConditionNode = memo(({ data, selected }: { data: ConditionNodeData; selected?: boolean }) => {
  return (
    <div
      className="rounded-xl px-4 py-3 min-w-[180px] transition-all duration-200"
      style={{
        background: "rgba(251,191,36,0.08)",
        border: selected
          ? "2px solid #FBBF24"
          : "1px solid rgba(251,191,36,0.2)",
        boxShadow: selected
          ? "0 0 20px rgba(251,191,36,0.15)"
          : "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#FBBF24", width: 8, height: 8, border: "2px solid #141416" }}
      />

      <div className="flex items-center gap-2 mb-1">
        <GitBranch size={14} style={{ color: "#FBBF24" }} />
        <span
          className="status-badge"
          style={{
            background: "rgba(251,191,36,0.15)",
            color: "#FBBF24",
            fontSize: "8px",
          }}
        >
          condition
        </span>
      </div>

      <div
        className="font-medium truncate"
        style={{ fontSize: "13px", color: "#fff", maxWidth: 160 }}
      >
        {data.label || "Condition"}
      </div>

      {data.condition && (
        <div
          className="font-mono-ui truncate"
          style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}
        >
          {data.condition}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ background: "#4ADE80", width: 8, height: 8, border: "2px solid #141416", top: "30%" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ background: "#F87171", width: 8, height: 8, border: "2px solid #141416", top: "70%" }}
      />
    </div>
  );
});

ConditionNode.displayName = "ConditionNode";
export default ConditionNode;
