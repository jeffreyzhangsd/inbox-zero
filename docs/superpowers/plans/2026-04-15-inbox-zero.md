# Inbox Zero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-user Gmail inbox manager — groups all email by category and sender, bulk actions, one-click unsubscribe, search, optional Claude categorization, dark/light/auto theme.

**Architecture:** Next.js 15 App Router, TypeScript. Site password gate (env var + signed cookie) protects the app before Gmail OAuth via Auth.js (next-auth v5). All state in Gmail — no database. Categorization: Gmail built-in labels first, sender domain heuristics second, Claude API opt-in for Uncategorized. Email fetching uses Gmail metadata format — no body reading.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Auth.js (next-auth v5), `googleapis`, Vitest + @testing-library/react, Vercel.

---

## File Map

| File                                  | Purpose                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| `types.ts`                            | Shared types: Email, Sender, CategoryGroup, GroupedInbox         |
| `lib/domains.ts`                      | Sender domain → category lookup table                            |
| `lib/categorize.ts`                   | Pure fn: Email[] → GroupedInbox                                  |
| `lib/unsubscribe.ts`                  | Parse List-Unsubscribe header → mailto/URL                       |
| `lib/gmail.ts`                        | Gmail API client: fetch, batch actions, send, filter             |
| `lib/auth.ts`                         | Gate cookie helpers                                              |
| `auth.ts`                             | Auth.js config (Google provider, JWT callbacks)                  |
| `middleware.ts`                       | Protect /inbox + /settings: gate cookie + session                |
| `public/theme-init.js`                | Inline-free theme init script (loaded before hydration, no FOUC) |
| `app/layout.tsx`                      | Root layout: theme script tag, SessionProvider                   |
| `app/globals.css`                     | CSS custom properties for dark/light/auto theme tokens           |
| `app/page.tsx`                        | Landing: password gate form + Google sign-in                     |
| `app/inbox/page.tsx`                  | Inbox server component: fetch emails, pass to layout             |
| `app/settings/page.tsx`               | Settings: account, Claude key, theme                             |
| `app/api/auth/[...nextauth]/route.ts` | Auth.js route handler                                            |
| `app/api/auth/gate/route.ts`          | POST: validate password, set gate_token cookie                   |
| `app/api/emails/route.ts`             | GET: fetch + categorize all emails                               |
| `app/api/actions/route.ts`            | POST: mark read, archive, delete, move, spam                     |
| `app/api/unsubscribe/route.ts`        | POST: trigger List-Unsubscribe                                   |
| `app/api/search/route.ts`             | GET: Gmail API search proxy                                      |
| `components/TopBar.tsx`               | App bar: name, email, theme toggle, settings, sync               |
| `components/ThemeToggle.tsx`          | dark/light/auto cycle button                                     |
| `components/inbox/InboxLayout.tsx`    | Client component: two-panel state                                |
| `components/inbox/Sidebar.tsx`        | Category nav + All Mail pinned footer                            |
| `components/inbox/SenderList.tsx`     | Right panel header + rows                                        |
| `components/inbox/SenderRow.tsx`      | Single sender row with actions                                   |
| `components/inbox/BulkActionBar.tsx`  | Bottom bar (shows on selection)                                  |
| `components/inbox/SearchBar.tsx`      | Search input                                                     |
| `__tests__/lib/categorize.test.ts`    | Unit tests for categorization                                    |
| `__tests__/lib/unsubscribe.test.ts`   | Unit tests for header parsing                                    |
| `vitest.config.ts`                    | Vitest config                                                    |
| `.env.example`                        | Env var template                                                 |

---

### Task 1: Scaffold project + install dependencies

**Files:**

