import { Data, Duration, Effect } from "effect";
import type { TikTokApiResponse } from "../types.ts";

export class FetchError extends Data.TaggedError("FetchError")<{
  message: string;
}> {}

export class TokenError extends Data.TaggedError("TokenError")<{
  message: string;
}> {}

export class ApiError extends Data.TaggedError("ApiError")<{
  message: string;
  code: number;
}> {}

export class TimeoutError extends Data.TaggedError("TimeoutError") {}

export class MpThreeService extends Effect.Service<MpThreeService>()("MpThreeService", {
  effect: Effect.gen(function* () {
    return {
      fetchMpThree: (body: string) =>
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
            catch: () => new FetchError({ message: "parse error" }),
          });

          if (data.message) yield* Effect.fail(new TokenError({ message: data.message }));
          if (data.code < 0) yield* Effect.fail(new ApiError({ message: data.msg, code: data.code }));

          return data;
        }).pipe(
          Effect.timeout(Duration.seconds(30)),
          Effect.catchTag("TimeoutError", () => Effect.fail(new TimeoutError())),
        ),
    };
  }),
}) {}
