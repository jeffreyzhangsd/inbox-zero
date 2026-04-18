// lib/domains.ts
import type { Category } from "@/types";

// Maps sender domains to categories.
// Checked before Gmail label fallback.
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
  // Google Careers subdomains
  "careers.google.com": "Jobs",

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

  // GitHub
  "github.com": "GitHub",
  "githubapp.com": "GitHub",

  // Google service subdomains → Updates (security, calendar, workspace)
  "accounts.google.com": "Updates",
  "mail.google.com": "Updates",
  "calendar.google.com": "Updates",
  "workspace.google.com": "Updates",
  "no-reply.accounts.google.com": "Updates",
};

// Maps specific from-addresses to categories.
// Takes priority over domain map. Use for platform senders (google.com, etc.)
// that send from the root domain but serve different purposes by address.
export const ADDRESS_CATEGORY_MAP: Record<string, Category> = {
  // Google job-related addresses
  "careersatgoogle@google.com": "Jobs",
  "no-reply-careers@google.com": "Jobs",
  "googlecareers@google.com": "Jobs",
  // Google security / account alerts
  "no-reply@accounts.google.com": "Updates",
  // Google Calendar notifications
  "calendar-notification@google.com": "Updates",
  "calendar-noreply@google.com": "Updates",
};

export function getDomainCategory(
  domain: string,
  address?: string,
): Category | null {
  // Address-level match wins (most specific)
  if (address && ADDRESS_CATEGORY_MAP[address])
    return ADDRESS_CATEGORY_MAP[address];

  // Exact domain match
  if (DOMAIN_CATEGORY_MAP[domain]) return DOMAIN_CATEGORY_MAP[domain];

  // Strip one subdomain level (e.g. em.linkedin.com → linkedin.com)
  const parts = domain.split(".");
  if (parts.length > 2) {
    const root = parts.slice(-2).join(".");
    if (DOMAIN_CATEGORY_MAP[root]) return DOMAIN_CATEGORY_MAP[root];
  }
  return null;
}
