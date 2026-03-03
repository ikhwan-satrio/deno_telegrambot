import { Bot, Context, webhookCallback } from "grammy/mod.ts";
import { Effect } from "effect";
import { MessageController } from "@/controller/message_controller.ts";
import { MpThreeController } from "@/controller/mpthree_controller.ts";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
const ENVIRONMENT = Deno.env.get("ENVIRONMENT") ?? "development";

const bot = new Bot(BOT_TOKEN);

const setCommandsEffect = Effect.sync(() => {
  bot.api.setMyCommands([
    { command: "start", description: "bot description" },
    { command: "mp3", description: "install mp3 from link" },
  ]);
});

const startHandler = (ctx: Context) =>
  Effect.promise(() =>
    ctx.reply(
      "hello🤖,\\ni am a telegram bot\\nmade by t.me/iwanSlebew to convert tiktok links to video/photos.\\n",
    )
  );

const mp3Handler = (ctx: Context) => Effect.sync(() => MpThreeController.main(ctx));
const messageHandler = (ctx: Context) => Effect.sync(() => MessageController.main(ctx));

bot.command("start", (c) => Effect.runPromise(startHandler(c)));
bot.command("mp3", (c) => Effect.runPromise(mp3Handler(c)));
bot.on("message:text", (c) => Effect.runPromise(messageHandler(c)));

const program = Effect.gen(function* () {
  yield* Effect.log("🤖 Setting bot commands...");
  yield* setCommandsEffect;

  // Selalu reset webhook dulu
  yield* Effect.promise(() => bot.api.deleteWebhook());

  if (ENVIRONMENT === "development") {
    yield* Effect.log("🤖 Bot running in development mode...");
    yield* Effect.promise(() => bot.start({ drop_pending_updates: true }));
  } else {
    const webhookUrl = `https://deno-telegrambot.deno.dev/`;
    yield* Effect.log("🤖 Bot running in webhook mode...");
    yield* Effect.promise(() => bot.api.setWebhook(webhookUrl));
    Deno.serve((req) => webhookCallback(bot, "std/http")(req));
  }
}).pipe(Effect.catchAll((e) => Effect.logError(`Bot error: ${e}`)));

Effect.runPromise(program);
