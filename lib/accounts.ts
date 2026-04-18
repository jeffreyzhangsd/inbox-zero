import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export interface AccountToken {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
}

export const EXTRA_ACCOUNTS_COOKIE = "extra-accounts";
export const ACTIVE_ACCOUNT_COOKIE = "active-account";
export const ACCOUNT_ADD_STATE_COOKIE = "account-add-state";

export const ACCOUNT_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60,
  path: "/",
} as const;

function getSecret(): Buffer {
  const secret = process.env.ACCOUNTS_SECRET;
  if (!secret) throw new Error("ACCOUNTS_SECRET env var is required");
  const key = Buffer.from(secret, "hex");
  if (key.length !== 32)
    throw new Error("ACCOUNTS_SECRET must be 64 hex chars (32 bytes)");
  return key;
}

export function encryptAccounts(accounts: AccountToken[]): string {
  const key = getSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const json = JSON.stringify(accounts);
  const encrypted = Buffer.concat([
    cipher.update(json, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Layout: iv(24 hex) + tag(32 hex) + ciphertext(hex)
  return iv.toString("hex") + tag.toString("hex") + encrypted.toString("hex");
}

export function decryptAccounts(encoded: string): AccountToken[] {
  if (encoded.length < 56)
    throw new Error("Invalid extra-accounts cookie: too short");
  const key = getSecret();
  const iv = Buffer.from(encoded.slice(0, 24), "hex");
  const tag = Buffer.from(encoded.slice(24, 56), "hex");
  const ciphertext = Buffer.from(encoded.slice(56), "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as AccountToken[];
}

export async function resolveActiveToken(params: {
  primaryEmail: string;
  primaryAccessToken: string;
  activeAccountEmail: string | undefined;
  extraAccountsEncrypted: string | undefined;
}): Promise<{ accessToken: string; updatedExtraAccounts?: string }> {
  const {
    primaryEmail,
    primaryAccessToken,
    activeAccountEmail,
    extraAccountsEncrypted,
  } = params;

  const activeEmail = activeAccountEmail ?? primaryEmail;

  if (activeEmail === primaryEmail) {
    return { accessToken: primaryAccessToken };
  }

  if (!extraAccountsEncrypted) {
    return { accessToken: primaryAccessToken };
  }

  let accounts: AccountToken[];
  try {
    accounts = decryptAccounts(extraAccountsEncrypted);
  } catch {
    return { accessToken: primaryAccessToken };
  }

  const account = accounts.find((a) => a.email === activeEmail);
  if (!account) {
    return { accessToken: primaryAccessToken };
  }

  // Valid token — return as-is
  if (account.expiresAt > Date.now() + 60_000) {
    return { accessToken: account.accessToken };
  }

  // Expired — attempt refresh
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: account.refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };

    const updatedAccount = {
      ...account,
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    const updatedAccounts = accounts.map((a) =>
      a.email === updatedAccount.email ? updatedAccount : a,
    );
    const updatedExtraAccounts = encryptAccounts(updatedAccounts);
    return { accessToken: data.access_token, updatedExtraAccounts };
  } catch {
    return { accessToken: account.accessToken };
  }
}
