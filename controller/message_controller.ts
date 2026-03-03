import { composeHandler } from "@/utils/decorators/defineMethod.ts";
import { tiktokFormatMiddleware } from "@/utils/middleware/tiktok_format.ts";

import type { Context } from "grammy/mod.ts";
import { InputMediaBuilder } from "grammy/mod.ts";
import { TikTokApiResponse } from "@/types.ts";
import { Data, Duration, Effect } from "effect";

class FetchError extends Data.TaggedError("FetchError")<{
  message: string;
}> {}

class TokenError extends Data.TaggedError("TokenError")<{
  message: string;
}> {}

class TimeoutError extends Data.TaggedError("TimeoutError") {}

export class MessageController {
  static deleteWaiting = (c: Context, messageId: number) =>
    Effect.tryPromise({
      try: () => c.api.deleteMessage(c.chatId as number, messageId),
      catch: (e) => new FetchError({ message: `delete failed: ${e}` }),
    }).pipe(Effect.ignore);

  static fetchTiktok = (body: string) =>
    Effect.gen(function* () {
      const res = yield* Effect.tryPromise({
        try: () =>
          fetch(
            `https://tiktok-download-without-watermark.p.rapidapi.com/analysis?url=${body}&hd=0`,
            {
              headers: {
                "x-rapidapi-key": Deno.env.get("RAPIDAPI_KEY") as string,
                "x-rapidapi-host":
                  "tiktok-download-without-watermark.p.rapidapi.com",
              },
            },
          ),
        catch: (e) =>
          e instanceof DOMException && e.name === "AbortError"
            ? new TimeoutError()
            : new FetchError({ message: String(e) }),
      });

      if (!res.ok) {
        yield* Effect.fail(
          new FetchError({ message: `error status ${res.status}` }),
        );
      }

      const data = yield* Effect.tryPromise({
        try: () => res.json() as Promise<TikTokApiResponse>,
        catch: (e) => new FetchError({ message: `parse error: ${e}` }),
      });

      if (data.message) {
        yield* Effect.fail(new TokenError({ message: data.message }));
      }

      return data;
    }).pipe(
      Effect.timeout(Duration.seconds(30)),
      Effect.catchTag("TimeoutError", () => Effect.fail(new TimeoutError())),
    );

  static main = composeHandler(
    [tiktokFormatMiddleware],
    async (c: Context): Promise<void> => {
      const waiting = await c.reply("wait longitude...");
      const body = c.message?.text?.split(" ")[0];

      const program = Effect.gen(function* () {
        const data = yield* MessageController.fetchTiktok(body!);

        if (data.data?.images) {
          const imageMap = data.data.images.map((image: string) =>
            InputMediaBuilder.photo(image)
          );
          yield* Effect.promise(() => c.replyWithMediaGroup(imageMap));
          yield* Effect.promise(() =>
            c.reply(`${body}\n\n@TiktokConverterWanto\nCompleted! ✅`)
          );
          return;
        }

        if ((data.data.play as string).includes("mp4")) {
          yield* Effect.promise(() =>
            c.api.sendVideo(c.chatId as number, data.data.play, {
              caption: `${body}\n\n@TiktokConverterWanto\nCompleted! ✅`,
            })
          );
        }
      }).pipe(
        Effect.catchTag(
          "TokenError",
          () =>
            Effect.promise(() =>
              c.reply("Oops maaf token untuk convert video telah habis")
            ),
        ),
        Effect.catchTag(
          "TimeoutError",
          () =>
            Effect.promise(() =>
              c.reply(
                "Request timeout. The TikTok API is taking too long to respond.",
              )
            ),
        ),
        Effect.catchTag(
          "FetchError",
          () =>
            Effect.promise(() =>
              c.reply("An error occurred while processing your request.")
            ),
        ),
        // Selalu hapus waiting message
        Effect.ensuring(MessageController.deleteWaiting(c, waiting.message_id)),
      );

      await Effect.runPromise(program)
    },
  );
}