- Create: `package.json` (via scaffold)
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `.env.local`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/jeffreyzhang/Desktop/Projects.nosync/inbox-zero
npx create-next-app@latest . --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*"
```

Accept all defaults when prompted.

- [ ] **Step 2: Install dependencies**

```bash
npm install next-auth@beta googleapis @anthropic-ai/sdk
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["__tests__/setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 4: Create test setup file**

```typescript
// __tests__/setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Create .env.example**

```bash
# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Auth.js secret — generate with: openssl rand -base64 32
AUTH_SECRET=

# Site password gate
SITE_PASSWORD=

# Optional — Claude AI categorization
ANTHROPIC_API_KEY=

# Next.js
NEXTAUTH_URL=http://localhost:3000
```

- [ ] **Step 6: Create .env.local**

Copy `.env.example` to `.env.local` and fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` (run `openssl rand -base64 32`), and `SITE_PASSWORD`.

- [ ] **Step 7: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 8: Verify scaffold runs**

```bash
npm run dev
```

Expected: Next.js dev server starts on http://localhost:3000 with no errors.

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js project with deps"
```

---

### Task 2: Shared types

**Files:**

- Create: `types.ts`

- [ ] **Step 1: Write types.ts**

```typescript
// types.ts

export type Category =
  | "Jobs"
  | "Finance"
  | "Promotions"
  | "Social"
  | "Updates"
  | "Uncategorized";

export const ALL_CATEGORIES: Category[] = [
  "Jobs",
  "Finance",
  "Promotions",
  "Social",
  "Updates",
  "Uncategorized",
];

export interface Email {
  id: string;
  threadId: string;
  from: string; // raw From header: "Name <email@domain.com>"
  fromAddress: string; // parsed: "email@domain.com"
  fromDomain: string; // parsed: "domain.com"
  fromName: string; // parsed display name or address
  subject: string;
  snippet: string;
  isRead: boolean;
  date: Date;
  labelIds: string[];
  listUnsubscribe?: string; // raw List-Unsubscribe header value if present
}

export interface Sender {
  domain: string;
  displayName: string; // best guess display name from emails
  fromAddress: string; // most common from address for this domain
  emailCount: number;
  unreadCount: number;
  mostRecent: Date;
  snippet: string; // snippet from most recent email
  listUnsubscribe?: string;
  isUnsubscribed: boolean; // has inbox-zero/unsubscribed label
  emailIds: string[];
}

export interface CategoryGroup {
  name: Category;
  senders: Sender[]; // sorted by mostRecent desc
  totalUnread: number;
}

export interface GroupedInbox {
  categories: CategoryGroup[];
  total: number;
  totalUnread: number;
}

// Augment next-auth session to include accessToken
declare module "next-auth" {
  interface Session {
    accessToken: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add types.ts
git commit -m "feat: add shared types"
```

---

### Task 3: Sender domain heuristics table

**Files:**

- Create: `lib/domains.ts`

- [ ] **Step 1: Write lib/domains.ts**

```typescript
// lib/domains.ts
import type { Category } from "@/types";

// Maps sender domains to categories.
// Checked after Gmail built-in labels; before Claude fallback.
export const DOMAIN_CATEGORY_MAP: Record<string, Category> = {
  // Jobs
  "linkedin.com": "Jobs",
  "linkedin.email.com": "Jobs",
  "indeed.com": "Jobs",
  "glassdoor.com": "Jobs",
  "greenhouse.io": "Jobs",
  "lever.co": "Jobs",
  "ashbyhq.com": "Jobs",
  "workday.com": "Jobs",
  "icims.com": "Jobs",
  "smartrecruiters.com": "Jobs",
  "jobvite.com": "Jobs",
  "ziprecruiter.com": "Jobs",
  "dice.com": "Jobs",
  "monster.com": "Jobs",
  "wellfound.com": "Jobs",
  "angel.co": "Jobs",

  // Finance
  "chase.com": "Finance",
  "wellsfargo.com": "Finance",
  "bankofamerica.com": "Finance",
  "citi.com": "Finance",
  "citibank.com": "Finance",
  "discover.com": "Finance",
  "americanexpress.com": "Finance",
  "capitalone.com": "Finance",
  "venmo.com": "Finance",
  "paypal.com": "Finance",
  "cashapp.com": "Finance",
  "coinbase.com": "Finance",
  "robinhood.com": "Finance",
  "fidelity.com": "Finance",
  "schwab.com": "Finance",
  "vanguard.com": "Finance",
  "turbotax.com": "Finance",
  "intuit.com": "Finance",
};

export function getDomainCategory(domain: string): Category | null {
  // Try exact match
  if (DOMAIN_CATEGORY_MAP[domain]) return DOMAIN_CATEGORY_MAP[domain];
  // Try stripping subdomain (e.g. em.linkedin.com -> linkedin.com)
  const parts = domain.split(".");
  if (parts.length > 2) {
    const rootDomain = parts.slice(-2).join(".");
    if (DOMAIN_CATEGORY_MAP[rootDomain]) return DOMAIN_CATEGORY_MAP[rootDomain];
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/domains.ts
git commit -m "feat: domain-to-category heuristics table"
```

---

### Task 4: Categorization logic (TDD)

**Files:**

- Create: `lib/categorize.ts`
- Create: `__tests__/lib/categorize.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/lib/categorize.test.ts
import { describe, it, expect } from "vitest";
import { categorize, parseFromHeader } from "@/lib/categorize";
import type { Email } from "@/types";

function makeEmail(overrides: Partial<Email>): Email {
  return {
    id: "1",
    threadId: "t1",
    from: "Test <test@example.com>",
    fromAddress: "test@example.com",
    fromDomain: "example.com",
    fromName: "Test",
    subject: "Hello",
    snippet: "Hi there",
    isRead: false,
    date: new Date("2026-04-15"),
    labelIds: [],
    ...overrides,
  } as Email;
}

describe("parseFromHeader", () => {
  it("parses display name and address", () => {
    const result = parseFromHeader("John Doe <john@example.com>");
    expect(result.fromName).toBe("John Doe");
    expect(result.fromAddress).toBe("john@example.com");
    expect(result.fromDomain).toBe("example.com");
  });

  it("handles bare address with no display name", () => {
    const result = parseFromHeader("john@example.com");
    expect(result.fromName).toBe("john@example.com");
    expect(result.fromAddress).toBe("john@example.com");
    expect(result.fromDomain).toBe("example.com");
  });
});

describe("categorize", () => {
  it("assigns Promotions from Gmail CATEGORY_PROMOTIONS label", () => {
    const email = makeEmail({
      labelIds: ["CATEGORY_PROMOTIONS"],
      fromDomain: "unknown.com",
    });
    const result = categorize([email]);
    const promo = result.categories.find((c) => c.name === "Promotions");
    expect(promo?.senders.length).toBe(1);
  });

  it("assigns Jobs from domain heuristic (linkedin.com)", () => {
    const email = makeEmail({ fromDomain: "linkedin.com", labelIds: [] });
    const result = categorize([email]);
    const jobs = result.categories.find((c) => c.name === "Jobs");
    expect(jobs?.senders.length).toBe(1);
  });

  it("domain heuristic takes precedence over Gmail Promotions label", () => {
    const email = makeEmail({
      fromDomain: "linkedin.com",
      labelIds: ["CATEGORY_PROMOTIONS"],
    });
    const result = categorize([email]);
    const jobs = result.categories.find((c) => c.name === "Jobs");
    const promo = result.categories.find((c) => c.name === "Promotions");
    expect(jobs?.senders.length).toBe(1);
    expect(promo?.senders.length ?? 0).toBe(0);
  });

  it("falls back to Uncategorized when no label or domain match", () => {
    const email = makeEmail({ fromDomain: "unknownsite.xyz", labelIds: [] });
    const result = categorize([email]);
    const unc = result.categories.find((c) => c.name === "Uncategorized");
    expect(unc?.senders.length).toBe(1);
  });

  it("groups multiple emails from same domain into one sender", () => {
    const emails = [
      makeEmail({
        id: "1",
        fromDomain: "linkedin.com",
        fromAddress: "a@linkedin.com",
        date: new Date("2026-04-14"),
      }),
      makeEmail({
        id: "2",
        fromDomain: "linkedin.com",
        fromAddress: "a@linkedin.com",
        date: new Date("2026-04-15"),
      }),
    ];
    const result = categorize(emails);
    const jobs = result.categories.find((c) => c.name === "Jobs")!;
    expect(jobs.senders.length).toBe(1);
    expect(jobs.senders[0].emailCount).toBe(2);
  });

  it("counts unread correctly", () => {
    const emails = [
      makeEmail({
        id: "1",
        fromDomain: "chase.com",
        isRead: false,
        labelIds: ["UNREAD"],
      }),
      makeEmail({
        id: "2",
        fromDomain: "chase.com",
        isRead: true,
        labelIds: [],
      }),
    ];
    const result = categorize(emails);
    const finance = result.categories.find((c) => c.name === "Finance")!;
    expect(finance.senders[0].unreadCount).toBe(1);
    expect(finance.totalUnread).toBe(1);
  });

  it("returns total and totalUnread counts", () => {
    const emails = [
      makeEmail({
        id: "1",
        fromDomain: "chase.com",
        isRead: false,
        labelIds: ["UNREAD"],
      }),
      makeEmail({
        id: "2",
        fromDomain: "linkedin.com",
        isRead: true,
        labelIds: [],
      }),
    ];
    const result = categorize(emails);
    expect(result.total).toBe(2);
    expect(result.totalUnread).toBe(1);
  });

  it("respects category overrides map", () => {
    const email = makeEmail({
      id: "override1",
      fromDomain: "unknownsite.xyz",
      labelIds: [],
    });
    const overrides = new Map([["override1", "Finance" as const]]);
    const result = categorize([email], overrides);
    const finance = result.categories.find((c) => c.name === "Finance");
    expect(finance?.senders.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm run test:run -- __tests__/lib/categorize.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement lib/categorize.ts**

```typescript
// lib/categorize.ts
import type {
  Category,
  Email,
  Sender,
  CategoryGroup,
  GroupedInbox,
} from "@/types";
import { ALL_CATEGORIES } from "@/types";
import { getDomainCategory } from "@/lib/domains";

const GMAIL_LABEL_MAP: Record<string, Category> = {
  CATEGORY_PROMOTIONS: "Promotions",
  CATEGORY_SOCIAL: "Social",
  CATEGORY_UPDATES: "Updates",
  CATEGORY_FORUMS: "Updates",
};

export function parseFromHeader(from: string): {
  fromName: string;
  fromAddress: string;
  fromDomain: string;
} {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    const fromAddress = match[2].trim().toLowerCase();
    return {
      fromName: match[1].trim().replace(/^["']|["']$/g, ""),
      fromAddress,
      fromDomain: fromAddress.split("@")[1] ?? "",
    };
  }
  const bare = from.trim().toLowerCase();
  return {
    fromName: bare,
    fromAddress: bare,
    fromDomain: bare.split("@")[1] ?? "",
  };
}

function assignCategory(
  email: Email,
  overrides?: Map<string, Category>,
): Category {
  if (overrides?.has(email.id)) return overrides.get(email.id)!;

  // Domain heuristic first — overrides Gmail labels
  const domainCat = getDomainCategory(email.fromDomain);
  if (domainCat) return domainCat;

  // Gmail built-in category labels
  for (const labelId of email.labelIds) {
    if (GMAIL_LABEL_MAP[labelId]) return GMAIL_LABEL_MAP[labelId];
  }

  return "Uncategorized";
}

export function categorize(
  emails: Email[],
  overrides?: Map<string, Category>,
): GroupedInbox {
  const categoryMap = new Map<Category, Map<string, Sender>>();
  for (const cat of ALL_CATEGORIES) {
    categoryMap.set(cat, new Map());
  }

  for (const email of emails) {
    const category = assignCategory(email, overrides);
    const senderMap = categoryMap.get(category)!;
    const existing = senderMap.get(email.fromDomain);

    if (existing) {
      existing.emailCount += 1;
      if (!email.isRead) existing.unreadCount += 1;
      if (email.date > existing.mostRecent) {
        existing.mostRecent = email.date;
        existing.snippet = email.snippet;
      }
      existing.emailIds.push(email.id);
    } else {
      senderMap.set(email.fromDomain, {
        domain: email.fromDomain,
        displayName: email.fromName,
        fromAddress: email.fromAddress,
        emailCount: 1,
        unreadCount: email.isRead ? 0 : 1,
        mostRecent: email.date,
        snippet: email.snippet,
        listUnsubscribe: email.listUnsubscribe,
        isUnsubscribed: email.labelIds.includes("inbox-zero/unsubscribed"),
        emailIds: [email.id],
      });
    }
  }

  let total = 0;
  let totalUnread = 0;

  const categories: CategoryGroup[] = ALL_CATEGORIES.map((name) => {
    const senderMap = categoryMap.get(name)!;
    const senders = Array.from(senderMap.values()).sort(
      (a, b) => b.mostRecent.getTime() - a.mostRecent.getTime(),
    );
    const catUnread = senders.reduce((sum, s) => sum + s.unreadCount, 0);
    total += senders.reduce((sum, s) => sum + s.emailCount, 0);
    totalUnread += catUnread;
    return { name, senders, totalUnread: catUnread };
  });

  return { categories, total, totalUnread };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm run test:run -- __tests__/lib/categorize.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/categorize.ts __tests__/lib/categorize.test.ts __tests__/setup.ts vitest.config.ts
git commit -m "feat: categorization logic with tests"
```

---

### Task 5: Unsubscribe header parsing (TDD)

**Files:**

- Create: `lib/unsubscribe.ts`
- Create: `__tests__/lib/unsubscribe.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/lib/unsubscribe.test.ts
import { describe, it, expect } from "vitest";
import { parseListUnsubscribe } from "@/lib/unsubscribe";

describe("parseListUnsubscribe", () => {
  it("parses mailto address", () => {
    const result = parseListUnsubscribe("<mailto:unsub@example.com>");
    expect(result?.mailto).toBe("unsub@example.com");
    expect(result?.url).toBeUndefined();
  });

  it("parses HTTPS URL", () => {
    const result = parseListUnsubscribe("<https://example.com/unsub?id=123>");
    expect(result?.url).toBe("https://example.com/unsub?id=123");
    expect(result?.mailto).toBeUndefined();
  });

  it("parses both mailto and URL", () => {
    const result = parseListUnsubscribe(
      "<mailto:unsub@example.com>, <https://example.com/unsub>",
    );
    expect(result?.url).toBe("https://example.com/unsub");
    expect(result?.mailto).toBe("unsub@example.com");
  });

  it("returns null for empty header", () => {
    expect(parseListUnsubscribe("")).toBeNull();
    expect(parseListUnsubscribe(undefined)).toBeNull();
  });

  it("returns null for unrecognized format", () => {
    expect(parseListUnsubscribe("some random text")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npm run test:run -- __tests__/lib/unsubscribe.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement lib/unsubscribe.ts**

```typescript
// lib/unsubscribe.ts

export interface UnsubscribeTarget {
  mailto?: string;
  url?: string;
}

export function parseListUnsubscribe(
  header: string | undefined,
): UnsubscribeTarget | null {
  if (!header) return null;

  const mailtoMatch = header.match(/<mailto:([^>]+)>/i);
  const urlMatch = header.match(/<(https?:\/\/[^>]+)>/i);

  if (!mailtoMatch && !urlMatch) return null;

  return {
    mailto: mailtoMatch?.[1],
    url: urlMatch?.[1],
  };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm run test:run -- __tests__/lib/unsubscribe.test.ts
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add lib/unsubscribe.ts __tests__/lib/unsubscribe.test.ts
git commit -m "feat: unsubscribe header parsing with tests"
```

---

### Task 6: Gmail API client

**Files:**

- Create: `lib/gmail.ts`

- [ ] **Step 1: Write lib/gmail.ts**

```typescript
// lib/gmail.ts
import { google } from "googleapis";
import type { Email } from "@/types";
import { parseFromHeader } from "@/lib/categorize";

function getClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

async function fetchAllMessageIds(
  gmail: ReturnType<typeof getClient>,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults: 500,
      pageToken,
    });
    const messages = res.data.messages ?? [];
    ids.push(...messages.map((m) => m.id!));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return ids;
}

async function fetchEmailMetadata(
  gmail: ReturnType<typeof getClient>,
  ids: string[],
): Promise<Email[]> {
  const CHUNK = 50;
  const emails: Email[] = [];

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map((id) =>
        gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "List-Unsubscribe"],
        }),
      ),
    );

    for (const res of results) {
      const msg = res.data;
      const headers = msg.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value ?? "";

      const from = getHeader("From");
      const parsed = parseFromHeader(from);
      const labelIds = msg.labelIds ?? [];

      emails.push({
        id: msg.id!,
        threadId: msg.threadId!,
        from,
        ...parsed,
        subject: getHeader("Subject"),
        snippet: msg.snippet ?? "",
        isRead: !labelIds.includes("UNREAD"),
        date: new Date(parseInt(msg.internalDate ?? "0")),
        labelIds,
        listUnsubscribe: getHeader("List-Unsubscribe") || undefined,
      });
    }
  }

  return emails;
}

export async function fetchAllEmails(accessToken: string): Promise<Email[]> {
  const gmail = getClient(accessToken);
  const ids = await fetchAllMessageIds(gmail);
  return fetchEmailMetadata(gmail, ids);
}

export async function batchModify(
  accessToken: string,
  ids: string[],
  addLabelIds: string[],
  removeLabelIds: string[],
): Promise<void> {
  const gmail = getClient(accessToken);
  await gmail.users.messages.batchModify({
    userId: "me",
    requestBody: { ids, addLabelIds, removeLabelIds },
  });
}

export async function batchDelete(
  accessToken: string,
  ids: string[],
): Promise<void> {
  const gmail = getClient(accessToken);
  await gmail.users.messages.batchDelete({
    userId: "me",
    requestBody: { ids },
  });
}

export async function sendEmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  const gmail = getClient(accessToken);
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain",
    "",
    body,
  ].join("\r\n");
  const raw = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

export async function createSpamFilter(
  accessToken: string,
  fromAddress: string,
): Promise<void> {
  const gmail = getClient(accessToken);
  await gmail.users.settings.filters.create({
    userId: "me",
    requestBody: {
      criteria: { from: fromAddress },
      action: { addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] },
    },
  });
}

export async function searchEmails(
  accessToken: string,
  query: string,
): Promise<Email[]> {
  const gmail = getClient(accessToken);
  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 100,
  });
  const ids = (res.data.messages ?? []).map((m) => m.id!);
  if (ids.length === 0) return [];
  return fetchEmailMetadata(gmail, ids);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/gmail.ts
git commit -m "feat: Gmail API client"
```

---

### Task 7: Auth.js setup + middleware

**Files:**

- Create: `auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `lib/auth.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Create auth.ts (root)**

```typescript
// auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
});
```

- [ ] **Step 2: Create API route handler**

```typescript
// app/api/auth/[...nextauth]/route.ts
export { GET, POST } from "@/auth";
```

- [ ] **Step 3: Create lib/auth.ts**

```typescript
// lib/auth.ts
import { createHash } from "crypto";

