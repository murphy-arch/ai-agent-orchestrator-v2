import { memo } from "react";
import { Position, Handle } from "reactflow";
import { GitBranch } from "lucide-react";

const ConditionNode = memo(({ data, selected }: { data: { label: string; condition?: string }; selected?: boolean }) => {
  return (
    <div
      className="flex items-center justify-center transition-all duration-200"
      style={{
        width: 140,
        height: 80,
        transform: "rotate(45deg)",
        background: selected ? "rgba(251,191,36,0.15)" : "rgba(251,191,36,0.08)",
        border: selected ? "2px solid #FBBF24" : "1px solid rgba(251,191,36,0.3)",
        boxShadow: selected ? "0 0 20px rgba(251,191,36,0.2)" : "0 2px 8px rgba(0,0,0,0.08)",
        borderRadius: 8,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: "#FBBF24",
          width: 8,
          height: 8,
          border: "2px solid #fff",
          transform: "rotate(-45deg)",
        }}
      />
      <div
        className="flex flex-col items-center gap-1"
        style={{ transform: "rotate(-45deg)", width: 100 }}
      >
        <GitBranch size={14} style={{ color: "#FBBF24" }} />
        <span className="text-[11px] font-medium text-gray-800 text-center leading-tight truncate w-full">
          {data.label || "Condition"}
        </span>
        {data.condition && (
          <span className="text-[9px] text-gray-400 text-center truncate w-full">
            {data.condition}
          </span>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: "#FBBF24",
          width: 8,
          height: 8,
          border: "2px solid #fff",
          transform: "rotate(-45deg)",
        }}
        id="true"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: "#F87171",
          width: 8,
          height: 8,
          border: "2px solid #fff",
          transform: "rotate(-45deg)",
        }}
        id="false"
      />
    </div>
  );
});

ConditionNode.displayName = "ConditionNode";
export default ConditionNode;
