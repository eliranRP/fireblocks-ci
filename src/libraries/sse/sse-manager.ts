import type { Response } from 'express';

type SseClients = Map<string, Set<Response>>;

class SseManager {
  private readonly clients: SseClients = new Map();

  addClient(runId: string, res: Response): void {
    if (!this.clients.has(runId)) {
      this.clients.set(runId, new Set());
    }
    this.clients.get(runId)!.add(res);
  }

  removeClient(runId: string, res: Response): void {
    const set = this.clients.get(runId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) this.clients.delete(runId);
  }

  broadcast(runId: string, event: string, data: unknown): void {
    const set = this.clients.get(runId);
    if (!set) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of set) {
      res.write(payload);
    }
  }
}

export const sseManager = new SseManager();