const GATE_COOKIE = "gate_token";

export function expectedGateToken(): string {
  return createHash("sha256")
    .update(process.env.SITE_PASSWORD! + process.env.AUTH_SECRET!)
    .digest("hex");
}

export { GATE_COOKIE };
```

- [ ] **Step 4: Create middleware.ts**

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/auth";

const GATE_COOKIE = "gate_token";

function expectedToken(): string {
  return createHash("sha256")
    .update(process.env.SITE_PASSWORD! + process.env.AUTH_SECRET!)
    .digest("hex");
}

export async function middleware(request: NextRequest) {
  const gateToken = request.cookies.get(GATE_COOKIE)?.value;
  if (gateToken !== expectedToken()) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/inbox/:path*", "/settings/:path*"],
};
```

- [ ] **Step 5: Commit**

```bash
git add auth.ts app/api/auth lib/auth.ts middleware.ts
git commit -m "feat: Auth.js Google OAuth and middleware"
```

---

### Task 8: Site password gate API + landing page

**Files:**

- Create: `app/api/auth/gate/route.ts`
- Create: `app/page.tsx`

- [ ] **Step 1: Create gate API route**

```typescript
// app/api/auth/gate/route.ts
import { NextResponse } from "next/server";
import { createHash } from "crypto";

const GATE_COOKIE = "gate_token";

export async function POST(request: Request) {
  const body = await request.json();
  const { password } = body as { password: string };

  if (password !== process.env.SITE_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = createHash("sha256")
    .update(process.env.SITE_PASSWORD! + process.env.AUTH_SECRET!)
    .digest("hex");

  const response = NextResponse.json({ ok: true });
  response.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
```

