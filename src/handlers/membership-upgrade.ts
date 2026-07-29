import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { audit, notifyAdmin, userFor } from "../domain/inbox.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Upgrade Tier", data: "membership:upgrade" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Upgrade plan", data: "membership:upgrade", order: 40 });
const composer = new Composer<Ctx>();

composer.callbackQuery("membership:upgrade", async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = await userFor(String(ctx.from.id));
  await ctx.editMessageText(`You’re on the ${user.tier} plan with ${user.quotaRemaining} checks remaining. Choose a plan to request an upgrade.`, { reply_markup: inlineKeyboard([[inlineButton("Basic", "membership:select:basic"), inlineButton("Pro", "membership:select:pro")], [inlineButton("Back to menu", "menu:main")]]) });
});
composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("membership:select:")) return next();
  await ctx.answerCallbackQuery();
  const tier = data.slice("membership:select:".length);
  if (tier !== "basic" && tier !== "pro") { await ctx.editMessageText("That plan isn’t available. Choose Basic or Pro."); return; }
  await audit("tier_requested", `A ${tier} plan upgrade was requested.`);
  await notifyAdmin(ctx.api, `InboxPulse: a ${tier} plan upgrade needs payment confirmation.`);
  await ctx.editMessageText(`Your ${tier} upgrade request is awaiting payment confirmation. We’ll update your plan after payment is confirmed.`, { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) });
});

export default composer;
