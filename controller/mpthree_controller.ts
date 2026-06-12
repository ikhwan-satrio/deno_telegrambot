import { composeHandler } from "@/utils/decorators/defineMethod.ts";
import { Context } from "grammy";
import { Effect } from "effect";
import { FetchError, MpThreeService } from "../services/mpthree.ts";

const tiktokRegex = /https?:\/\/(vm|vt)\.tiktok\.com\/[^\s]*/;

export class MpThreeController {
  static deleteWaiting = (c: Context, messageId: number) =>
    Effect.tryPromise({
      try: () => c.api.deleteMessage(c.chatId as number, messageId),
      catch: (e) => new FetchError({ message: `delete failed: ${e}` }),
    }).pipe(Effect.ignore);

  static main = composeHandler([], async (c: Context): Promise<void> => {
    const waiting = await c.reply("wait longitude...");

    const text = c.message?.text ?? "";
    const url = text.split(" ").find((b) => tiktokRegex.test(b));

    if (!url) {
      await c.reply("Kirim link TikTok yang valid (vm.tiktok.com atau vt.tiktok.com)");
      await c.api.deleteMessage(c.chatId as number, waiting.message_id);
      return;
    }

    const program = Effect.gen(function* () {
      const service = yield* MpThreeService; // inject service
      const data = yield* service.fetchMpThree(url); // pakai method

      if (data.data.music) {
        yield* Effect.promise(() =>
          c.api.sendAudio(c.chatId as number, data.data.music, {
            caption: `${url}\n\n@TiktokConverterWanto\nCompleted! ✅`,
            title: "TikTok Audio",
            performer: "TikTok",
          })
        );
      }
    }).pipe(
      Effect.catchTag(
        "TokenError",
        () => Effect.promise(() => c.reply("Oops maaf token untuk convert video telah habis")),
      ),
      Effect.catchTag(
        "TimeoutError",
        () => Effect.promise(() => c.reply("Request timeout. The TikTok API is taking too long to respond.")),
      ),
      Effect.catchTag(
        "FetchError",
        () => Effect.promise(() => c.reply("An error occurred while processing your request.")),
      ),
      Effect.catchTag("ApiError", (e) => Effect.promise(() => c.reply(`API Error ${e.code}: ${e.message}`))),
      Effect.ensuring(MpThreeController.deleteWaiting(c, waiting.message_id)),
      Effect.provide(MpThreeService.Default), // provide layer
    );

    await Effect.runPromise(program);
  });
}
