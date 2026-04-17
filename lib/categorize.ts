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
    const existing = senderMap.get(email.fromAddress);

    if (existing) {
      existing.emailCount += 1;
      if (!email.isRead) existing.unreadCount += 1;
      if (email.date > existing.mostRecent) {
        existing.mostRecent = email.date;
        existing.snippet = email.snippet;
      }
      existing.emailIds.push(email.id);
    } else {
      senderMap.set(email.fromAddress, {
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
      (a, b) => b.mostRecent - a.mostRecent,
    );
    const catUnread = senders.reduce((sum, s) => sum + s.unreadCount, 0);
    total += senders.reduce((sum, s) => sum + s.emailCount, 0);
    totalUnread += catUnread;
    return { name, senders, totalUnread: catUnread };
  });

  return { categories, total, totalUnread };
}
