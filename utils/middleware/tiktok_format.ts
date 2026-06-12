import { Context } from "grammy";

export async function tiktokFormatMiddleware(c: Context): Promise<void> {
  if (
    c.message?.text &&
    !RegExp("https?:\/\/(vt|vn|vm)\.tiktok\.com\/[a-zA-Z0-9]+").test(
      c.message.text.split(" ")[0],
    )
  ) {
    await c.reply("Oops wrong format!");
    throw new Error("Invalid TikTok link"); // Hentikan eksekusi
  }
}
