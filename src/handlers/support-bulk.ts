import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { accountsFor, audit, checkInbox, chooseProxy, isSupport, userFor } from "../domain/inbox.js";

registerMainMenuItem({ label: "Support checks", data: "support:bulk", order: 50 });
const composer = new Composer<Ctx>();
composer.callbackQuery("support:bulk", async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = await userFor(String(ctx.from.id));
  if (!isSupport(user)) { await ctx.editMessageText("Support access is required for bulk checks.", { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) }); return; }
  const accounts = await accountsFor(String(ctx.from.id));
  if (accounts.length === 0) { await ctx.editMessageText("No linked accounts are available for a bulk check.", { reply_markup: inlineKeyboard([[inlineButton("Link an account", "auth:link")], [inlineButton("Back to menu", "menu:main")]]) }); return; }
  await audit("bulk_check_requested", "Support requested a bulk inbox check.");
  await ctx.editMessageText(`Ready to check ${accounts.length} linked account${accounts.length === 1 ? "" : "s"}. Each account is checked separately.`, { reply_markup: inlineKeyboard([[inlineButton("Run bulk check", "support:bulk:run")], [inlineButton("Back to menu", "menu:main")]]) });
});
composer.callbackQuery("support:bulk:run", async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = await userFor(String(ctx.from.id));
  if (!isSupport(user)) { await ctx.editMessageText("Support access is required for bulk checks."); return; }
  const linked = await accountsFor(user.telegramId);
  if (linked.length === 0) { await ctx.editMessageText("No linked accounts are available for a bulk check."); return; }
  await ctx.editMessageText("Running the bulk inbox check…");
  let complete = 0;
  let failed = 0;
  for (const account of linked) {
    try { await checkInbox(account, await chooseProxy()); complete += 1; }
    catch { failed += 1; }
  }
  await audit("bulk_check_completed", `Bulk check completed: ${complete} complete, ${failed} failed.`);
  await ctx.editMessageText(`Bulk check complete: ${complete} completed and ${failed} need attention.`, { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) });
});
export default composer;
