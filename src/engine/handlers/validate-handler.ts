import { BaseHandler } from './base-handler.js';
import type { HandlerContext } from './handler.interface.js';
import { ValidationError } from '../../libraries/error-handler/errors.js';

export class ValidateHandler extends BaseHandler {
  async handle(ctx: HandlerContext): Promise<void> {
    if (!ctx.tree) {
      throw new ValidationError('Workflow tree is missing');
    }
    if (!ctx.workflowId) {
      throw new ValidationError('Workflow ID is required');
    }
    await super.handle(ctx);
  }
}
