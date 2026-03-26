import { eventBus } from '../libraries/events/event-bus.js';
import { ValidateHandler } from './handlers/validate-handler.js';
import { CheckoutHandler } from './handlers/checkout-handler.js';
import { InstallHandler } from './handlers/install-handler.js';
import { ExecuteHandler } from './handlers/execute-handler.js';
import { CleanupHandler } from './handlers/cleanup-handler.js';
import type { IHandler } from './handlers/handler.interface.js';
import type { WorkflowComposite } from './composite/workflow-composite.js';
import type { RunContext } from './context.js';
import type { HandlerContext } from './handlers/handler.interface.js';
import { logger } from '../libraries/logger/index.js';

// Build a fresh chain per run so handlers can safely hold per-run state
// without risk of corruption under concurrent executions.
function buildChain(): IHandler {
  const validate = new ValidateHandler();
  validate
    .setNext(new CheckoutHandler())
    .setNext(new InstallHandler())
    .setNext(new ExecuteHandler())
    .setNext(new CleanupHandler());
  return validate;
}

export async function runWorkflow(tree: WorkflowComposite, ctx: RunContext): Promise<void> {
  const handlerCtx: HandlerContext = { ...ctx, tree };

  eventBus.emit('run:start', { runId: ctx.runId, workflowId: ctx.workflowId });

  try {
    await buildChain().handle(handlerCtx);

    const finalStatus = handlerCtx.status === 'failed' ? 'failed' : 'success';
    eventBus.emit('run:complete', { runId: ctx.runId, status: finalStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, runId: ctx.runId }, 'Run failed');
    eventBus.emit('run:complete', { runId: ctx.runId, status: 'failed', error: message });
  }
}
