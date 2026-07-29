import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { accountsFor, audit, checkInbox, chooseProxy, notifyAdmin, userFor, saveUser } from "../domain/inbox.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Run Check Now", data: "check:run" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Run check now", data: "check:run", order: 20 });
const composer = new Composer<Ctx>();

composer.callbackQuery("check:run", async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = await userFor(String(ctx.from.id));
  if (user.quotaRemaining <= 0) { await ctx.editMessageText("You’ve used today’s inbox checks. Upgrade your plan to continue.", { reply_markup: inlineKeyboard([[inlineButton("Upgrade plan", "membership:upgrade")], [inlineButton("Back to menu", "menu:main")]]) }); return; }
  const accounts = await accountsFor(user.telegramId);
  if (accounts.length === 0) { await ctx.editMessageText("No Outlook account is linked yet. Link one before running a check.", { reply_markup: inlineKeyboard([[inlineButton("Link Outlook", "auth:link")], [inlineButton("Back to menu", "menu:main")]]) }); return; }
  const buttons = accounts.map((account, index) => [inlineButton(`Check account ${index + 1}`, `check:account:${account.id}`)]);
  await ctx.editMessageText("Choose the Outlook account to check.", { reply_markup: inlineKeyboard([...buttons, [inlineButton("Back to menu", "menu:main")]]) });
});
composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("check:account:")) return next();
  await ctx.answerCallbackQuery();
  const accountId = data.slice("check:account:".length);
  const accounts = await accountsFor(String(ctx.from.id));
  const account = accounts.find((candidate) => candidate.id === accountId);
  if (!account) { await ctx.editMessageText("That Outlook account is no longer available. Link it again and retry.", { reply_markup: inlineKeyboard([[inlineButton("Link Outlook", "auth:link")]]) }); return; }
  const user = await userFor(String(ctx.from.id));
  if (user.quotaRemaining <= 0) { await ctx.editMessageText("You’ve used today’s inbox checks. Upgrade your plan to continue."); return; }
  await ctx.editMessageText("Checking your inbox now…");
  try {
    const proxy = await chooseProxy();
    const job = await checkInbox(account, proxy);
    user.quotaRemaining -= 1;
    await saveUser(user);
    await ctx.editMessageText(`Inbox check complete: ${job.resultSummary} You have ${user.quotaRemaining} checks remaining.`, { reply_markup: inlineKeyboard([[inlineButton("Run another check", "check:run")], [inlineButton("Back to menu", "menu:main")]]) });
  } catch {
    await audit("check_error", "An inbox check could not be completed.");
    await notifyAdmin(ctx.api, "InboxPulse: an inbox check failed and needs review.");
    await ctx.editMessageText("Couldn’t check this inbox. Reconnect Outlook and try again.", { reply_markup: inlineKeyboard([[inlineButton("Link Outlook", "auth:link")], [inlineButton("Back to menu", "menu:main")]]) });
  }
});

export default composer;