- [ ] **Step 2: Create landing page**

```tsx
// app/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LandingPage() {
  const [password, setPassword] = useState("");
  const [gatePassed, setGatePassed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      setGatePassed(true);
    } else {
      setError("Incorrect password.");
    }
  }

  return (
    <main
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <div style={{ width: "320px" }}>
        <h1
          style={{
            fontSize: "14px",
            color: "var(--text-primary)",
            letterSpacing: "1px",
            marginBottom: "24px",
          }}
        >
          inbox zero
        </h1>
        {!gatePassed ? (
          <form
            onSubmit={handleGate}
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <p className="subtitle">Enter password to continue.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              autoFocus
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "checking..." : "continue →"}
            </button>
          </form>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <p className="subtitle">Connect your Gmail account.</p>
            <button onClick={() => signIn("google", { callbackUrl: "/inbox" })}>
              sign in with Google →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/gate/route.ts app/page.tsx
git commit -m "feat: site password gate and landing page"
```

---

### Task 9: Theme system

**Files:**

- Modify: `app/globals.css`
- Create: `public/theme-init.js`
- Create: `components/ThemeToggle.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace globals.css**

```css
/* app/globals.css */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #0d0d0d;
  --bg-container: #141414;
  --bg-hover: #1a1a1a;
  --border: #2a2a2a;
  --divider: #262626;
  --text-primary: #c8c8c8;
  --text-secondary: #999;
  --text-muted: #808080;
  --sidebar-active-bg: #1e1e1e;
  --sidebar-active-border: #999;
}

