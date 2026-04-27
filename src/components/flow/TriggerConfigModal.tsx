import { useState } from "react";
import { X, Zap, Calendar, Radio, Globe } from "lucide-react";

interface TriggerConfig {
  triggerType: string;
  cronExpression?: string;
  sourceName?: string;
  webhookUrl?: string;
}

const TYPE_META: Record<string, { label: string; icon: typeof Zap; color: string; fields: string[] }> = {
  manual: { label: "Manual", icon: Zap, color: "#FBBF24", fields: ["sourceName"] },
  schedule: { label: "Schedule", icon: Calendar, color: "#60A5FA", fields: ["sourceName", "cronExpression"] },
  webhook: { label: "Webhook", icon: Globe, color: "#34D399", fields: ["sourceName", "webhookUrl"] },
  event: { label: "Event", icon: Radio, color: "#A78BFA", fields: ["sourceName"] },
};

export default function TriggerConfigModal({
  isOpen,
  onClose,
  initialConfig,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialConfig: TriggerConfig | null;
  onSave: (config: TriggerConfig) => void;
}) {
  const [type, setType] = useState<string>(initialConfig?.triggerType || "manual");
  const [values, setValues] = useState<Record<string, string>>(() => ({
    sourceName: initialConfig?.sourceName || "",
    cronExpression: initialConfig?.cronExpression || "",
    webhookUrl: initialConfig?.webhookUrl || "",
  }));

  const meta = TYPE_META[type];

  const handleSave = () => {
    const config: TriggerConfig = { triggerType: type, ...values };
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
            <Zap size={16} style={{ color: meta?.color || "#FBBF24" }} />
            <span className="text-sm font-semibold text-gray-900">Configure Trigger</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Type Selector */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Trigger Type</label>
            <div className="grid grid-cols-4 gap-2 mt-2">
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

          {/* Source Name / Label */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Trigger Name</label>
            <input
              type="text"
              value={values.sourceName || ""}
              onChange={(e) => setValues({ ...values, sourceName: e.target.value })}
              placeholder="Daily Report Trigger"
              className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 bg-gray-50 border-gray-200 text-gray-900"
            />
          </div>

          {/* Cron Expression for Schedule */}
          {meta.fields.includes("cronExpression") && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Cron Expression</label>
              <input
                type="text"
                value={values.cronExpression || ""}
                onChange={(e) => setValues({ ...values, cronExpression: e.target.value })}
                placeholder="0 9 * * *"
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1 bg-gray-50 border-gray-200 text-gray-900 font-mono"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Examples: <code className="bg-gray-100 px-1 rounded">0 9 * * *</code> (9am daily),{" "}
                <code className="bg-gray-100 px-1 rounded">0 */6 * * *</code> (every 6h),{" "}
                <code className="bg-gray-100 px-1 rounded">0 9 * * 1</code> (Mon 9am)
              </p>
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
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            Save Config
          </button>
        </div>
      </div>
    </div>
  );
}
