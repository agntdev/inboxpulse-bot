# Outlook Inbox Monitor — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot that provides live inbox checks for Hotmail/Outlook accounts via Microsoft Graph API, with tiered membership quotas, admin/team workflows, proxy rotation, and a professional button-driven UI. Users can view results in-chat, admins manage users/proxies/logs, and support teams perform bulk checks.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Paid members (Free/Trial, Basic, Pro)
- Support/Team users
- Admins

## Success criteria

- Successful inbox check execution with results displayed in user chat
- Quota enforcement prevents overuse of check limits
- Admin receives audit notifications for errors and high-severity events

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with tier status and available actions
- **Link Account** (button, actor: user, callback: auth:link) — Initiate Microsoft Graph OAuth flow for Hotmail/Outlook
  - inputs: OAuth credentials
  - outputs: Linked Email Account entity
- **Run Check Now** (button, actor: user, callback: check:run) — Execute immediate inbox check for selected account
  - inputs: selected account ID, proxy selection
  - outputs: Check Job result summary
- **Schedule Check** (button, actor: user, callback: check:schedule) — Create recurring check job (default 1/hour if no interval specified)
  - inputs: account ID, interval (optional)
  - outputs: Check Job entity
- **Upgrade Tier** (button, actor: user, callback: membership:upgrade) — Display tier options and initiate payment flow
  - inputs: selected tier, payment confirmation
  - outputs: User tier update
- **Admin Panel** (button, actor: admin, callback: admin:panel) — Open admin controls for user/proxy/log management
  - inputs: admin authentication
  - outputs: Admin UI interface

## Flows

### Onboarding
_Trigger:_ /start

1. Display tier explanation
2. Prompt for tier selection/purchase
3. Initiate OAuth flow
4. Store linked account
5. Confirm setup completion

_Data touched:_ User, Linked Email Account

### Live Check
_Trigger:_ check:run

1. Select account
2. Choose proxy (optional)
3. Execute Graph API check
4. Display progress with buttons
5. Show result summary with key metrics

_Data touched:_ Check Job, Audit Log

### Membership Management
_Trigger:_ membership:upgrade

1. Display current tier and quota
2. Show available tiers
3. Process payment (deferred to owner)
4. Update user tier
5. Notify admin of tier change

_Data touched:_ User, Audit Log

### Support Bulk Check
_Trigger:_ support:bulk

1. Verify Support role
2. Select accounts or upload list
3. Configure check parameters
4. Execute batch checks
5. Display per-account results

_Data touched:_ Check Job, Audit Log

### Admin Proxy Management
_Trigger:_ admin:proxies

1. Verify Admin role
2. List available proxies
3. Add/remove proxies
4. Assign proxies to check jobs

_Data touched:_ Proxy, Audit Log

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: persistent)_ — User account with tier, quota, and role
  - fields: telegram_id, tier, quota_remaining, role
- **Linked Email Account** _(retention: persistent)_ — Microsoft account credentials via OAuth
  - fields: user_id, email, access_token, refresh_token
- **Check Job** _(retention: persistent)_ — Scheduled or on-demand inbox check
  - fields: job_id, account_id, status, result_summary, timestamp, proxy_used
- **Proxy** _(retention: persistent)_ — Configured proxy for check job rotation
  - fields: proxy_id, address, port, assigned_to
- **Audit Log** _(retention: persistent)_ — System events and admin actions
  - fields: log_id, event_type, timestamp, details

## Integrations

- **Telegram** (required) — Bot API messaging and admin notifications
- **Microsoft Graph API** (required) — Mailbox access and inbox checks
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Manage user tiers and quotas
- Add/remove proxies
- View audit logs
- Force re-checks
- Receive error notifications in admin chat

## Notifications

- Error alerts to ADMIN_CHAT_ID
- Audit log updates for admin actions
- Check job completion notifications in user chat

## Permissions & privacy

- OAuth tokens stored securely
- No raw password handling
- User data access restricted by role
- Audit logs retained for accountability

## Edge cases

- OAuth token expiration during check
- User exceeds daily check quota
- Proxy rotation fails during bulk check
- Admin attempts to modify non-existent user

## Required tests

- End-to-end check job execution from button press to result display
- Tier upgrade flow with quota update validation
- Admin proxy assignment and rotation in bulk checks

## Assumptions

- Payment provider integration will be added later
- Default check intervals apply when unspecified
- Admin chat notifications are sufficient for error tracking
