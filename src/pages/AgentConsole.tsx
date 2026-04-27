import { useState, useEffect, useRef } from "react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackContext";
import {
  Bot, User, Zap, Clock, AlertCircle, CheckCircle,
  Terminal, Sparkles, Trash2, Radio, Users, Crown,
  Copy, Check,
} from "lucide-react";
import LiveLogStream from "@/components/LiveLogStream";
import HelpTooltip from "@/components/HelpTooltip";
import { OrchestrationTrace } from "@/components/OrchestrationTrace";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
  agentName?: string;
  plan?: string;
  workerResults?: Array<{
    agentName: string;
    role?: string;
    task?: string;
    response: string;
    tokensUsed?: number;
    latencyMs?: number;
  }>;
}

export default function AgentConsole() {
  const { stackId } = useStack();
  const utils = trpc.useUtils();
  const { data: agents, isLoading } = trpc.agent.list.useQuery({ stackId });
  const { data: teams } = trpc.team.list.useQuery({ stackId });
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const firstAgentId = agents?.[0]?.id ?? null;
  const effectiveAgentId = selectedTeamId ? null : (selectedAgentId ?? firstAgentId);

  const { data: conversationHistory, isLoading: historyLoading } = trpc.execution.getConversations.useQuery(
    { stackId, agentId: effectiveAgentId },
    { enabled: !!effectiveAgentId && !selectedTeamId }
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [lastRaw, setLastRaw] = useState<string>("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const selectedAgent = agents?.find((a) => a.id === effectiveAgentId);
  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);

  const sendMessage = trpc.execution.sendMessage.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response, timestamp: Date.now(), agentName: data.agentName },
      ]);
      setLastRaw(JSON.stringify(data, null, 2));
      setIsSending(false);
      setError("");
      utils.execution.getConversations.invalidate({ stackId, agentId: effectiveAgentId });
    },
    onError: (err) => {
      setError(err.message);
      setIsSending(false);
    },
  });

  const teamChat = trpc.execution.teamChat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: Date.now(),
          agentName: selectedTeam?.name,
          plan: data.plan,
          workerResults: data.memberResults.map((m) => ({
            agentName: m.agentName,
            role: m.role,
            response: m.response,
            tokensUsed: m.tokensUsed,
            latencyMs: m.latencyMs,
          })),
        },
      ]);
      setLastRaw(JSON.stringify(data, null, 2));
      setIsSending(false);
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      setIsSending(false);
    },
  });

  // Load history from DB when agent changes
  useEffect(() => {
    if (selectedTeamId) {
      setMessages([]);
      return;
    }
    if (conversationHistory) {
      setMessages(
        conversationHistory.map((h) => ({
          role: h.role as "system" | "user" | "assistant",
          content: h.content,
          timestamp: new Date(h.createdAt).getTime(),
        }))
      );
    }
  }, [conversationHistory, effectiveAgentId, selectedTeamId]);

  // Auto-scroll to bottom
  useEffect(() => {
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }, [messages, isSending]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);
    setError("");

    if (selectedTeamId) {
      teamChat.mutate({ stackId, teamId: selectedTeamId, message: userMsg.content });
    } else if (effectiveAgentId) {
      sendMessage.mutate({ stackId, agentId: effectiveAgentId, message: userMsg.content });
    } else {
      setError("Select an agent or team first");
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (confirm("Clear conversation history?")) {
      setMessages([]);
    }
  };

  const isTeamMode = !!selectedTeamId;
  const activeName = selectedTeam?.name ?? selectedAgent?.name ?? "Select an agent or team";

  return (
    <div className="h-[calc(100vh-64px)] flex overflow-hidden rounded-lg border bg-card">
      {/* Selector Sidebar */}
      <div className="w-64 shrink-0 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold">Agent Console</h2>
            <HelpTooltip text="A testing ground where you can chat directly with individual agents or entire teams. All responses are saved to the Database." />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Test agents and teams</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {/* Teams Section */}
          {teams && teams.length > 0 && (
            <>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">Teams <HelpTooltip text="Multi-agent teams where an Orchestrator delegates tasks to Workers and synthesizes their responses." /></div>
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => { setSelectedTeamId(team.id); setSelectedAgentId(null); setMessages([]); setError(""); }}
                  className={`w-full text-left p-2.5 rounded-lg mb-1 transition-all border ${
                    selectedTeamId === team.id
                      ? "bg-violet-50 border-violet-300"
                      : "bg-transparent border-transparent hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users size={14} className={selectedTeamId === team.id ? "text-violet-600" : "text-muted-foreground"} />
                    <span className={`truncate text-xs ${selectedTeamId === team.id ? "font-semibold text-violet-900" : ""}`}>
                      {team.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 ml-5">
                    <Crown size={8} className="text-amber-500" />
                    <span className="text-[9px] text-muted-foreground">{team.memberCount} members</span>
                  </div>
                </button>
              ))}
              <div className="px-2 py-1 mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">Agents <HelpTooltip text="Individual AI agents you can chat with one-on-one. Select an agent to see its conversation history." /></div>
            </>
          )}

          {isLoading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Loading agents...</div>
          ) : !agents || agents.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              <Bot size={20} className="mx-auto mb-2 opacity-30" />
              <p>No agents created</p>
            </div>
          ) : (
            agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => { setSelectedAgentId(agent.id); setSelectedTeamId(null); setMessages([]); setError(""); }}
                className={`w-full text-left p-2.5 rounded-lg mb-1 transition-all border ${
                  effectiveAgentId === agent.id && !selectedTeamId
                    ? "bg-primary/10 border-primary/30"
                    : "bg-transparent border-transparent hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Bot size={14} className={effectiveAgentId === agent.id && !selectedTeamId ? "text-primary" : "text-muted-foreground"} />
                  <span className={`truncate text-xs ${effectiveAgentId === agent.id && !selectedTeamId ? "font-semibold" : ""}`}>
                    {agent.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 ml-5">
                  <span className="text-[9px] text-muted-foreground">{agent.modelName}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                    agent.isEnabled
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}>
                    {agent.isEnabled ? "active" : "disabled"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {selectedAgent || selectedTeam ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
              <div className="flex items-center gap-3">
                {isTeamMode ? <Users size={16} className="text-violet-600" /> : <Bot size={16} className="text-primary" />}
                <div>
                  <div className="text-sm font-semibold">{activeName}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {isTeamMode ? "Multi-agent team" : selectedAgent?.modelName}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle size={8} /> Ready
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClear}
                  className="px-2 py-1 rounded-md flex items-center gap-1 text-[10px] transition-all hover:bg-red-500/10 border"
                  disabled={messages.length === 0}
                >
                  <Trash2 size={10} /> Clear
                </button>
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className={`px-2 py-1 rounded-md flex items-center gap-1 text-[10px] transition-all border ${
                    showLogs ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  <Radio size={10} /> Logs
                </button>
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className={`px-2 py-1 rounded-md flex items-center gap-1 text-[10px] transition-all border ${
                    showDebug ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  <Terminal size={10} /> Debug
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {messages.length === 0 && !historyLoading && (
                <div className="text-center py-12">
                  <Sparkles size={24} className="mx-auto mb-3 text-primary opacity-30" />
                  <p className="text-sm text-muted-foreground">Start a conversation with {activeName}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {isTeamMode ? "The orchestrator will delegate to team members" : `Messages are sent through ${selectedAgent?.modelName}`}
                  </p>
                </div>
              )}

              {historyLoading && !selectedTeamId && (
                <div className="text-center py-12 text-sm text-muted-foreground">Loading history...</div>
              )}

              {messages.map((msg, i) => (
                <div key={i}>
                  <div className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role !== "user" && (
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isTeamMode ? "bg-violet-100" : "bg-primary/10"}`}>
                        {isTeamMode ? <Users size={14} className="text-violet-600" /> : <Bot size={14} className="text-primary" />}
                      </div>
                    )}
                    <div className="max-w-[80%]">
                      <div className={`p-3 rounded-xl text-sm ${
                        msg.role === "user"
                          ? "rounded-tr-sm bg-primary text-primary-foreground"
                          : "rounded-tl-sm bg-muted border"
                      }`}>
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                          <Clock size={8} /> {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                        {msg.agentName && (
                          <span className="text-[9px] text-muted-foreground">{msg.agentName}</span>
                        )}
                        {msg.role === "assistant" && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.content);
                              setCopiedIndex(i);
                              setTimeout(() => setCopiedIndex(null), 2000);
                            }}
                            className="ml-auto flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-primary transition-colors"
                            title="Copy response"
                          >
                            {copiedIndex === i ? <Check size={8} className="text-green-500" /> : <Copy size={8} />}
                            {copiedIndex === i ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-muted border">
                        <User size={14} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  {msg.role === "assistant" && msg.workerResults && msg.workerResults.length > 0 && (
                    <div className="mt-2 ml-10 max-w-[85%]">
                      <OrchestrationTrace
                        plan={msg.plan}
                        workerResults={msg.workerResults}
                        finalResponse={msg.content}
                        variant="compact"
                      />
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="flex gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isTeamMode ? "bg-violet-100" : "bg-primary/10"}`}>
                    {isTeamMode ? <Users size={14} className="text-violet-600" /> : <Bot size={14} className="text-primary" />}
                  </div>
                  <div className="p-3 rounded-xl rounded-tl-sm bg-muted border">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full animate-bounce bg-muted-foreground" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg flex items-start gap-2 bg-red-500/5 border border-red-500/20">
                  <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-500">{error}</div>
                </div>
              )}

            </div>

            {/* Debug Panel */}
            {showDebug && (
              <div className="h-40 border-t overflow-y-auto p-3 bg-muted/20">
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Raw Response</div>
                <pre className="text-[10px] text-muted-foreground font-mono">{lastRaw || "No response yet"}</pre>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t bg-muted/20">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${activeName}...`}
                  className="flex-1 px-3 py-2 rounded-lg outline-none resize-none bg-background border text-sm min-h-[40px] max-h-[120px]"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  className="px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110 disabled:opacity-30 bg-primary text-primary-foreground text-xs font-medium"
                >
                  <Zap size={14} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Bot size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Select an agent or team to start testing</p>
              <p className="text-[11px] text-muted-foreground mt-1">Each agent routes to its configured AI model</p>
            </div>
          </div>
        )}

        {/* Live Logs Panel */}
        {showLogs && (
          <div className="w-80 shrink-0 border-l">
            <LiveLogStream agentId={effectiveAgentId ?? undefined} onClose={() => setShowLogs(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
