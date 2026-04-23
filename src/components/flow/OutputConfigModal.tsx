import { useState, useEffect } from "react";
import { X, Send, Globe, MessageSquare, Mail, Smartphone, Zap } from "lucide-react";

interface OutputConfig {
  outputType: string;
  url?: string;
  botToken?: string;
  chatId?: string;
  webhookUrl?: string;
  emailTo?: string;
  emailSubject?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  headers?: Record<string, string>;
}

const TYPE_META: Record<string, { label: string; icon: typeof Globe; color: string; fields: string[] }> = {
  webhook: { label: "Webhook", icon: Globe, color: "#FBBF24", fields: ["url"] },
  telegram: { label: "Telegram", icon: MessageSquare, color: "#60A5FA", fields: ["botToken", "chatId"] },
  slack: { label: "Slack", icon: MessageSquare, color: "#A78BFA", fields: ["webhookUrl"] },
  discord: { label: "Discord", icon: MessageSquare, color: "#A78BFA", fields: ["webhookUrl"] },
  email: { label: "Email", icon: Mail, color: "#F87171", fields: ["emailTo", "emailSubject", "smtpHost", "smtpPort", "smtpUser", "smtpPass"] },
  sms: { label: "SMS", icon: Smartphone, color: "#60A5FA", fields: ["webhookUrl"] },
  api: { label: "API", icon: Zap, color: "#3B6AFF", fields: ["url", "headers"] },
};

export default function OutputConfigModal({
  isOpen,
  onClose,
  initialConfig,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialConfig: OutputConfig | null;
  onSave: (config: OutputConfig) => void;
}) {
  const [type, setType] = useState<string>(initialConfig?.outputType || "webhook");
  const [values, setValues] = useState<Record<string, string>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (initialConfig) {
      setType(initialConfig.outputType || "webhook");
      setValues({
        url: initialConfig.url || "",
        botToken: initialConfig.botToken || "",
        chatId: initialConfig.chatId || "",
        webhookUrl: initialConfig.webhookUrl || "",
        emailTo: initialConfig.emailTo || "",
        emailSubject: initialConfig.emailSubject || "",
        smtpHost: initialConfig.smtpHost || "",
        smtpPort: initialConfig.smtpPort || "",
        smtpUser: initialConfig.smtpUser || "",
        smtpPass: initialConfig.smtpPass || "",
      });
    }
  }, [initialConfig, isOpen]);

  const meta = TYPE_META[type];
  const Icon = meta?.icon || Globe;

  const handleSave = () => {
    const config: OutputConfig = { outputType: type, ...values };
    onSave(config);
    onClose();
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/webhook/test-output", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputType: type, config: values }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.detail || data.error || "Test complete" });
    } catch {
      setTestResult({ success: false, message: "Network error" });
    }
    setIsTesting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-2xl border overflow-hidden" style={{ background: "var(--surface-primary)", borderColor: "var(--border)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Send size={16} style={{ color: meta?.color || "#3B6AFF" }} />
            <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>Configure Output</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Type Selector */}
          <div>
            <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Output Type</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {Object.entries(TYPE_META).map(([key, m]) => (
                <button
                  key={key}
                  onClick={() => setType(key)}
                  className="flex flex-col items-center gap-1 px-2 py-2 rounded-lg border transition-all"
                  style={{
                    borderColor: type === key ? m.color : "var(--border)",
                    background: type === key ? `${m.color}15` : "var(--surface-secondary)",
                    color: type === key ? m.color : "var(--text-secondary)",
                    fontSize: "11px",
                  }}
                >
                  <m.icon size={14} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Fields */}
          {meta.fields.includes("url") && (
            <div>
              <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>URL</label>
              <input
                type="text"
                value={values.url || ""}
                onChange={(e) => setValues({ ...values, url: e.target.value })}
                placeholder="https://..."
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
                style={{ background: "var(--surface-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          )}

          {meta.fields.includes("botToken") && (
            <div>
              <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bot Token</label>
              <input
                type="password"
                value={values.botToken || ""}
                onChange={(e) => setValues({ ...values, botToken: e.target.value })}
                placeholder="123456:ABC-DEF..."
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
                style={{ background: "var(--surface-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          )}

          {meta.fields.includes("chatId") && (
            <div>
              <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Chat ID</label>
              <input
                type="text"
                value={values.chatId || ""}
                onChange={(e) => setValues({ ...values, chatId: e.target.value })}
                placeholder="@channel or 123456789"
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
                style={{ background: "var(--surface-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          )}

          {meta.fields.includes("webhookUrl") && (
            <div>
              <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Webhook URL</label>
              <input
                type="text"
                value={values.webhookUrl || ""}
                onChange={(e) => setValues({ ...values, webhookUrl: e.target.value })}
                placeholder="https://hooks.slack.com/..."
                className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
                style={{ background: "var(--surface-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          )}

          {meta.fields.includes("emailTo") && (
            <>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>To Email</label>
                <input
                  type="email"
                  value={values.emailTo || ""}
                  onChange={(e) => setValues({ ...values, emailTo: e.target.value })}
                  placeholder="recipient@example.com"
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
                  style={{ background: "var(--surface-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subject</label>
                <input
                  type="text"
                  value={values.emailSubject || ""}
                  onChange={(e) => setValues({ ...values, emailSubject: e.target.value })}
                  placeholder="Agent Output"
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
                  style={{ background: "var(--surface-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            </>
          )}

          {meta.fields.includes("smtpHost") && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>SMTP Host</label>
                <input
                  type="text"
                  value={values.smtpHost || ""}
                  onChange={(e) => setValues({ ...values, smtpHost: e.target.value })}
                  placeholder="smtp.gmail.com"
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
                  style={{ background: "var(--surface-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Port</label>
                <input
                  type="text"
                  value={values.smtpPort || ""}
                  onChange={(e) => setValues({ ...values, smtpPort: e.target.value })}
                  placeholder="587"
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
                  style={{ background: "var(--surface-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>SMTP User</label>
                <input
                  type="text"
                  value={values.smtpUser || ""}
                  onChange={(e) => setValues({ ...values, smtpUser: e.target.value })}
                  placeholder="user@gmail.com"
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
                  style={{ background: "var(--surface-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>SMTP Password</label>
                <input
                  type="password"
                  value={values.smtpPass || ""}
                  onChange={(e) => setValues({ ...values, smtpPass: e.target.value })}
                  placeholder="••••••••"
                  className="w-full mt-1 px-3 py-2 rounded-lg border text-sm outline-none focus:ring-1"
                  style={{ background: "var(--surface-secondary)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div
              className="p-3 rounded-lg flex items-start gap-2"
              style={{
                background: testResult.success ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
                border: `1px solid ${testResult.success ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
              }}
            >
              <span style={{ fontSize: "12px", color: testResult.success ? "#4ADE80" : "#F87171" }}>
                {testResult.success ? "✓" : "✗"} {testResult.message}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="px-3 py-2 rounded-lg text-sm transition-colors hover:brightness-110 disabled:opacity-50"
            style={{ background: "var(--surface-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            {isTesting ? "Testing..." : "Test Connection"}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:brightness-110"
            style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent)" }}
          >
            Save Config
          </button>
        </div>
      </div>
    </div>
  );
}
