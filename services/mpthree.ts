import { Context, Data, Effect } from "effect";
import { TikTokApiResponse } from "../types.ts";

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

const MpThreeLive = Context.GenericTag("MpThree");

export const MpThreeService = MpThreeLive.of({
  fetchMpThree: Effect.fn(function* (body: string) {
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
  }),
});
