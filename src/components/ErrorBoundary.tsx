import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}>
              <AlertTriangle size={24} style={{ color: "#F87171" }} />
            </div>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "16px" }}>
              An unexpected error occurred. Your data is safe — try refreshing the page.
            </p>
            {this.state.error && (
              <div className="p-3 rounded-lg mb-4 text-left font-mono-ui" style={{ background: "var(--surface-secondary)", border: "1px solid var(--border)", fontSize: "11px", color: "var(--text-muted)" }}>
                {this.state.error.message}
              </div>
            )}
            <button onClick={this.handleReset}
              className="px-4 py-2.5 rounded-lg inline-flex items-center gap-2 transition-all hover:brightness-110"
              style={{ background: "var(--accent)", color: "#fff", fontSize: "13px", fontWeight: 500 }}>
              <RefreshCw size={14} /> Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
