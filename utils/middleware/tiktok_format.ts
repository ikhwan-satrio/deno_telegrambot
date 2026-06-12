import { Context } from "grammy";

const tiktokRegex = /https?:\/\/(vt|vn|vm)\.tiktok\.com\/[a-zA-Z0-9]+/;

export async function tiktokFormatMiddleware(c: Context) {
  const text = c.message?.text ?? "";
  const hasUrl = text.split(" ").some((word) => tiktokRegex.test(word));

  if (!hasUrl) {
    await c.reply("Oops wrong format!");
    throw new Error("Invalid TikTok link");
  }
}
