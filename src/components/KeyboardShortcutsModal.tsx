import { useState, useEffect } from "react";
import { Keyboard, X } from "lucide-react";

interface Shortcut {
  keys: string;
  description: string;
  scope: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: "Ctrl + Z", description: "Undo last action", scope: "Architecture" },
  { keys: "Ctrl + Shift + Z", description: "Redo last action", scope: "Architecture" },
  { keys: "Ctrl + Y", description: "Redo last action", scope: "Architecture" },
  { keys: "Ctrl + S", description: "Save workflow", scope: "Architecture" },
  { keys: "Delete / Backspace", description: "Remove selected node", scope: "Architecture" },
  { keys: "?", description: "Show this shortcuts guide", scope: "Global" },
];

export function useKeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { isOpen, setIsOpen };
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  const globalShortcuts = SHORTCUTS.filter((s) => s.scope === "Global");
  const architectureShortcuts = SHORTCUTS.filter((s) => s.scope === "Architecture");

  const ShortcutRow = ({ shortcut }: { shortcut: Shortcut }) => (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{shortcut.description}</span>
      <kbd
        className="px-2 py-1 rounded-md font-mono-ui"
        style={{
          fontSize: "11px",
          background: "var(--surface-secondary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          minWidth: "80px",
          textAlign: "center",
        }}
      >
        {shortcut.keys}
      </kbd>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--surface-primary)", border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <Keyboard size={16} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>Keyboard Shortcuts</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {globalShortcuts.length > 0 && (
            <div className="mb-4">
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 500,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                }}
              >
                Global
              </div>
              {globalShortcuts.map((s, i) => (
                <ShortcutRow key={i} shortcut={s} />
              ))}
            </div>
          )}

          <div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 500,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "8px",
              }}
            >
              Architecture Canvas
            </div>
            {architectureShortcuts.map((s, i) => (
              <ShortcutRow key={i} shortcut={s} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t text-center" style={{ borderColor: "var(--border)" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Press <kbd className="px-1 py-0.5 rounded font-mono-ui" style={{ fontSize: "10px", background: "var(--surface-secondary)", border: "1px solid var(--border)" }}>?</kbd> anywhere to toggle this guide
          </span>
        </div>
      </div>
    </div>
  );
}
