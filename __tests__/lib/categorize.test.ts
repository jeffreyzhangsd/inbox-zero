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
    date: new Date("2026-04-15").getTime(),
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
        date: new Date("2026-04-14").getTime(),
      }),
      makeEmail({
        id: "2",
        fromDomain: "linkedin.com",
        fromAddress: "a@linkedin.com",
        date: new Date("2026-04-15").getTime(),
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
