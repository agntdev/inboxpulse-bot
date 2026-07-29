import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { audit, createProxy, isAdmin, knownUsers, proxies, recentAudit, removeProxy, saveUser, userFor } from "../domain/inbox.js";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.
// Menu: wire this into /start via registerMainMenuItem({ label: "Admin Panel", data: "admin:panel" }) if the toolkit exposes it.

registerMainMenuItem({ label: "Admin panel", data: "admin:panel", order: 60 });
const composer = new Composer<Ctx>();

function panel() { return inlineKeyboard([[inlineButton("Manage members", "admin:users")], [inlineButton("Manage proxies", "admin:proxies")], [inlineButton("View audit log", "admin:logs")], [inlineButton("Back to menu", "menu:main")]]); }
async function guard(ctx: Ctx): Promise<boolean> { const user = await userFor(String(ctx.from?.id ?? ctx.chat?.id)); if (isAdmin(user)) return true; await ctx.editMessageText("Admin access is required for this area.", { reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]) }); return false; }

composer.callbackQuery("admin:panel", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await guard(ctx))) return;
  await ctx.editMessageText("Admin controls are ready. Manage proxies or review recent activity.", { reply_markup: panel() });
});
composer.callbackQuery("admin:proxies", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await guard(ctx))) return; const list = await proxies(); const rows = list.map((proxy, index) => [inlineButton(`Remove proxy ${index + 1}`, `admin:proxy:remove:${proxy.id}`)]); await ctx.editMessageText(list.length === 0 ? "No proxies are configured yet — add one to enable rotation." : `${list.length} proxy${list.length === 1 ? " is" : "ies are"} available for rotation.`, { reply_markup: inlineKeyboard([[inlineButton("Add proxy", "admin:proxy:add")], ...rows, [inlineButton("Back to admin", "admin:panel")]]) }); });
composer.callbackQuery("admin:proxy:add", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await guard(ctx))) return; ctx.session.adminStep = "adding_proxy"; await ctx.editMessageText("Send the proxy as host:port. It will be used only for inbox checks.", { reply_markup: inlineKeyboard([[inlineButton("Cancel", "admin:panel")]]) }); });
composer.on("message:text", async (ctx, next) => { if (ctx.session.adminStep !== "adding_proxy") return next(); ctx.session.adminStep = undefined; const value = ctx.message.text.trim(); const match = /^([^\s:]+):(\d{1,5})$/.exec(value); if (!match || Number(match[2]) < 1 || Number(match[2]) > 65535) { await ctx.reply("That proxy format doesn’t look right. Send host:port, such as proxy.example:8080."); return; } if (!(await isAdmin(await userFor(String(ctx.from.id))))) { await ctx.reply("Admin access is required for this area."); return; } await createProxy(match[1], Number(match[2])); await ctx.reply("Proxy added and ready for rotation.", { reply_markup: inlineKeyboard([[inlineButton("Manage proxies", "admin:proxies")]]) }); });
composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (data === "admin:logs") { await ctx.answerCallbackQuery(); if (!(await guard(ctx))) return; const entries = await recentAudit(); await ctx.editMessageText(entries.length === 0 ? "No audit activity has been recorded yet." : `Recent activity: ${entries.map((entry) => entry.eventType.replaceAll("_", " ")).join("; ")}.`, { reply_markup: inlineKeyboard([[inlineButton("Back to admin", "admin:panel")]]) }); return; }
  if (data === "admin:users") { await ctx.answerCallbackQuery(); if (!(await guard(ctx))) return; const users = await knownUsers(); const rows = users.map((user, index) => [inlineButton(`Member ${index + 1} · ${user.tier}`, `admin:user:${user.telegramId}`)]); await ctx.editMessageText(users.length === 0 ? "No members have started the bot yet." : "Choose a member to update their plan or quota.", { reply_markup: inlineKeyboard([...rows, [inlineButton("Back to admin", "admin:panel")]]) }); return; }
  if (data.startsWith("admin:user:")) { await ctx.answerCallbackQuery(); if (!(await guard(ctx))) return; const member = await userFor(data.slice("admin:user:".length)); await ctx.editMessageText(`This member is on ${member.tier} with ${member.quotaRemaining} checks remaining.`, { reply_markup: inlineKeyboard([[inlineButton("Set Basic", `admin:tier:basic:${member.telegramId}`), inlineButton("Set Pro", `admin:tier:pro:${member.telegramId}`)], [inlineButton("Add 5 checks", `admin:quota:${member.telegramId}`)], [inlineButton("Back to members", "admin:users")]]) }); return; }
  if (data.startsWith("admin:tier:") || data.startsWith("admin:quota:")) { await ctx.answerCallbackQuery(); if (!(await guard(ctx))) return; const parts = data.split(":"); const isQuota = parts[1] === "quota"; const memberId = isQuota ? parts[2] : parts[3]; const member = await userFor(memberId); if (isQuota) member.quotaRemaining += 5; else { member.tier = parts[2] === "pro" ? "pro" : "basic"; member.quotaRemaining = member.tier === "pro" ? 100 : 25; } await saveUser(member); await audit(isQuota ? "quota_updated" : "tier_updated", "An admin updated a member account."); await ctx.editMessageText(isQuota ? "Member quota updated." : "Member plan updated.", { reply_markup: inlineKeyboard([[inlineButton("Manage members", "admin:users")]]) }); return; }
  if (!data.startsWith("admin:proxy:remove:")) return next(); await ctx.answerCallbackQuery(); if (!(await guard(ctx))) return; const removed = await removeProxy(data.slice("admin:proxy:remove:".length)); await audit("proxy_change", removed ? "An admin removed a proxy." : "An admin tried to remove a missing proxy."); await ctx.editMessageText(removed ? "Proxy removed." : "That proxy no longer exists.", { reply_markup: inlineKeyboard([[inlineButton("Manage proxies", "admin:proxies")]]) });
});

export default composer;
