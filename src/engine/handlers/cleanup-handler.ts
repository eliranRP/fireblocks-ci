import { BaseHandler } from './base-handler.js';
import type { HandlerContext } from './handler.interface.js';

export class CleanupHandler extends BaseHandler {
  // Runs last — cleans up temp directories, kills containers, etc.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handle(_ctx: HandlerContext): Promise<void> {
    // No-op in this iteration — cleanup logic added per deployment env
  }
}
