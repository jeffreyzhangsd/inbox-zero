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

// Known 2-part TLDs where we need 3 parts for the root domain
const TWO_PART_TLDS = new Set([
  "co.uk",
  "co.jp",
  "co.au",
  "com.au",
  "co.nz",
  "co.za",
  "co.in",
  "com.sg",
  "com.br",
  "co.kr",
  "co.id",
  "co.th",
]);

// Domains where we don't collapse subdomains — each subdomain (or address) is its own sender group
const NO_COLLAPSE_ROOTS = new Set([
  "google.com",
  "microsoft.com",
  "apple.com",
  "amazon.com",
  "yahoo.com",
  "meta.com",
  "facebook.com",
]);

function rootDomain(domain: string): string {
  if (!domain) return domain;
  const parts = domain.split(".");
  if (parts.length <= 2) return domain;
  const tld2 = parts.slice(-2).join(".");
  return TWO_PART_TLDS.has(tld2)
    ? parts.slice(-3).join(".")
    : parts.slice(-2).join(".");
}

// Returns the grouping key for a sender. For platform domains (google.com etc.),
// keeps full subdomain or email address so unrelated services don't merge.
function groupingKey(domain: string, address: string): string {
  if (!domain) return address;
  const root = rootDomain(domain);
  if (NO_COLLAPSE_ROOTS.has(root)) {
    // Has a meaningful subdomain → group by full domain (e.g. careers.google.com)
    if (domain !== root) return domain;
    // No subdomain (e.g. @google.com) → group by full email address
    return address;
  }
  return root;
}

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
  const overrideKey = groupingKey(email.fromDomain, email.fromAddress);
  if (overrides?.has(overrideKey)) return overrides.get(overrideKey)!;

  // Address-level match (most specific, e.g. careersatgoogle@google.com → Jobs)
  const domainCat = getDomainCategory(email.fromDomain, email.fromAddress);
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
  // Single global pass: group all emails by root domain
  const domainMap = new Map<
    string,
    { sender: Sender; votes: Map<Category, number> }
  >();

  for (const email of emails) {
    const key = groupingKey(email.fromDomain, email.fromAddress);
    const category = assignCategory(email, overrides);
    const entry = domainMap.get(key);

    if (entry) {
      const { sender, votes } = entry;
      sender.emailCount += 1;
      if (!email.isRead) sender.unreadCount += 1;
      if (email.date > sender.mostRecent) {
        sender.mostRecent = email.date;
        sender.snippet = email.snippet;
        sender.fromAddress = email.fromAddress;
      }
      if (sender.displayName.includes("@") && !email.fromName.includes("@")) {
        sender.displayName = email.fromName;
      }
      if (!sender.listUnsubscribe && email.listUnsubscribe) {
        sender.listUnsubscribe = email.listUnsubscribe;
      }
      sender.emailIds.push(email.id);
      sender.emails.push(email);
      votes.set(category, (votes.get(category) ?? 0) + 1);
    } else {
      domainMap.set(key, {
        sender: {
          domain: key,
          displayName: email.fromName,
          fromAddress: email.fromAddress,
          emailCount: 1,
          unreadCount: email.isRead ? 0 : 1,
          mostRecent: email.date,
          snippet: email.snippet,
          listUnsubscribe: email.listUnsubscribe,
          isUnsubscribed: email.labelIds.includes("inbox-zero/unsubscribed"),
          emailIds: [email.id],
          emails: [email],
        },
        votes: new Map([[category, 1]]),
      });
    }
  }

  // Assign each sender to its plurality category
  const categoryBuckets = new Map<Category, Sender[]>();
  for (const cat of ALL_CATEGORIES) categoryBuckets.set(cat, []);

  for (const { sender, votes } of domainMap.values()) {
    let winner: Category = "Uncategorized";
    let max = 0;
    for (const cat of ALL_CATEGORIES) {
      const n = votes.get(cat) ?? 0;
      if (n > max) {
        max = n;
        winner = cat;
      }
    }
    categoryBuckets.get(winner)!.push(sender);
  }

  let total = 0;
  let totalUnread = 0;

  const categories: CategoryGroup[] = ALL_CATEGORIES.map((name) => {
    const senders = categoryBuckets
      .get(name)!
      .sort((a, b) => b.mostRecent - a.mostRecent);
    const catUnread = senders.reduce((sum, s) => sum + s.unreadCount, 0);
    total += senders.reduce((sum, s) => sum + s.emailCount, 0);
    totalUnread += catUnread;
    return { name, senders, totalUnread: catUnread };
  });

  return { categories, total, totalUnread };
}
