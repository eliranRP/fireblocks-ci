import { BaseHandler } from './base-handler.js';
import type { HandlerContext } from './handler.interface.js';

export class CleanupHandler extends BaseHandler {
  // Runs last in the chain. Cleanup logic (temp dirs, containers) added per deployment env.
  // Always delegates to super so future handlers appended after this one still execute.
  async handle(ctx: HandlerContext): Promise<void> {
    await super.handle(ctx);
  }
}
