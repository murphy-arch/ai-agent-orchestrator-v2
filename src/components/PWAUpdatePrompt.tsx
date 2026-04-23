import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export default function PWAUpdatePrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // vite-plugin-pwa injects a custom event for updates
    const handler = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = (e as any).detail;
      if (detail?.serviceWorker) {
        setShow(true);
      }
    };

    window.addEventListener("pwa-update-available" as never, handler);

    // Also check for the standard vite-plugin-pwa reload prompt
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        setShow(true);
      });
    }

    return () => {
      window.removeEventListener("pwa-update-available" as never, handler);
    };
  }, []);

  const update = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.update().then(() => {
          window.location.reload();
        });
      });
    } else {
      window.location.reload();
    }
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl"
      style={{
        background: "var(--surface-primary)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>
        Update available
      </span>
      <button
        onClick={update}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
        style={{
          background: "var(--accent-muted)",
          color: "var(--accent)",
          border: "1px solid var(--accent)",
          fontSize: "12px",
        }}
      >
        <RefreshCw size={12} /> Reload
      </button>
      <button
        onClick={() => setShow(false)}
        className="p-1 rounded-lg hover:bg-white/5 transition-colors"
        style={{ color: "var(--text-muted)" }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
