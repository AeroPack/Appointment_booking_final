import { MessagesService } from './messages.service.js';
import { MessagesRepository } from './messages.repository.js';

export class MessageWorker {
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly service: MessagesService;

  constructor(service: MessagesService) {
    this.service = service;
  }

  start(intervalMs: number = 5000): void {
    if (this.interval) return;
    this.processOnce();
    this.interval = setInterval(() => this.processOnce(), intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async processOnce(): Promise<number> {
    try {
      return await this.service.processPending(10);
    } catch (err) {
      console.error('[MessageWorker] Error:', err);
      return 0;
    }
  }
}
