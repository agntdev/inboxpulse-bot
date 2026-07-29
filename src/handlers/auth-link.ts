import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { audit, userFor } from "../domain/inbox.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Link Account", data: "auth:link" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Link Outlook", data: "auth:link", order: 10 });
const composer = new Composer<Ctx>();

composer.callbackQuery("auth:link", async (ctx) => {
  await ctx.answerCallbackQuery();
  await userFor(String(ctx.from.id));
  await audit("oauth_requested", "A user requested a Microsoft connection.");
  await ctx.editMessageText("Microsoft connection isn’t set up yet. Ask the owner to configure the Microsoft OAuth application, then try again.", { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) });
});

export default composer;