[data-theme="light"] {
  --bg: #f2f2f0;
  --bg-container: #ebebea;
  --bg-hover: #e4e4e2;
  --border: #d0d0ce;
  --divider: #dededc;
  --text-primary: #333;
  --text-secondary: #666;
  --text-muted: #595959;
  --sidebar-active-bg: #e0e0de;
  --sidebar-active-border: #555;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --bg: #f2f2f0;
    --bg-container: #ebebea;
    --bg-hover: #e4e4e2;
    --border: #d0d0ce;
    --divider: #dededc;
    --text-primary: #333;
    --text-secondary: #666;
    --text-muted: #595959;
    --sidebar-active-bg: #e0e0de;
    --sidebar-active-border: #555;
  }
}

html,
body {
  height: 100%;
  background: var(--bg);
  color: var(--text-secondary);
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  font-size: 13px;
  line-height: 1.6;
  transition:
    background 0.2s,
    color 0.2s;
}

a {
  color: inherit;
  text-decoration: none;
}
a:hover {
  color: var(--text-primary);
}

button {
  cursor: pointer;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 3px 10px;
  font-size: 11px;
  font-family: inherit;
  transition:
    color 0.15s,
    border-color 0.15s;
}
button:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

input {
  background: var(--bg-container);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 6px 10px;
  font-size: 13px;
  font-family: inherit;
  width: 100%;
}
input:focus {
  outline: 1px solid var(--text-muted);
  outline-offset: 2px;
}
input::placeholder {
  color: var(--text-muted);
}

.subtitle {
  color: var(--text-muted);
  font-size: 12px;
}
.error {
  color: #c44;
  font-size: 11px;
  margin-top: 4px;
}
.label {
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--text-muted);
}
```

- [ ] **Step 2: Create public/theme-init.js**

This file loads before hydration (via a `<script>` tag in `<head>`) to set the theme without flash.

```javascript
// public/theme-init.js
(function () {
  var t = localStorage.getItem("theme");
  if (t && t !== "auto") {
    document.documentElement.setAttribute("data-theme", t);
  }
})();
```

- [ ] **Step 3: Create ThemeToggle**

```tsx
// components/ThemeToggle.tsx
"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light" | "auto";
const CYCLE: Theme[] = ["dark", "light", "auto"];
const LABELS: Record<Theme, string> = {
  dark: "◑ dark",
  light: "◑ light",
  auto: "◑ auto",
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme) || "auto";
    setTheme(saved);
  }, []);

  function cycle() {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
    setTheme(next);
    localStorage.setItem("theme", next);
    if (next === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
    }
  }

  return (
    <button onClick={cycle} style={{ fontSize: "11px" }}>
      {LABELS[theme]}
    </button>
  );
}
```

- [ ] **Step 4: Update app/layout.tsx**

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "inbox zero",
  description: "Gmail inbox manager",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Loads before hydration to prevent theme flash — static file, no inline script */}
        <script src="/theme-init.js" />
      </head>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Test theme switching**

```bash
npm run dev
```

Navigate to http://localhost:3000. Click `◑ auto` — cycles dark/light/auto. Refresh — persists.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css public/theme-init.js components/ThemeToggle.tsx app/layout.tsx
git commit -m "feat: dark/light/auto theme system"
```

---

### Task 10: Emails, Actions, Unsubscribe, and Search API routes

**Files:**

- Create: `app/api/emails/route.ts`
- Create: `app/api/actions/route.ts`
- Create: `app/api/unsubscribe/route.ts`
- Create: `app/api/search/route.ts`

- [ ] **Step 1: Create emails route**

```typescript
// app/api/emails/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchAllEmails } from "@/lib/gmail";
import { categorize } from "@/lib/categorize";
import Anthropic from "@anthropic-ai/sdk";
import type { Email, Category } from "@/types";
import { ALL_CATEGORIES } from "@/types";

async function claudeCategorize(
  emails: Email[],
  apiKey: string,
): Promise<Map<string, Category>> {
  const client = new Anthropic({ apiKey });
  const result = new Map<string, Category>();
  const BATCH = 20;

  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH);
    const items = batch
      .map(
        (e, idx) =>
          `${idx + 1}. From: ${e.from} | Subject: ${e.subject} | Snippet: ${e.snippet}`,
      )
      .join("\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Categorize each email into one of: ${ALL_CATEGORIES.filter((c) => c !== "Uncategorized").join(", ")}, or Uncategorized.\nReply with only a JSON array of strings, one per email, in order. No explanation.\n\nEmails:\n${items}`,
        },
      ],
    });

    try {
      const text =
        response.content[0].type === "text" ? response.content[0].text : "[]";
      const categories: string[] = JSON.parse(text);
      batch.forEach((e, idx) => {
        const cat = categories[idx] as Category;
        if (ALL_CATEGORIES.includes(cat)) result.set(e.id, cat);
      });
    } catch {
      // Leave as Uncategorized on parse failure
    }
  }

  return result;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const emails = await fetchAllEmails(session.accessToken);

  const claudeKey = request.headers.get("x-claude-key");
  const claudeEnabled = request.headers.get("x-claude-enabled") === "true";

  if (claudeKey && claudeEnabled) {
    const uncatIds = new Set(
      categorize(emails)
        .categories.find((c) => c.name === "Uncategorized")
        ?.senders.flatMap((s) => s.emailIds) ?? [],
    );
    const uncEmails = emails.filter((e) => uncatIds.has(e.id));
    if (uncEmails.length > 0) {
      const overrides = await claudeCategorize(uncEmails, claudeKey);
      return NextResponse.json(categorize(emails, overrides));
    }
  }

  return NextResponse.json(categorize(emails));
}
```

- [ ] **Step 2: Create actions route**

```typescript
// app/api/actions/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { batchModify, batchDelete } from "@/lib/gmail";

