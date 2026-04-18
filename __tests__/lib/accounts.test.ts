import { describe, it, expect, beforeAll, vi } from "vitest";
import { randomBytes } from "crypto";

process.env.ACCOUNTS_SECRET = randomBytes(32).toString("hex");
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

import {
  encryptAccounts,
  decryptAccounts,
  resolveActiveToken,
  type AccountToken,
} from "@/lib/accounts";

function makeAccount(
  email: string,
  overrides: Partial<AccountToken> = {},
): AccountToken {
  return {
    email,
    accessToken: `at-${email}`,
    refreshToken: `rt-${email}`,
    expiresAt: Date.now() + 3_600_000,
    ...overrides,
  };
}

describe("encryptAccounts / decryptAccounts", () => {
  it("roundtrips an empty array", () => {
    expect(decryptAccounts(encryptAccounts([]))).toEqual([]);
  });

  it("roundtrips account tokens", () => {
    const accounts = [makeAccount("a@gmail.com"), makeAccount("b@gmail.com")];
    expect(decryptAccounts(encryptAccounts(accounts))).toEqual(accounts);
  });

  it("produces different ciphertext on each call", () => {
    const accounts = [makeAccount("a@gmail.com")];
    expect(encryptAccounts(accounts)).not.toBe(encryptAccounts(accounts));
  });

  it("throws on tampered ciphertext", () => {
    const enc = encryptAccounts([makeAccount("a@gmail.com")]);
    const tampered = enc.slice(0, -4) + "0000";
    expect(() => decryptAccounts(tampered)).toThrow();
  });
});

describe("resolveActiveToken", () => {
  const primaryEmail = "primary@gmail.com";
  const primaryToken = "primary-access-token";
  const secondary = makeAccount("secondary@gmail.com");
  let extraEncrypted: string;

  beforeAll(() => {
    extraEncrypted = encryptAccounts([secondary]);
  });

  it("returns primary token when no active account cookie", async () => {
    const result = await resolveActiveToken({
      primaryEmail,
      primaryAccessToken: primaryToken,
      activeAccountEmail: undefined,
      extraAccountsEncrypted: undefined,
    });
    expect(result.accessToken).toBe(primaryToken);
    expect(result.updatedExtraAccounts).toBeUndefined();
  });

  it("returns primary token when active account matches primary", async () => {
    const result = await resolveActiveToken({
      primaryEmail,
      primaryAccessToken: primaryToken,
      activeAccountEmail: primaryEmail,
      extraAccountsEncrypted: extraEncrypted,
    });
    expect(result.accessToken).toBe(primaryToken);
  });

  it("returns secondary token for valid non-expired account", async () => {
    const result = await resolveActiveToken({
      primaryEmail,
      primaryAccessToken: primaryToken,
      activeAccountEmail: secondary.email,
      extraAccountsEncrypted: extraEncrypted,
    });
    expect(result.accessToken).toBe(secondary.accessToken);
    expect(result.updatedExtraAccounts).toBeUndefined();
  });

  it("falls back to primary if active account not found", async () => {
    const result = await resolveActiveToken({
      primaryEmail,
      primaryAccessToken: primaryToken,
      activeAccountEmail: "ghost@gmail.com",
      extraAccountsEncrypted: extraEncrypted,
    });
    expect(result.accessToken).toBe(primaryToken);
  });

  it("refreshes expired token and returns updated cookie value", async () => {
    const expired = makeAccount("expired@gmail.com", {
      expiresAt: Date.now() - 1000,
    });
    const expiredEnc = encryptAccounts([expired]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "refreshed-token",
          expires_in: 3600,
        }),
      }),
    );

    const result = await resolveActiveToken({
      primaryEmail,
      primaryAccessToken: primaryToken,
      activeAccountEmail: expired.email,
      extraAccountsEncrypted: expiredEnc,
    });

    expect(result.accessToken).toBe("refreshed-token");
    expect(result.updatedExtraAccounts).toBeDefined();
    const updated = decryptAccounts(result.updatedExtraAccounts!);
    expect(updated[0].accessToken).toBe("refreshed-token");
    vi.unstubAllGlobals();
  });

  it("falls back to stale token if refresh request fails", async () => {
    const expired = makeAccount("expired@gmail.com", {
      expiresAt: Date.now() - 1000,
    });
    const expiredEnc = encryptAccounts([expired]);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ ok: false, status: 400 }),
    );

    const result = await resolveActiveToken({
      primaryEmail,
      primaryAccessToken: primaryToken,
      activeAccountEmail: expired.email,
      extraAccountsEncrypted: expiredEnc,
    });

    expect(result.accessToken).toBe(expired.accessToken);
    vi.unstubAllGlobals();
  });
});
