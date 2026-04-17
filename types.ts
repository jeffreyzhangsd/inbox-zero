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
  date: number; // Unix ms timestamp
  labelIds: string[];
  listUnsubscribe?: string; // raw List-Unsubscribe header value if present
}

export interface Sender {
  domain: string;
  displayName: string; // best guess display name from emails
  fromAddress: string; // most common from address for this domain
  emailCount: number;
  unreadCount: number;
  mostRecent: number; // Unix ms timestamp
  snippet: string; // snippet from most recent email
  listUnsubscribe?: string;
  isUnsubscribed: boolean; // has inbox-zero/unsubscribed label
  emailIds: string[];
  emails: Email[];
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

declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
  }
}
