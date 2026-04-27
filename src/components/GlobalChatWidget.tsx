import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageSquare,
  X,
  Send,
  ChevronDown,
  Loader2,
  Bot,
  User,
} from "lucide-react";
import { trpc } from "@/trpc";
import { OrchestrationTrace } from "./OrchestrationTrace";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  plan?: string;
  workerResults?: Array<{
    agentName: string;
    role?: string;
    task?: string;
    response: string;
    tokensUsed?: number;
    latencyMs?: number;
  }>;
  totalTokens?: number;
  totalLatencyMs?: number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getStoredMessages(stackId: number): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`global-chat:${stackId}`);
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch {
    /* ignore parse errors */
  }
  return [];
}

function storeMessages(stackId: number, messages: ChatMessage[]): void {
  localStorage.setItem(`global-chat:${stackId}`, JSON.stringify(messages));
}

export function GlobalChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStackId, setSelectedStackId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: stacks } = trpc.stack.list.useQuery();
  const chatMutation = trpc.execution.orchestratorChat.useMutation();

  // Auto-select first stack when stacks load
  useEffect(() => {
    if (stacks && stacks.length > 0 && selectedStackId === null) {
      setSelectedStackId(stacks[0].id);
    }
  }, [stacks, selectedStackId]);

  // Load messages when stack changes
  useEffect(() => {
    if (selectedStackId !== null) {
      setMessages(getStoredMessages(selectedStackId));
    }
  }, [selectedStackId]);

  // Persist messages
  useEffect(() => {
    if (selectedStackId !== null) {
      storeMessages(selectedStackId, messages);
    }
  }, [messages, selectedStackId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }, [messages, isOpen]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !selectedStackId) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    chatMutation.mutate(
      {
        stackId: selectedStackId,
        message: userMessage.content,
      },
      {
        onSuccess: (data) => {
          const assistantMessage: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: typeof data === "string" ? data : data.response ?? "No response",
            timestamp: Date.now(),
            plan: typeof data === "object" ? data.plan ?? undefined : undefined,
            workerResults: typeof data === "object" ? data.workerResults ?? undefined : undefined,
            totalTokens: typeof data === "object" ? data.tokensUsed ?? undefined : undefined,
            totalLatencyMs: typeof data === "object" ? data.latencyMs ?? undefined : undefined,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        },
        onError: (err) => {
          const errorMessage: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: `Error: ${err.message}`,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        },
      }
    );
  }, [input, selectedStackId, chatMutation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleOpen = () => setIsOpen((prev) => !prev);

  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label="Open chat"
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-[380px] flex-col rounded-xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur-md"
      style={{ height: 500 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-semibold text-gray-900">AI Orchestrator</span>
        </div>
        <button
          onClick={toggleOpen}
          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Stack Selector */}
      {stacks && stacks.length > 0 && (
        <div className="border-b border-gray-100 px-4 py-2">
          <div className="relative">
            <select
              value={selectedStackId ?? ""}
              onChange={(e) => setSelectedStackId(Number(e.target.value))}
              className="w-full appearance-none rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-3 pr-8 text-xs font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {stacks.map((s: { id: number; name: string }) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
            <Bot className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">Send a message to the orchestrator</p>
            <p className="mt-1 text-xs opacity-60">Cmd+Enter to send</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            <div
              className={`mb-3 flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                  msg.role === "user"
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="h-3 w-3" />
                ) : (
                  <Bot className="h-3 w-3" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "border border-gray-100 bg-gray-50 text-gray-800"
                }`}
              >
                {msg.content}
              </div>
            </div>
            {msg.role === "assistant" && msg.workerResults && msg.workerResults.length > 0 && (
              <div className="mb-3 ml-8 max-w-[90%]">
                <OrchestrationTrace
                  plan={msg.plan}
                  workerResults={msg.workerResults}
                  finalResponse={msg.content}
                  totalTokens={msg.totalTokens}
                  totalLatencyMs={msg.totalLatencyMs}
                  variant="compact"
                />
              </div>
            )}
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="mb-3 flex flex-row gap-2">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
              <Bot className="h-3 w-3" />
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                <span className="text-xs text-gray-400">Thinking...</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the orchestrator..."
            rows={1}
            className="max-h-[120px] flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending || !selectedStackId}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            {chatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-gray-300">Cmd+Enter to send</p>
      </div>
    </div>
  );
}
