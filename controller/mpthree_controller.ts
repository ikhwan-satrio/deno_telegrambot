import { composeHandler } from "@/utils/decorators/defineMethod.ts";
import { Context } from "grammy/mod.ts";
import type { TikTokApiResponse } from "@/types.ts";
import { Data, Duration, Effect, Layer } from "effect";
import { MpThreeService } from "../services/mpthree.ts";

class FetchError extends Data.TaggedError("FetchError")<{
  message: string;
}> {}

class TokenError extends Data.TaggedError("TokenError")<{
  message: string;
}> {}

class ApiError extends Data.TaggedError("ApiError")<{
  message: string;
  code: number;
}> {}

class TimeoutError extends Data.TaggedError("TimeoutError") {}

export class MpThreeController {
  static deleteWaiting = (c: Context, messageId: number) =>
    Effect.tryPromise({
      try: () => c.api.deleteMessage(c.chatId as number, messageId),
      catch: (e) => new FetchError({ message: `delete failed: ${e}` }),
    }).pipe(Effect.ignore);

  static fetchMpThree = (body: string) =>
    Effect.gen(function* () {
      const res = yield* Effect.tryPromise({
        try: () =>
          fetch(
            `https://tiktok-download-without-watermark.p.rapidapi.com/analysis?url=${body}&hd=0`,
            {
              headers: {
                "x-rapidapi-key": Deno.env.get("RAPIDAPI_KEY") as string,
                "x-rapidapi-host": "tiktok-download-without-watermark.p.rapidapi.com",
              },
            },
          ),
        catch: (e) =>
          e instanceof DOMException && e.name === "AbortError"
            ? new TimeoutError()
            : new FetchError({ message: String(e) }),
      });

      if (!res.ok) yield* Effect.fail(new FetchError({ message: `status ${res.status}` }));

      const data = yield* Effect.tryPromise({
        try: () => res.json() as Promise<TikTokApiResponse>,
        catch: () => new FetchError({ message: `parse error` }),
      });

      if (data.message) {
        yield* Effect.fail(new TokenError({ message: data.message }));
      }

      if (data.code < 0) {
        yield* Effect.fail(new ApiError({ message: data.msg, code: data.code }));
      }

      return data;
    }).pipe(
      Effect.timeout(Duration.seconds(30)),
      Effect.catchTag("TimeoutError", () => Effect.fail(new TimeoutError())),
    );

  static main = composeHandler([], async (c: Context): Promise<void> => {
    const waiting = await c.reply("wait longitude...");
    const body = c.message?.text?.split(" ").slice(1).join(" "); // Join the remaining parts to form the complete URL

    const program = Effect.gen(function* () {
      const data = yield MpThreeService;

      if (data.data.music) {
        yield* Effect.promise(() =>
          c.api.sendAudio(c.chatId as number, data.data.music, {
            caption: `${body}\n\n@TiktokConverterWanto\nCompleted! ✅`,
            title: "TikTok Audio", // opsional
            performer: "TikTok", // opsional
          })
        );
        if (waiting.message_id) {
          yield* Effect.promise(() => c.api.deleteMessage(c.chatId as number, waiting.message_id));
        }
      }
    }).pipe(
      Effect.catchTag(
        "TokenError",
        () => Effect.promise(() => c.reply("Oops maaf token untuk convert video telah habis")),
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
        () => Effect.promise(() => c.reply("An error occurred while processing your request.")),
      ),
      Effect.ensuring(MpThreeController.deleteWaiting(c, waiting.message_id)),
    );

    await Effect.runPromise(program);
  });
}
