import type { ICommand, CommandData } from './command.interface.js';
import type { RunContext } from '../context.js';

export abstract class BaseCommand implements ICommand {
  abstract execute(ctx: RunContext): Promise<void>;
  abstract toJSON(): CommandData;
}
