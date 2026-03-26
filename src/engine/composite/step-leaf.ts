import { WorkflowNode } from './workflow-node.js';
import type { ICommand } from '../commands/command.interface.js';
import type { RunContext } from '../context.js';

export class StepLeaf extends WorkflowNode {
  private readonly command: ICommand;

  constructor(id: string, name: string, command: ICommand) {
    super(id, name, 'step');
    this.command = command;
  }

  async doWork(ctx: RunContext): Promise<void> {
    await this.command.execute(ctx);
  }
}
