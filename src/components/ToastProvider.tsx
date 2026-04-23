import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICONS: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle, error: AlertCircle, warning: AlertTriangle, info: Info,
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.2)", icon: "#4ADE80" },
  error: { bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.2)", icon: "#F87171" },
  warning: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)", icon: "#FBBF24" },
  info: { bg: "rgba(59,106,255,0.1)", border: "rgba(59,106,255,0.2)", icon: "#3B6AFF" },
};

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    const timer = setTimeout(() => remove(id), duration);
    timers.current.set(id, timer);
  }, [remove]);

  const success = useCallback((m: string) => toast(m, "success"), [toast]);
  const error = useCallback((m: string) => toast(m, "error", 6000), [toast]);
  const warning = useCallback((m: string) => toast(m, "warning"), [toast]);
  const info = useCallback((m: string) => toast(m, "info"), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-20 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          const colors = COLORS[t.type];
          return (
            <div key={t.id}
              className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg animate-in slide-in-from-right"
              style={{ background: colors.bg, border: `1px solid ${colors.border}`, backdropFilter: "blur(12px)" }}>
              <Icon size={16} style={{ color: colors.icon, flexShrink: 0, marginTop: 2 }} />
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.5 }}>{t.message}</p>
              </div>
              <button onClick={() => remove(t.id)} className="p-0.5 rounded hover:bg-white/10 transition-colors" style={{ color: "var(--text-muted)" }}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
