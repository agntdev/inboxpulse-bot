import { resolveSessionStorage } from "../toolkit/index.js";

export type Tier = "trial" | "basic" | "pro";
export type Role = "member" | "support" | "admin";

export interface UserRecord { telegramId: string; tier: Tier; quotaRemaining: number; role: Role; }
export interface LinkedAccount { id: string; userId: string; email: string; accessToken: string; refreshToken?: string; }
export interface CheckJob { id: string; accountId: string; status: "complete" | "failed" | "scheduled"; resultSummary: string; timestamp: string; proxyUsed?: string; }
export interface ProxyRecord { id: string; address: string; port: number; assignedTo?: string; }
export interface AuditLog { id: string; eventType: string; timestamp: string; details: string; }

export const now = (): Date => new Date();

const store = resolveSessionStorage<Record<string, unknown>>(undefined);
const key = (name: string) => `inbox-pulse:${name}`;
const newId = () => globalThis.crypto.randomUUID();

async function get<T>(name: string): Promise<T | undefined> { return store.read(key(name)) as Promise<T | undefined>; }
async function put<T>(name: string, value: T): Promise<void> { await store.write(key(name), value as Record<string, unknown>); }
async function indexedAdd(indexName: string, id: string): Promise<void> {
  const ids = (await get<string[]>(indexName)) ?? [];
  if (!ids.includes(id)) await put(indexName, [...ids, id]);
}

function configuredAdminId(): string | undefined {
  return typeof process === "undefined" ? undefined : process.env.ADMIN_CHAT_ID;
}

export async function userFor(telegramId: string): Promise<UserRecord> {
  const found = await get<UserRecord>(`user:${telegramId}`);
  if (found) return found;
  const user: UserRecord = {
    telegramId,
    tier: "trial",
    quotaRemaining: 3,
    role: configuredAdminId() === telegramId ? "admin" : "member",
  };
  await put(`user:${telegramId}`, user);
  await indexedAdd("users", telegramId);
  return user;
}
export async function saveUser(user: UserRecord): Promise<void> { await put(`user:${user.telegramId}`, user); }
export async function knownUsers(): Promise<UserRecord[]> {
  const ids = (await get<string[]>("users")) ?? [];
  const records = await Promise.all(ids.map((id) => get<UserRecord>(`user:${id}`)));
  return records.filter((record): record is UserRecord => record !== undefined);
}
export const isAdmin = (user: UserRecord) => user.role === "admin";
export const isSupport = (user: UserRecord) => user.role === "support" || user.role === "admin";

export async function accountsFor(userId: string): Promise<LinkedAccount[]> {
  const ids = (await get<string[]>(`accounts:${userId}`)) ?? [];
  const records = await Promise.all(ids.map((id) => get<LinkedAccount>(`account:${id}`)));
  return records.filter((record): record is LinkedAccount => record !== undefined);
}
export async function getAccount(id: string): Promise<LinkedAccount | undefined> { return get(`account:${id}`); }

export async function audit(eventType: string, details: string): Promise<void> {
  const entry: AuditLog = { id: newId(), eventType, timestamp: now().toISOString(), details };
  await put(`audit:${entry.id}`, entry);
  await indexedAdd("audit", entry.id);
}
export async function recentAudit(limit = 8): Promise<AuditLog[]> {
  const ids = (await get<string[]>("audit")) ?? [];
  const records = await Promise.all(ids.slice(-limit).reverse().map((id) => get<AuditLog>(`audit:${id}`)));
  return records.filter((record): record is AuditLog => record !== undefined);
}
export async function proxies(): Promise<ProxyRecord[]> {
  const ids = (await get<string[]>("proxies")) ?? [];
  const records = await Promise.all(ids.map((id) => get<ProxyRecord>(`proxy:${id}`)));
  return records.filter((record): record is ProxyRecord => record !== undefined);
}
export async function createProxy(address: string, port: number): Promise<ProxyRecord> {
  const proxy = { id: newId(), address, port };
  await put(`proxy:${proxy.id}`, proxy);
  await indexedAdd("proxies", proxy.id);
  await audit("proxy_added", "A proxy was added.");
  return proxy;
}
export async function removeProxy(id: string): Promise<boolean> {
  const proxy = await get<ProxyRecord>(`proxy:${id}`);
  if (!proxy) return false;
  await store.delete(key(`proxy:${id}`));
  const ids = (await get<string[]>("proxies")) ?? [];
  await put("proxies", ids.filter((saved) => saved !== id));
  await audit("proxy_removed", "A proxy was removed.");
  return true;
}
export async function chooseProxy(): Promise<ProxyRecord | undefined> {
  const list = await proxies();
  return list.find((proxy) => !proxy.assignedTo) ?? list[0];
}
export async function saveJob(job: CheckJob): Promise<void> {
  await put(`job:${job.id}`, job);
  await indexedAdd("jobs", job.id);
}
export async function schedule(accountId: string): Promise<CheckJob> {
  const job: CheckJob = { id: newId(), accountId, status: "scheduled", resultSummary: "Runs every hour.", timestamp: now().toISOString() };
  await saveJob(job);
  await audit("check_scheduled", "A recurring inbox check was scheduled.");
  return job;
}

export async function checkInbox(account: LinkedAccount, proxy?: ProxyRecord): Promise<CheckJob> {
  const timestamp = now().toISOString();
  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$select=id,isRead,receivedDateTime&$top=50", {
      headers: { Authorization: `Bearer ${account.accessToken}`, Accept: "application/json" },
    });
    if (response.status === 401) throw new Error("token_expired");
    if (!response.ok) throw new Error("graph_unavailable");
    const payload = (await response.json()) as { value?: Array<{ isRead?: boolean }> };
    const messages = payload.value ?? [];
    const unread = messages.filter((message) => message.isRead === false).length;
    const job: CheckJob = { id: newId(), accountId: account.id, status: "complete", resultSummary: `${messages.length} recent messages, ${unread} unread.`, timestamp, proxyUsed: proxy?.id };
    await saveJob(job);
    await audit("check_completed", "An inbox check completed.");
    return job;
  } catch (error) {
    const reason = error instanceof Error && error.message === "token_expired" ? "Microsoft needs you to reconnect this account." : "Microsoft Graph could not complete the inbox check.";
    const job: CheckJob = { id: newId(), accountId: account.id, status: "failed", resultSummary: reason, timestamp, proxyUsed: proxy?.id };
    await saveJob(job);
    await audit("check_failed", reason);
    throw error;
  }
}

export async function notifyAdmin(api: { sendMessage(chatId: string, text: string): Promise<unknown> }, text: string): Promise<void> {
  const chatId = configuredAdminId();
  if (!chatId) return;
  try { await api.sendMessage(chatId, text); } catch { /* An unavailable admin chat must not break the user flow. */ }
}
