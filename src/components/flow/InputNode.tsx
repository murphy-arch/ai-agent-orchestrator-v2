import { memo } from "react";
import { Handle, Position } from "reactflow";
import { MessageSquare, Phone, Mail, Webhook, Radio, Smartphone, Zap } from "lucide-react";
import type { InputNodeData } from "@/stores/flowStore";

const inputIcons: Record<string, { icon: typeof MessageSquare; color: string }> = {
  telegram: { icon: MessageSquare, color: "#60A5FA" },
  whatsapp: { icon: Phone, color: "#4ADE80" },
  slack: { icon: MessageSquare, color: "#A78BFA" },
  email: { icon: Mail, color: "#F87171" },
  webhook: { icon: Webhook, color: "#FBBF24" },
  sms: { icon: Smartphone, color: "#60A5FA" },
  discord: { icon: MessageSquare, color: "#A78BFA" },
  api: { icon: Zap, color: "#3B6AFF" },
  websocket: { icon: Radio, color: "#60A5FA" },
  custom: { icon: Zap, color: "#3B6AFF" },
};

const InputNode = memo(({ data, selected }: { data: InputNodeData; selected?: boolean }) => {
  const config = inputIcons[data.inputType] || inputIcons.custom;
  const Icon = config.icon;
  const statusColor =
    data.connectionStatus === "connected"
      ? "#4ADE80"
      : data.connectionStatus === "error"
      ? "#F87171"
      : "rgba(255,255,255,0.4)";

  return (
    <div
      className="rounded-xl px-4 py-3 min-w-[160px] transition-all duration-200"
      style={{
        background: "rgba(74,222,128,0.08)",
        border: selected
          ? "2px solid #4ADE80"
          : data.hasCredentials
          ? "1px solid rgba(74,222,128,0.4)"
          : "1px solid rgba(74,222,128,0.15)",
        boxShadow: selected
          ? "0 0 20px rgba(74,222,128,0.2)"
          : "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} style={{ color: config.color }} />
        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: config.color,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {data.inputType}
        </span>
        <div
          className="w-1.5 h-1.5 rounded-full ml-auto"
          style={{ background: statusColor }}
        />
      </div>

      <div
        className="font-medium truncate"
        style={{ fontSize: "12px", color: "#fff", maxWidth: 140 }}
      >
        {data.sourceName}
      </div>

      {!data.hasCredentials && (
        <div style={{ fontSize: "9px", color: "#F87171", marginTop: "4px" }}>
          Missing credentials
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: "#4ADE80",
          width: 8,
          height: 8,
          border: "2px solid #141416",
        }}
      />
    </div>
  );
});

InputNode.displayName = "InputNode";
export default InputNode;
