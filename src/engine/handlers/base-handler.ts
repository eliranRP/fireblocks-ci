import type { IHandler, HandlerContext } from './handler.interface.js';

export abstract class BaseHandler implements IHandler {
  private next: IHandler | null = null;

  setNext(handler: IHandler): IHandler {
    this.next = handler;
    return handler;
  }

  async handle(ctx: HandlerContext): Promise<void> {
    if (this.next) {
      await this.next.handle(ctx);
    }
  }
}
