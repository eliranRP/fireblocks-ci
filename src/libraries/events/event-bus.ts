import { EventEmitter } from 'node:events';
import type { BusEvents } from './event-bus.types.js';

// Typed wrapper around EventEmitter to enforce event payload shapes
class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof BusEvents>(event: K, ...args: BusEvents[K]): boolean {
    return super.emit(event as string, ...args);
  }

  on<K extends keyof BusEvents>(event: K, listener: (...args: BusEvents[K]) => void): this {
    return super.on(event as string, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof BusEvents>(event: K, listener: (...args: BusEvents[K]) => void): this {
    return super.off(event as string, listener as (...args: unknown[]) => void);
  }
}

export const eventBus = new TypedEventEmitter();
