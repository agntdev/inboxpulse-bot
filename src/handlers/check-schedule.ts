import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { accountsFor, schedule, userFor } from "../domain/inbox.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Schedule Check", data: "check:schedule" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Schedule checks", data: "check:schedule", order: 30 });
const composer = new Composer<Ctx>();

composer.callbackQuery("check:schedule", async (ctx) => {
  await ctx.answerCallbackQuery();
  const accounts = await accountsFor((await userFor(String(ctx.from.id))).telegramId);
  if (accounts.length === 0) { await ctx.editMessageText("No Outlook account is linked yet. Link one before scheduling checks.", { reply_markup: inlineKeyboard([[inlineButton("Link Outlook", "auth:link")], [inlineButton("Back to menu", "menu:main")]]) }); return; }
  const choices = accounts.map((account, index) => [inlineButton(`Schedule account ${index + 1}`, `schedule:account:${account.id}`)]);
  await ctx.editMessageText("Choose an account. Checks will run once per hour.", { reply_markup: inlineKeyboard([...choices, [inlineButton("Back to menu", "menu:main")]]) });
});
composer.on("callback_query:data", async (ctx, next) => { const data = ctx.callbackQuery.data; if (!data.startsWith("schedule:account:")) return next(); await ctx.answerCallbackQuery(); const accountId = data.slice("schedule:account:".length); const account = (await accountsFor(String(ctx.from.id))).find((candidate) => candidate.id === accountId); if (!account) { await ctx.editMessageText("That Outlook account is no longer available."); return; } await schedule(account.id); await ctx.editMessageText("Your inbox check is scheduled to run every hour.", { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) }); });

export default composer;
