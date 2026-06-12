import type { Context } from "grammy";

export type Middleware = (ctx: Context) => void | Promise<void>;
export type Handler = (ctx: Context) => void | Promise<void>;

/**
 * Compose middlewares dengan handler
 * Pattern ini mirip dengan Express.js/Koa.js middleware
 */
export function composeHandler(
  middlewares: Middleware[],
  handler: Handler,
): Handler {
  return async (ctx: Context) => {
    try {
      // Jalankan semua middleware secara sequential
      for (const middleware of middlewares) {
        await middleware(ctx);
      }

      // Jika semua middleware pass, jalankan handler utama
      await handler(ctx);
    } catch (error) {
      console.error(
        `Middleware blocked execution: ${(error as Error).message}`,
      );
    }
  };
}

export function createMiddleware(
  fn: (ctx: Context) => void | Promise<void> | boolean | Promise<boolean>,
): Middleware {
  return async (ctx: Context) => {
    const result = await fn(ctx);
    if (result === false) {
      throw new Error("Middleware blocked execution");
    }
  };
}
