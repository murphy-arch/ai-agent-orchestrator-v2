import { useState } from "react";
import {
  Brain,
  Bot,
  Clock,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
  Zap,
  Users,
} from "lucide-react";

export interface WorkerResult {
  agentName: string;
  role?: string;
  task?: string;
  response: string;
  tokensUsed?: number;
  latencyMs?: number;
}

export interface OrchestrationTraceProps {
  plan?: string;
  workerResults: WorkerResult[];
  finalResponse?: string;
  totalTokens?: number;
  totalLatencyMs?: number;
  isLoading?: boolean;
  variant?: "compact" | "detailed";
}

function StepHeader({
  icon,
  title,
  subtitle,
  meta,
  isOpen,
  onToggle,
  colorClass,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  meta?: string;
  isOpen: boolean;
  onToggle?: () => void;
  colorClass: string;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
        onToggle ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colorClass}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{title}</span>
          {meta && (
            <span className="text-[10px] text-muted-foreground">{meta}</span>
          )}
        </div>
        {subtitle && (
          <div className="text-[10px] text-muted-foreground truncate">{subtitle}</div>
        )}
      </div>
      {onToggle && (
        <div className="text-muted-foreground">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      )}
    </button>
  );
}

export function OrchestrationTrace({
  plan,
  workerResults,
  finalResponse,
  totalTokens,
  totalLatencyMs,
  isLoading,
  variant = "detailed",
}: OrchestrationTraceProps) {
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set(["plan", "synthesis"]));

  const toggleStep = (key: string) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const compact = variant === "compact";

  return (
    <div className={`rounded-xl border bg-card shadow-sm ${compact ? "text-xs" : "text-sm"}`}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Users size={14} className="text-violet-600" />
        <span className="text-xs font-semibold">Orchestration Trace</span>
        {isLoading && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
        <div className="ml-auto flex items-center gap-2">
          {totalTokens !== undefined && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Zap size={10} /> {totalTokens.toLocaleString()} tokens
            </span>
          )}
          {totalLatencyMs !== undefined && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock size={10} /> {totalLatencyMs}ms
            </span>
          )}
        </div>
      </div>

      <div className="py-1">
        {/* Planning Step */}
        {plan && (
          <div className="px-2">
            <StepHeader
              icon={<Brain size={14} />}
              title="Planning"
              subtitle="Orchestrator analyzed and broke down the task"
              colorClass="bg-amber-100 text-amber-700"
              isOpen={openSteps.has("plan")}
              onToggle={() => toggleStep("plan")}
            />
            {openSteps.has("plan") && (
              <div className="ml-5 border-l-2 border-muted pl-5 pr-2 pb-2">
                <div className="rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed whitespace-pre-wrap">
                  {plan}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Worker Steps */}
        {workerResults.length > 0 && (
          <div className="px-2">
            <StepHeader
              icon={<Bot size={14} />}
              title={`Delegation (${workerResults.length} workers)`}
              subtitle={workerResults.map((w) => w.agentName).join(", ")}
              colorClass="bg-blue-100 text-blue-700"
              isOpen={openSteps.has("workers")}
              onToggle={() => toggleStep("workers")}
            />
            {openSteps.has("workers") && (
              <div className="ml-5 border-l-2 border-muted pl-5 pr-2 pb-2 space-y-2">
                {workerResults.map((worker, i) => (
                  <div key={i} className="rounded-lg border bg-background p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                        <Bot size={10} className="text-primary" />
                      </div>
                      <span className="text-xs font-semibold">{worker.agentName}</span>
                      {worker.role && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {worker.role}
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1.5">
                        {worker.tokensUsed !== undefined && (
                          <span className="text-[9px] text-muted-foreground">
                            {worker.tokensUsed.toLocaleString()} tok
                          </span>
                        )}
                        {worker.latencyMs !== undefined && (
                          <span className="text-[9px] text-muted-foreground">
                            {worker.latencyMs}ms
                          </span>
                        )}
                      </div>
                    </div>
                    {worker.task && (
                      <div className="mb-1.5 text-[10px] text-muted-foreground">
                        <span className="font-medium">Task:</span> {worker.task}
                      </div>
                    )}
                    <div className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
                      {worker.response}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Synthesis Step */}
        {finalResponse && (
          <div className="px-2">
            <StepHeader
              icon={<Sparkles size={14} />}
              title="Synthesis"
              subtitle="Orchestrator merged all outputs into final answer"
              colorClass="bg-green-100 text-green-700"
              isOpen={openSteps.has("synthesis")}
              onToggle={() => toggleStep("synthesis")}
            />
            {openSteps.has("synthesis") && (
              <div className="ml-5 border-l-2 border-muted pl-5 pr-2 pb-2">
                <div className="rounded-lg bg-green-50/50 border border-green-100 p-2.5 text-xs leading-relaxed whitespace-pre-wrap">
                  {finalResponse}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && workerResults.length === 0 && !plan && (
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={12} className="animate-spin" />
              <span>Orchestrator is planning...</span>
            </div>
            <div className="h-2 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-2 w-1/2 rounded bg-muted animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

export default OrchestrationTrace;
