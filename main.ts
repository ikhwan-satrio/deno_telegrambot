import { Bot, Context, webhookCallback } from "grammy/mod.ts";
import { Effect } from "effect";
import { MessageController } from "@/controller/message_controller.ts";
import { MpThreeController } from "@/controller/mpthree_controller.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
const ENVIRONMENT = Deno.env.get("ENVIRONMENT") ?? "development";

const bot = new Bot(BOT_TOKEN);

// ── Handlers ──────────────────────────────────────────────────────────────────

const startHandler = (ctx: Context) =>
  Effect.promise(() =>
    ctx.reply(
      "hello🤖,\ni am a telegram bot\nmade by t.me/iwanSlebew to convert tiktok links to video/photos.\n",
    )
  );

const mp3Handler = (ctx: Context) => Effect.promise(() => Promise.resolve(MpThreeController.main(ctx)));

const messageHandler = (ctx: Context) => Effect.promise(() => Promise.resolve(MessageController.main(ctx)));

bot.command("start", (c) => Effect.runPromise(startHandler(c)));
bot.command("mp3", (c) => Effect.runPromise(mp3Handler(c)));
bot.on("message:text", (c) => Effect.runPromise(messageHandler(c)));

// ── Program ───────────────────────────────────────────────────────────────────

const program = Effect.gen(function* () {
  yield* Effect.log("🤖 Setting bot commands...");
  yield* Effect.promise(() =>
    bot.api.setMyCommands([
      { command: "start", description: "bot description" },
      { command: "mp3", description: "install mp3 from link" },
    ])
  );

  yield* Effect.promise(() => bot.api.deleteWebhook({ drop_pending_updates: true }));

  if (ENVIRONMENT === "development") {
    yield* Effect.log("🤖 Bot running in development mode...");

    // Graceful shutdown
    Deno.addSignalListener("SIGINT", async () => {
      await bot.stop();
      Deno.exit(0);
    });

    yield* Effect.promise(() => bot.start({ drop_pending_updates: true }));
  } else {
    const webhookUrl = "https://deno-telegrambot.deno.dev/";
    yield* Effect.log(`🤖 Bot running in webhook mode: ${webhookUrl}`);
    yield* Effect.promise(() => bot.api.setWebhook(webhookUrl));
    yield* Effect.sync(() => Deno.serve((req) => webhookCallback(bot, "std/http")(req)));
  }
}).pipe(
  Effect.catchAll((e) => Effect.logError(`Bot error: ${e}`)),
);

Effect.runPromise(program);
