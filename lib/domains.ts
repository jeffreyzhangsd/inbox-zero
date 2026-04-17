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

  // GitHub
  "github.com": "GitHub",
  "githubapp.com": "GitHub",
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
