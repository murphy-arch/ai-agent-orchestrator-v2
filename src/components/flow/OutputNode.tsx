import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Send } from "lucide-react";

interface OutputNodeData {
  outputType?: string;
  label?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const typeColors: Record<string, string> = {
  telegram: "#60A5FA",
  slack: "#A78BFA",
  discord: "#A78BFA",
  email: "#F87171",
  webhook: "#FBBF24",
  sms: "#60A5FA",
  api: "#3B6AFF",
};

const OutputNode = memo(({ data, selected }: { data: OutputNodeData; selected?: boolean }) => {
  const color = typeColors[data.outputType || "webhook"] || "#3B6AFF";

  return (
    <div
      className="rounded-xl px-4 py-3 min-w-[180px] transition-all duration-200"
      style={{
        background: `${color}10`,
        border: selected ? `2px solid ${color}` : `1px solid ${color}30`,
        boxShadow: selected ? `0 0 20px ${color}20` : "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, width: 8, height: 8, border: "2px solid #141416" }}
      />

      <div className="flex items-center gap-2 mb-1">
        <Send size={14} style={{ color }} />
        <span
          className="status-badge"
          style={{ background: `${color}15`, color, fontSize: "8px" }}
        >
          {data.outputType || "output"}
        </span>
      </div>

      <div
        className="font-medium truncate"
        style={{ fontSize: "13px", color: "#fff", maxWidth: 160 }}
      >
        {data.label || "Output"}
      </div>

      {data.outputType && (
        <div
          className="font-mono-ui truncate"
          style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}
        >
          {data.outputType}
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-1.5">
        <span
          className="status-badge"
          style={{
            background: data.config ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)",
            color: data.config ? "#4ADE80" : "rgba(255,255,255,0.35)",
            fontSize: "8px",
          }}
        >
          {data.config ? "configured" : "no config"}
        </span>
      </div>
    </div>
  );
});

OutputNode.displayName = "OutputNode";
export default OutputNode;
