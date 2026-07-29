import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard } from "../toolkit/index.js";
import { userFor } from "../domain/inbox.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

composer.command("start", async (ctx) => {
  const user = await userFor(String(ctx.from?.id ?? ctx.chat?.id));
  await ctx.reply(`Your ${user.tier} plan has ${user.quotaRemaining} inbox checks remaining. Link Outlook to get started.`, { reply_markup: mainMenuKeyboard() });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = await userFor(String(ctx.from.id));
  await ctx.editMessageText(`Your ${user.tier} plan has ${user.quotaRemaining} inbox checks remaining.`, { reply_markup: mainMenuKeyboard() });
});

export default composer;