type Action =
  | "markRead"
  | "markUnread"
  | "archive"
  | "delete"
  | "spam"
  | "moveToFolder";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    action: Action;
    emailIds: string[];
    labelId?: string;
  };
  const { action, emailIds, labelId } = body;

  switch (action) {
    case "markRead":
      await batchModify(session.accessToken, emailIds, [], ["UNREAD"]);
      break;
    case "markUnread":
      await batchModify(session.accessToken, emailIds, ["UNREAD"], []);
      break;
    case "archive":
      await batchModify(session.accessToken, emailIds, [], ["INBOX"]);
      break;
    case "delete":
      await batchDelete(session.accessToken, emailIds);
      break;
    case "spam":
      await batchModify(session.accessToken, emailIds, ["SPAM"], ["INBOX"]);
      break;
    case "moveToFolder":
      if (!labelId)
        return NextResponse.json(
          { error: "labelId required" },
          { status: 400 },
        );
      await batchModify(session.accessToken, emailIds, [labelId], ["INBOX"]);
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create unsubscribe route**

```typescript
// app/api/unsubscribe/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { batchModify, sendEmail, createSpamFilter } from "@/lib/gmail";
import { parseListUnsubscribe } from "@/lib/unsubscribe";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    emailIds: string[];
    fromAddress: string;
    listUnsubscribe?: string;
  };
  const { emailIds, fromAddress, listUnsubscribe } = body;
  const target = parseListUnsubscribe(listUnsubscribe);

  if (target) {
    try {
      if (target.url) {
        await fetch(target.url, { method: "POST" }).catch(() =>
          fetch(target.url!, { method: "GET" }),
        );
      } else if (target.mailto) {
        await sendEmail(
          session.accessToken,
          target.mailto,
          "Unsubscribe",
          "Please unsubscribe me from this mailing list.",
        );
      }
    } catch {
      // Trigger failed — proceed to create filter anyway
    }
  }

  // Archive emails and create a spam filter for future emails from this sender
  await batchModify(session.accessToken, emailIds, [], ["INBOX"]);
  await createSpamFilter(session.accessToken, fromAddress);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create search route**

```typescript
// app/api/search/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchEmails } from "@/lib/gmail";
import { categorize } from "@/lib/categorize";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q?.trim()) {
    return NextResponse.json({ error: "q param required" }, { status: 400 });
  }

  const emails = await searchEmails(session.accessToken, q);
  return NextResponse.json(categorize(emails));
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/emails/route.ts app/api/actions/route.ts app/api/unsubscribe/route.ts app/api/search/route.ts
git commit -m "feat: emails, actions, unsubscribe, and search API routes"
```

---

### Task 11: Sidebar component

**Files:**

- Create: `components/inbox/Sidebar.tsx`

- [ ] **Step 1: Write Sidebar**

```tsx
// components/inbox/Sidebar.tsx
import type { Category, CategoryGroup } from "@/types";

interface SidebarProps {
  categories: CategoryGroup[];
  activeCategory: Category;
  total: number;
  totalUnread: number;
  onSelect: (cat: Category) => void;
}

