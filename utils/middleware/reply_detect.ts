import { Context } from "grammy";

export function replyMiddleware(c: Context) {
  if (c.message?.reply_to_message) {
    const repliedMessage = c.message?.reply_to_message;
    if (repliedMessage?.from?.id === c.me.id) {
      throw new Error("reply to bot detected");
    }
  }
}
