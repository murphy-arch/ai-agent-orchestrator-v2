import { useState } from "react";
import { X, MessageSquare, Webhook, Radio, Zap } from "lucide-react";

interface InputConfig {
  inputType: string;
  botToken?: string;
  webhookUrl?: string;
  sourceName?: string;
}

const TYPE_META: Record<string, { label: string; icon: typeof MessageSquare; color: string; fields: string[] }> = {
  telegram: { label: "Telegram", icon: MessageSquare, color: "#60A5FA", fields: ["botToken", "sourceName"] },
  webhook: { label: "Webhook", icon: Webhook, color: "#FBBF24", fields: ["webhookUrl", "sourceName"] },
  websocket: { label: "WebSocket", icon: Radio, color: "#60A5FA", fields: ["sourceName"] },
  api: { label: "API", icon: Zap, color: "#3B6AFF", fields: ["sourceName"] },
};

export default function InputConfigModal({
  isOpen,
  onClose,
  initialConfig,
  onSave,
  onSetWebhook,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialConfig: InputConfig | null;
  onSave: (config: InputConfig) => void;
  onSetWebhook?: (botToken: string) => Promise<void>;
}) {
  const [type, setType] = useState<string>(initialConfig?.inputType || "telegram");
  const [values, setValues] = useState<Record<string, string>>(() => ({
    botToken: initialConfig?.botToken || "",
    webhookUrl: initialConfig?.webhookUrl || "",
    sourceName: initialConfig?.sourceName || "",
  }));

  const meta = TYPE_META[type];

  const handleSave = () => {
    const config: InputConfig = { inputType: type, ...values };
    onSave(config);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl border overflow-hidden bg-white border-gray-200 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} style={{ color: meta?.color || "#3B6AFF" }} />
            <span className="text-sm font-semibold text-gray-900">Configure Input</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Type Selector */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Input Type</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {Object.entries(TYPE_META).map(([key, m]) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg border transition-all text-xs"
                  style={{
                    borderColor: type === key ? m.color : "#e5e7eb",
                    background: type === key ? `${m.color}15` : "#f9fafb",
                    color: type === key ? m.color : "#6b7280",
                  }}
                >
                  <m.icon size={14} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source Name */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Source Name</label>
            <input
              type="text"
              value={values.sourceName || ""}
              onChange={(e) => setValues({ ...values, sourceName: e.target.value })}
              placeholder="My Telegram Bot"
              className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 bg-gray-50 border-gray-200 text-gray-900"
            />
          </div>

          {/* Bot Token for Telegram */}
          {meta.fields.includes("botToken") && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Bot Token</label>
              <input
                type="password"
                value={values.botToken || ""}
                onChange={(e) => setValues({ ...values, botToken: e.target.value })}
                placeholder="123456:ABC-DEF..."
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
          )}

          {/* Webhook URL */}
          {meta.fields.includes("webhookUrl") && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Webhook URL</label>
              <input
                type="text"
                value={values.webhookUrl || ""}
                onChange={(e) => setValues({ ...values, webhookUrl: e.target.value })}
                placeholder="https://..."
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 bg-gray-50 border-gray-200 text-gray-900"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          {type === "telegram" && onSetWebhook && values.botToken && (
            <button
              onClick={async () => {
                try {
                  await onSetWebhook(values.botToken);
                  alert("Telegram webhook set successfully!");
                } catch (err) {
                  alert(`Failed to set webhook: ${err instanceof Error ? err.message : String(err)}`);
                }
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              Set Webhook
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Save Config
          </button>
        </div>
      </div>
    </div>
  );
}
