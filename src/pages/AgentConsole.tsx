import { useState, useEffect, useRef } from "react";
import { trpc } from "@/trpc";
import { useStack } from "@/components/layout/StackLayout";
import {
  Bot, User, Zap, Clock, AlertCircle, CheckCircle,
  Terminal, Sparkles, Trash2, Radio,
} from "lucide-react";
import LiveLogStream from "@/components/LiveLogStream";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

export default function AgentConsole() {
  const { stackId } = useStack();
  const utils = trpc.useUtils();
  const { data: agents, isLoading } = trpc.agent.list.useQuery({ stackId });
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  const firstAgentId = agents?.[0]?.id ?? null;
  const effectiveAgentId = selectedAgentId ?? firstAgentId;

  const { data: conversationHistory, isLoading: historyLoading } = trpc.execution.getConversations.useQuery(
    { stackId, agentId: effectiveAgentId },
    { enabled: !!effectiveAgentId }
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [lastRaw, setLastRaw] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedAgent = agents?.find((a) => a.id === effectiveAgentId);

  const sendMessage = trpc.execution.sendMessage.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response, timestamp: Date.now() },
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

  // Load history from DB when agent changes
  useEffect(() => {
    if (conversationHistory) {
      setMessages(
        conversationHistory.map((h) => ({
          role: h.role as "system" | "user" | "assistant",
          content: h.content,
          timestamp: new Date(h.createdAt).getTime(),
        }))
      );
    }
  }, [conversationHistory, effectiveAgentId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSend = () => {
    if (!input.trim() || !effectiveAgentId || isSending) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);
    setError("");
    sendMessage.mutate({ stackId, agentId: effectiveAgentId, message: userMsg.content });
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

  return (
    <div className="h-[calc(100vh-64px)] flex overflow-hidden rounded-lg border bg-card">
      {/* Agent Selector Sidebar */}
      <div className="w-64 shrink-0 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold">Agent Console</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Test and interact with your agents</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
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
                onClick={() => { setSelectedAgentId(agent.id); setMessages([]); setError(""); }}
                className={`w-full text-left p-2.5 rounded-lg mb-1 transition-all border ${
                  effectiveAgentId === agent.id
                    ? "bg-primary/10 border-primary/30"
                    : "bg-transparent border-transparent hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Bot size={14} className={effectiveAgentId === agent.id ? "text-primary" : "text-muted-foreground"} />
                  <span className={`truncate text-xs ${effectiveAgentId === agent.id ? "font-semibold" : ""}`}>
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
        {selectedAgent ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
              <div className="flex items-center gap-3">
                <Bot size={16} className="text-primary" />
                <div>
                  <div className="text-sm font-semibold">{selectedAgent.name}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{selectedAgent.modelName}</span>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {selectedAgent.systemPrompt && messages.length === 0 && (
                <div className="p-3 rounded-lg bg-muted border">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">System Prompt</div>
                  <div className="text-[11px] text-muted-foreground italic">{selectedAgent.systemPrompt}</div>
                </div>
              )}

              {messages.length === 0 && !historyLoading && (
                <div className="text-center py-12">
                  <Sparkles size={24} className="mx-auto mb-3 text-primary opacity-30" />
                  <p className="text-sm text-muted-foreground">Start a conversation with {selectedAgent.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Messages are sent through {selectedAgent.modelName}</p>
                </div>
              )}

              {historyLoading && (
                <div className="text-center py-12 text-sm text-muted-foreground">Loading history...</div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role !== "user" && (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
                      <Bot size={14} className="text-primary" />
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
                    </div>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-muted border">
                      <User size={14} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
                    <Bot size={14} className="text-primary" />
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

              <div ref={messagesEndRef} />
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
                  placeholder={`Message ${selectedAgent.name}...`}
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
              <p className="text-sm text-muted-foreground">Select an agent to start testing</p>
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
