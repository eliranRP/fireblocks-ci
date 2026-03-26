import { BaseHandler } from './base-handler.js';
import type { HandlerContext } from './handler.interface.js';

export class CheckoutHandler extends BaseHandler {
  // Stub — git checkout would happen here in a full implementation
  async handle(ctx: HandlerContext): Promise<void> {
    await super.handle(ctx);
  }
}