export default function Sidebar({
  categories,
  activeCategory,
  total,
  totalUnread,
  onSelect,
}: SidebarProps) {
  return (
    <div
      style={{
        width: "240px",
        minWidth: "240px",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, paddingTop: "24px" }}>
        <div className="label" style={{ padding: "0 20px 14px" }}>
          Categories
        </div>
        {categories.map((cat) => {
          const active = cat.name === activeCategory;
          return (
            <div
              key={cat.name}
              onClick={() => onSelect(cat.name)}
              style={{
                padding: "11px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                background: active ? "var(--sidebar-active-bg)" : "transparent",
                borderLeft: active
                  ? "2px solid var(--sidebar-active-border)"
                  : "2px solid transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "13px",
              }}
            >
              <span
                style={{
                  fontStyle: cat.name === "Uncategorized" ? "italic" : "normal",
                }}
              >
                {cat.name}
              </span>
              {cat.totalUnread > 0 && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--text-muted)",
                    background: "var(--bg-hover)",
                    padding: "1px 7px",
                  }}
                >
                  {cat.totalUnread}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{ borderTop: "1px solid var(--divider)", padding: "16px 20px" }}
      >
        <div className="label" style={{ marginBottom: "5px" }}>
          All Mail
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          {total} total · {totalUnread} unread
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inbox/Sidebar.tsx
git commit -m "feat: Sidebar component"
```

---

### Task 12: SenderRow component

**Files:**

- Create: `components/inbox/SenderRow.tsx`

- [ ] **Step 1: Write SenderRow**

```tsx
// components/inbox/SenderRow.tsx
"use client";

import { useState } from "react";
import type { Sender } from "@/types";

interface SenderRowProps {
  sender: Sender;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onMarkRead: () => void;
  onUnsubscribe: () => void;
  onAction: (action: "archive" | "delete" | "spam") => void;
}

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function SenderRow({
  sender,
  selected,
  onSelect,
  onMarkRead,
  onUnsubscribe,
  onAction,
}: SenderRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isAllRead = sender.unreadCount === 0;

  return (
    <div
      style={{
        padding: "9px 0",
        borderBottom: "1px solid var(--divider)",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        opacity: isAllRead ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
        style={{
          width: "13px",
          height: "13px",
          flexShrink: 0,
          cursor: "pointer",
          accentColor: "var(--text-muted)",
        }}
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: "13px",
            color: "var(--text-primary)",
            flexShrink: 0,
          }}
        >
          {sender.displayName}
        </span>
        <span
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            flexShrink: 0,
          }}
        >
          {sender.emailCount} email{sender.emailCount !== 1 ? "s" : ""}
          {sender.unreadCount > 0 && (
            <>
              {" "}
              ·{" "}
              <span style={{ color: "var(--text-secondary)" }}>
                {sender.unreadCount} unread
              </span>
            </>
          )}
          {isAllRead && " · all read"}
        </span>
        <span
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            fontStyle: "italic",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          "{sender.snippet}"
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: "6px",
          flexShrink: 0,
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            marginRight: "4px",
          }}
        >
          {timeAgo(sender.mostRecent)}
        </span>
        {sender.unreadCount > 0 && (
          <button onClick={onMarkRead} style={{ fontSize: "10px" }}>
            read
          </button>
        )}
        {sender.listUnsubscribe && !sender.isUnsubscribed && (
          <button onClick={onUnsubscribe} style={{ fontSize: "10px" }}>
            unsub
          </button>
        )}
        {sender.isUnsubscribed && (
          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
            unsubscribed
          </span>
        )}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            style={{ fontSize: "10px" }}
          >
            ···
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                background: "var(--bg-container)",
                border: "1px solid var(--border)",
                zIndex: 20,
                minWidth: "110px",
              }}
            >
              {(["archive", "delete", "spam"] as const).map((a) => (
                <div
                  key={a}
                  onClick={() => {
                    onAction(a);
                    setMenuOpen(false);
                  }}
                  style={{
                    padding: "7px 12px",
                    fontSize: "11px",
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {a}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/inbox/SenderRow.tsx
git commit -m "feat: SenderRow component"
```

---

### Task 13: BulkActionBar, SearchBar, SenderList

**Files:**

- Create: `components/inbox/BulkActionBar.tsx`
- Create: `components/inbox/SearchBar.tsx`
- Create: `components/inbox/SenderList.tsx`

- [ ] **Step 1: Write BulkActionBar**

```tsx
// components/inbox/BulkActionBar.tsx
interface BulkActionBarProps {
  count: number;
  onMarkRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onSpam: () => void;
  onUnsubscribe: () => void;
}

export default function BulkActionBar({
  count,
  onMarkRead,
  onArchive,
  onDelete,
  onSpam,
  onUnsubscribe,
}: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        padding: "10px 32px",
        background: "var(--bg-container)",
        display: "flex",
        gap: "10px",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
        {count} selected —
      </span>
      {(
        [
          ["mark read", onMarkRead],
          ["archive", onArchive],
          ["delete", onDelete],
          ["spam", onSpam],
          ["unsubscribe", onUnsubscribe],
        ] as [string, () => void][]
      ).map(([label, handler]) => (
        <button key={label} onClick={handler} style={{ fontSize: "11px" }}>
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write SearchBar**

```tsx
// components/inbox/SearchBar.tsx
"use client";

import { useState } from "react";

interface SearchBarProps {
  onLocalSearch: (query: string) => void;
  onGlobalSearch: (query: string) => void;
  onClear: () => void;
}

export default function SearchBar({
  onLocalSearch,
  onGlobalSearch,
  onClear,
}: SearchBarProps) {
  const [value, setValue] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    onLocalSearch(e.target.value);
    if (!e.target.value) onClear();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && value.trim()) onGlobalSearch(value.trim());
    if (e.key === "Escape") {
      setValue("");
      onClear();
    }
  }

  return (
    <input
      type="search"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="search (Enter = global)..."
      style={{ width: "200px", fontSize: "11px", padding: "4px 8px" }}
    />
  );
}
```

- [ ] **Step 3: Write SenderList**

```tsx
// components/inbox/SenderList.tsx
"use client";

import { useState } from "react";
import type { CategoryGroup, Sender } from "@/types";
import SenderRow from "./SenderRow";
import SearchBar from "./SearchBar";

interface SenderListProps {
  group: CategoryGroup;
  onAction: (emailIds: string[], action: string) => void;
  onUnsubscribe: (sender: Sender) => void;
  selectedDomains: Set<string>;
  onSelectDomain: (domain: string, selected: boolean) => void;
  onGlobalSearch: (query: string) => void;
}

export default function SenderList({
  group,
  onAction,
  onUnsubscribe,
  selectedDomains,
  onSelectDomain,
  onGlobalSearch,
}: SenderListProps) {
  const [localQuery, setLocalQuery] = useState("");
  const [markAllConfirm, setMarkAllConfirm] = useState(false);

  const filtered = localQuery
    ? group.senders.filter(
        (s) =>
          s.displayName.toLowerCase().includes(localQuery.toLowerCase()) ||
          s.domain.toLowerCase().includes(localQuery.toLowerCase()),
      )
    : group.senders;

  const allEmailIds = group.senders.flatMap((s) => s.emailIds);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 32px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div>
          <span className="label">{group.name}</span>
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              marginLeft: "12px",
            }}
          >
            {group.senders.length} sender{group.senders.length !== 1 ? "s" : ""}{" "}
            · {group.totalUnread} unread
          </span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <SearchBar
            onLocalSearch={setLocalQuery}
            onGlobalSearch={onGlobalSearch}
            onClear={() => setLocalQuery("")}
          />
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMarkAllConfirm(true)}
              style={{ fontSize: "10px" }}
            >
              mark all read
            </button>
            {markAllConfirm && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 6px)",
                  background: "var(--bg-container)",
                  border: "1px solid var(--border)",
                  padding: "7px 12px",
                  whiteSpace: "nowrap",
                  zIndex: 10,
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                }}
              >
                <span
                  style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                >
                  mark {group.totalUnread} as read?
                </span>
                <button
                  onClick={() => {
                    onAction(allEmailIds, "markRead");
                    setMarkAllConfirm(false);
                  }}
                  style={{ fontSize: "11px", color: "var(--text-primary)" }}
                >
                  yes
                </button>
                <button
                  onClick={() => setMarkAllConfirm(false)}
                  style={{ fontSize: "11px" }}
                >
                  cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rows */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 32px",
          borderTop: "1px solid var(--divider)",
        }}
      >
        {filtered.map((sender) => (
          <SenderRow
            key={sender.domain}
            sender={sender}
            selected={selectedDomains.has(sender.domain)}
            onSelect={(sel) => onSelectDomain(sender.domain, sel)}
            onMarkRead={() => onAction(sender.emailIds, "markRead")}
            onUnsubscribe={() => onUnsubscribe(sender)}
            onAction={(a) => onAction(sender.emailIds, a)}
          />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              padding: "24px 0",
              color: "var(--text-muted)",
              fontSize: "12px",
            }}
          >
            No senders found.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/inbox/BulkActionBar.tsx components/inbox/SearchBar.tsx components/inbox/SenderList.tsx
git commit -m "feat: BulkActionBar, SearchBar, SenderList components"
```

---

### Task 14: InboxLayout + inbox page

**Files:**

- Create: `components/inbox/InboxLayout.tsx`
- Create: `app/inbox/page.tsx`

- [ ] **Step 1: Write InboxLayout**

```tsx
// components/inbox/InboxLayout.tsx
"use client";

import { useState } from "react";
import type { Category, CategoryGroup, GroupedInbox, Sender } from "@/types";
import Sidebar from "./Sidebar";
import SenderList from "./SenderList";
import BulkActionBar from "./BulkActionBar";
import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";

interface InboxLayoutProps {
  initial: GroupedInbox;
  email: string;
}

function getClaudeHeaders(): HeadersInit {
  if (typeof window === "undefined") return {};
  const key = localStorage.getItem("anthropic_api_key") ?? "";
  const enabled = localStorage.getItem("claude_enabled") === "true";
  return key && enabled
    ? { "x-claude-key": key, "x-claude-enabled": "true" }
    : {};
}

export default function InboxLayout({ initial, email }: InboxLayoutProps) {
  const [data, setData] = useState<GroupedInbox>(initial);
  const [activeCategory, setActiveCategory] = useState<Category>("Jobs");
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(
    new Set(),
  );
  const [syncing, setSyncing] = useState(false);

  const activeGroup: CategoryGroup =
    data.categories.find((c) => c.name === activeCategory) ??
    data.categories[0];

  function handleSelectDomain(domain: string, selected: boolean) {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      selected ? next.add(domain) : next.delete(domain);
      return next;
    });
  }

  async function handleSync() {
    setSyncing(true);
    const res = await fetch("/api/emails", { headers: getClaudeHeaders() });
    const fresh: GroupedInbox = await res.json();
    setData(fresh);
    setSelectedDomains(new Set());
    setSyncing(false);
  }

  async function handleAction(emailIds: string[], action: string) {
    if (action.startsWith("globalSearch:")) return; // handled in handleGlobalSearch
    await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, emailIds }),
    });
    handleSync();
  }

  async function handleGlobalSearch(query: string) {
    setSyncing(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const result: GroupedInbox = await res.json();
    setData(result);
    setSyncing(false);
  }

  async function handleUnsubscribe(sender: Sender) {
    await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailIds: sender.emailIds,
        fromAddress: sender.fromAddress,
        listUnsubscribe: sender.listUnsubscribe,
      }),
    });
    handleSync();
  }

  const selectedSenders = activeGroup.senders.filter((s) =>
    selectedDomains.has(s.domain),
  );
  const selectedEmailIds = selectedSenders.flatMap((s) => s.emailIds);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Top bar */}
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "13px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--bg-container)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "14px",
            color: "var(--text-primary)",
            letterSpacing: "1px",
          }}
        >
          inbox zero
        </span>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {email}
          </span>
          <ThemeToggle />
          <Link href="/settings">
            <button style={{ fontSize: "11px" }}>⚙ settings</button>
          </Link>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ fontSize: "11px" }}
          >
            {syncing ? "syncing..." : "↻ sync"}
          </button>
        </div>
      </div>

      {/* Two-panel body */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar
          categories={data.categories}
          activeCategory={activeCategory}
          total={data.total}
          totalUnread={data.totalUnread}
          onSelect={(cat) => {
            setActiveCategory(cat);
            setSelectedDomains(new Set());
          }}
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <SenderList
            group={activeGroup}
            onAction={handleAction}
            onUnsubscribe={handleUnsubscribe}
            selectedDomains={selectedDomains}
            onSelectDomain={handleSelectDomain}
            onGlobalSearch={handleGlobalSearch}
          />
          <BulkActionBar
            count={selectedDomains.size}
            onMarkRead={() => handleAction(selectedEmailIds, "markRead")}
            onArchive={() => handleAction(selectedEmailIds, "archive")}
            onDelete={() => handleAction(selectedEmailIds, "delete")}
            onSpam={() => handleAction(selectedEmailIds, "spam")}
            onUnsubscribe={() =>
              selectedSenders.forEach((s) => handleUnsubscribe(s))
            }
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write inbox page**

```tsx
// app/inbox/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { fetchAllEmails } from "@/lib/gmail";
import { categorize } from "@/lib/categorize";
import InboxLayout from "@/components/inbox/InboxLayout";

export default async function InboxPage() {
  const session = await auth();
  if (!session?.accessToken) redirect("/");

  const emails = await fetchAllEmails(session.accessToken);
  const grouped = categorize(emails);

  return <InboxLayout initial={grouped} email={session.user?.email ?? ""} />;
}
```

- [ ] **Step 3: Run dev server and test full flow**

```bash
npm run dev
```

1. Go to http://localhost:3000
2. Enter site password → continue
3. Sign in with Google → complete OAuth
4. Confirm you land on `/inbox` with real Gmail data grouped by category

- [ ] **Step 4: Commit**

```bash
git add components/inbox/InboxLayout.tsx app/inbox/page.tsx
git commit -m "feat: InboxLayout and inbox page — full UI wired up"
```

---

### Task 15: Settings page

**Files:**

- Create: `app/settings/page.tsx`

- [ ] **Step 1: Write settings page**

```tsx
// app/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [apiKey, setApiKey] = useState("");
  const [claudeEnabled, setClaudeEnabled] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setApiKey(localStorage.getItem("anthropic_api_key") ?? "");
    setClaudeEnabled(localStorage.getItem("claude_enabled") === "true");
  }, []);

  function save() {
    localStorage.setItem("anthropic_api_key", apiKey);
    localStorage.setItem("claude_enabled", String(claudeEnabled));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <main style={{ padding: "40px 48px", maxWidth: "540px" }}>
      <div style={{ marginBottom: "24px" }}>
        <Link
          href="/inbox"
          style={{ fontSize: "11px", color: "var(--text-muted)" }}
        >
          ← back to inbox
        </Link>
      </div>
      <h1
        style={{
          fontSize: "14px",
          color: "var(--text-primary)",
          letterSpacing: "1px",
          marginBottom: "32px",
        }}
      >
        settings
      </h1>

      <section
        style={{ borderTop: "1px solid var(--divider)", padding: "20px 0" }}
      >
        <div className="label" style={{ marginBottom: "12px" }}>
          Account
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            marginBottom: "12px",
          }}
        >
          {session?.user?.email ?? "Not connected"}
        </div>
        <button onClick={() => signOut({ callbackUrl: "/" })}>
          disconnect →
        </button>
      </section>

      <section
        style={{ borderTop: "1px solid var(--divider)", padding: "20px 0" }}
      >
        <div className="label" style={{ marginBottom: "4px" }}>
          Theme
        </div>
        <div style={{ marginTop: "10px" }}>
          <ThemeToggle />
        </div>
      </section>

      <section
        style={{ borderTop: "1px solid var(--divider)", padding: "20px 0" }}
      >
        <div className="label" style={{ marginBottom: "4px" }}>
          Claude AI categorization
        </div>
        <p
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            marginBottom: "14px",
          }}
        >
          Optional. Categorizes Uncategorized emails using Claude Haiku. API key
          stored in localStorage only — never sent to our server except to proxy
          to Anthropic.
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "14px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={claudeEnabled}
            onChange={(e) => setClaudeEnabled(e.target.checked)}
          />
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            Enable Claude categorization
          </span>
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          style={{ marginBottom: "12px", maxWidth: "360px" }}
        />
        <br />
        <button onClick={save} style={{ marginTop: "4px" }}>
          {saved ? "saved ✓" : "save →"}
        </button>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat: settings page"
```

---

### Task 16: Run all tests + deploy to Vercel

**Files:** No new files.

- [ ] **Step 1: Run full test suite**

```bash
npm run test:run
```

Expected: All tests pass (categorize + unsubscribe unit tests).

- [ ] **Step 2: Build check**

```bash
npm run build
```

Fix any TypeScript errors before proceeding.

- [ ] **Step 3: Push to GitHub**

Create a GitHub repo at github.com/new, then:

```bash
git remote add origin https://github.com/<your-username>/inbox-zero.git
git push -u origin main
```

- [ ] **Step 4: Deploy to Vercel**

```bash
npx vercel --prod
```

Or connect via Vercel dashboard → Import Git Repository.

- [ ] **Step 5: Set environment variables in Vercel**

In Vercel project → Settings → Environment Variables, add:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `SITE_PASSWORD`
- `NEXTAUTH_URL` = `https://<your-app>.vercel.app`

- [ ] **Step 6: Update Google OAuth redirect URI**

In Google Cloud Console → APIs & Services → Credentials → your OAuth client → Authorized redirect URIs, add:

```
https://<your-app>.vercel.app/api/auth/callback/google
```

- [ ] **Step 7: Verify production**

Navigate to your Vercel URL. Complete the full flow: password → Google OAuth → inbox with live Gmail data.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: production deployment ready"
```
