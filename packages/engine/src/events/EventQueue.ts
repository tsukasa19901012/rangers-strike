import type { GameEvent } from "./types";

/**
 * FIFO イベントキュー。同一 Action 内で Handler が投入した事実を順に解決する。
 */
export class EventQueue {
  private readonly items: GameEvent[] = [];

  enqueue(event: GameEvent): void;
  enqueue(events: GameEvent[]): void;
  enqueue(eventOrEvents: GameEvent | GameEvent[]): void {
    if (Array.isArray(eventOrEvents)) {
      this.items.push(...eventOrEvents);
      return;
    }
    this.items.push(eventOrEvents);
  }

  dequeue(): GameEvent | undefined {
    return this.items.shift();
  }

  peek(): GameEvent | undefined {
    return this.items[0];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }

  /** 残りイベントを取り出してキューを空にする。 */
  drain(): GameEvent[] {
    const drained = [...this.items];
    this.items.length = 0;
    return drained;
  }

  clone(): EventQueue {
    const copy = new EventQueue();
    copy.items.push(...this.items);
    return copy;
  }

  toArray(): readonly GameEvent[] {
    return [...this.items];
  }
}
