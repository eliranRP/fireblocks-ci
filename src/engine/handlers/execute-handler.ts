import { mkdirSync } from 'node:fs';
import { BaseHandler } from './base-handler.js';
import type { HandlerContext } from './handler.interface.js';

export class ExecuteHandler extends BaseHandler {
  async handle(ctx: HandlerContext): Promise<void> {
    mkdirSync(ctx.workDir, { recursive: true });
    await ctx.tree.run(ctx);
    await super.handle(ctx);
  }
}
