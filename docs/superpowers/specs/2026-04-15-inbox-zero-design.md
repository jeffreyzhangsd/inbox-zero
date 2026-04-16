# Inbox Zero — Design Spec

**Date:** 2026-04-15  
**Status:** Approved

---

## Overview

Multi-user email management tool. Anyone can sign in with their Gmail account and get a grouped, sorted view of their inbox. Site is gated by a simple shared password (env var) to keep it semi-private while in development. Supports bulk actions, one-click unsubscribe, search, and light/dark/auto theme. Claude integration is optional and off by default.

---

## Scope

**In scope:**

- Gmail OAuth2 login (multi-user, each user's own Gmail)
- Site password gate (shared env var, checked before OAuth)
- Category + sender grouping
- Search
- Mark read, archive, delete, move to folder, unsubscribe actions
- Bulk selection with bottom action bar
- Light / dark / auto theme toggle
- Optional Claude API for categorizing uncategorized emails

**Out of scope (later):**

- Yahoo Mail (separate page/integration, deferred)
- Drafting email responses
- Mobile / responsive layout

---

## Architecture

**Stack:** Next.js App Router + TypeScript, deployed on Vercel.

```
/app
  page.tsx                   ← landing / Google sign-in
  inbox/page.tsx             ← main two-panel inbox view
  api/
    auth/[...nextauth]/      ← NextAuth.js Google OAuth2
    auth/gate/route.ts       ← site password check, sets gate_token cookie
    emails/route.ts          ← fetch + categorize emails
    search/route.ts          ← Gmail API search (global queries)
    unsubscribe/route.ts     ← trigger List-Unsubscribe
    actions/route.ts         ← mark read, archive, delete, move
```

**Auth:** NextAuth.js with Google provider. Access token stored in encrypted session cookie. Scopes required: `gmail.modify` (includes read), `gmail.send` (for mailto unsubscribes). Each user authenticates independently — no shared credentials.

**Site password gate:** Landing page (`/`) shows a password input before the Google OAuth button. Password checked client-side against `SITE_PASSWORD` env var (via a `/api/auth/gate` route). On success, a short-lived cookie (`gate_token`) is set. All protected routes check for this cookie. Simple enough for semi-private use; not a substitute for real auth.

**No database.** All state lives in Gmail. No caching layer for v1 — fetch fresh on each load.

---

## Email Fetching + Categorization

### Flow

1. `/api/emails` fetches all messages via Gmail API (metadata format: `from`, `subject`, `snippet`, `labelIds`, `internalDate`)
2. Categorize each message:
   - **Step 1 — Gmail labels:** map `CATEGORY_PROMOTIONS` → Promotions, `CATEGORY_SOCIAL` → Social, `CATEGORY_UPDATES` → Updates, `CATEGORY_FORUMS` → Updates
   - **Step 2 — Sender domain heuristics:** lookup table maps known domains to categories (e.g. `linkedin.com`, `greenhouse.io`, `lever.co`, `indeed.com` → Jobs; `chase.com`, `venmo.com`, `wellsfargo.com` → Finance)
   - **Step 3 — Fallback:** anything unmatched → Uncategorized
3. Group by category, then by sender domain within each category
4. Sort senders by most recent email descending

### Default categories

- Jobs
- Finance
- Promotions
- Social
- Updates
- Uncategorized

Categories are fixed for v1. User can rename via settings in a future version.

### Claude integration (opt-in)

- Off by default. User enables in Settings by pasting an Anthropic API key.
- When enabled: Claude processes emails in the Uncategorized bucket in batches, assigns them to existing categories.
- Model: `claude-haiku-4-5-20251001` (cheapest, fast enough for metadata-only classification).
- Input per email: `from`, `subject`, `snippet` only — no email body.

---

## UI

### Layout

Full-width, full-height two-panel layout. No max-width constraint.

**Left sidebar (240px fixed):**

- Top: "CATEGORIES" label + category list. Active category has left border highlight.
- Bottom (pinned): "ALL MAIL" summary showing total + unread count.
- No padding inflation — flex column, categories fill space, All Mail sits at bottom.

**Right panel (flex: 1):**

- Header: category name + unread count + "mark all read" button + search bar
- Sender list: compact single-line rows (see below)
- Bottom (pinned): bulk action bar, visible only when ≥1 sender is selected

**Top bar:**

- Left: app name "inbox zero"
- Right: account email · `◑ auto` theme toggle · `⚙ settings` · `↻ sync`

### Sender rows

Single-line compact layout per row:

```
[ checkbox ]  SenderName   N emails · X unread   "snippet preview..."   [time]  [read] [unsub] [···]
```

- Rows with 0 unread render at 50% opacity
- Snippet truncates with `text-overflow: ellipsis`
- `unsub` button hidden if sender has no `List-Unsubscribe` header on any email
- `···` overflow menu: move to folder, move to spam, delete

### Mark all read

Clicking "mark all read" shows an inline dropdown popover:

> "mark N as read? **yes** cancel"

Confirmation required before executing. No modal.

### Bulk action bar

Appears at the bottom of the screen when ≥1 checkbox is checked. Stays hidden otherwise.

Actions: mark read · archive · delete · move to → · unsubscribe

### Theme

Three-state toggle: dark → light → auto (follows system). Persisted in `localStorage`. Applied via `data-theme` on `<html>`. 0.2s transition on bg/color.

---

## Search

Search bar sits in the right panel header. Two modes depending on scope:

- **Within category (default):** filters the current category's sender list client-side — matches against sender name and snippet. Instant, no API call.
- **Global search:** if user types and presses Enter (or clicks a "search all" affordance), calls Gmail API with the query string (`users.messages.list?q=...`). Results shown as a flat sender-grouped list, outside normal category view. Pressing Escape or clearing the field returns to normal view.

Search does not read email bodies — queries match Gmail's standard search operators against metadata only (from, subject, snippet).

---

## Unsubscribe

1. Fetch `List-Unsubscribe` header from the most recent email from that sender.
2. Parse header — may contain `mailto:` address, HTTPS URL, or both.
   - `mailto:` → send unsubscribe email via Gmail API (`users.messages.send`)
   - HTTPS URL → POST or GET to URL via server-side fetch (Next.js API route)
3. After triggering: mark sender as "unsubscribed" in UI (label change, visual indicator).
4. **Repeat offender rule:** on each sync, if a new email has arrived from a sender that was previously unsubscribed, auto-move it to spam via Gmail filter (`users.settings.filters.create`). Tracked via a Gmail label (`inbox-zero/unsubscribed`) applied to the sender's emails at unsubscribe time — no database needed.
5. If no `List-Unsubscribe` header found: skip the button entirely for that sender. User can manually move to spam via `···` menu.

---

## Actions

All actions go through `/api/actions` → Gmail API. Operate on all message IDs for a given sender (or selected subset via checkboxes).

| Action         | Gmail API call                               |
| -------------- | -------------------------------------------- |
| Mark read      | `messages.batchModify` remove `UNREAD` label |
| Archive        | `messages.batchModify` remove `INBOX` label  |
| Delete         | `messages.batchDelete`                       |
| Move to folder | `messages.batchModify` add target label      |
| Move to spam   | `messages.batchModify` add `SPAM` label      |

---

## Settings Page

Minimal settings panel at `/settings` (separate route, not a modal):

- Connected account (email + disconnect button)
- Claude API key input (optional) + toggle to enable AI categorization
- Sync frequency (manual only for v1)
- Theme preference (mirrors top-bar toggle)

---

## Error Handling

- OAuth failure → redirect to `/` with error message
- Gmail API rate limit (429) → surface "too many requests, try again shortly" in UI
- Unsubscribe failure → show inline error on sender row, do not move to spam automatically on first failure
- Missing Gmail scopes → prompt re-auth with correct scopes

---

## Out of Scope (v1)

- Yahoo Mail
- Email body reading / draft responses
- Real-time push (Gmail Pub/Sub)
- Mobile layout
- Custom category creation/renaming
