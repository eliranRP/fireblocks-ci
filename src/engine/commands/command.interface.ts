import type { RunContext } from '../context.js';

export interface CommandData {
  type: string;
  [key: string]: unknown;
}

export interface ICommand {
  execute(ctx: RunContext): Promise<void>;
  toJSON(): CommandData;
}
