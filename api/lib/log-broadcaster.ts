// SSE Log Broadcaster — streams agent logs to connected clients in real-time

interface LogEntry {
  id?: number;
  agentId: number;
  eventType: string;
  message: string;
  tokensUsed?: number;
  latency?: number;
  metadata?: string;
  createdAt?: Date | string;
}

interface Client {
  id: string;
  controller: ReadableStreamDefaultController<string>;
  agentId?: number; // optional filter
}

const clients = new Map<string, Client>();
let clientIdCounter = 0;

function generateId(): string {
  return `client-${++clientIdCounter}-${Date.now()}`;
}

export function addClient(controller: ReadableStreamDefaultController<string>, agentId?: number): string {
  const id = generateId();
  clients.set(id, { id, controller, agentId });
  return id;
}

export function removeClient(id: string): void {
  clients.delete(id);
}

export function broadcastLog(log: LogEntry): void {
  const data = JSON.stringify(log);
  const message = `data: ${data}\n\n`;

  for (const client of clients.values()) {
    // If client filters by agentId, only send matching logs
    if (client.agentId && client.agentId !== log.agentId) continue;

    try {
      client.controller.enqueue(message);
    } catch {
      // Client disconnected, remove silently
      clients.delete(client.id);
    }
  }
}

export function getConnectedClientCount(): number {
  return clients.size;
}
