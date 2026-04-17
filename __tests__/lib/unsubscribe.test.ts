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
