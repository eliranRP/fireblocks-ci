import type { RunContext } from '../context.js';
import type { WorkflowComposite } from '../composite/workflow-composite.js';

export interface HandlerContext extends RunContext {
  tree: WorkflowComposite;
}

export interface IHandler {
  setNext(handler: IHandler): IHandler;
  handle(ctx: HandlerContext): Promise<void>;
}
