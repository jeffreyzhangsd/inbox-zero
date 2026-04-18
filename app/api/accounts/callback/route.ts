import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import {
  encryptAccounts,
  decryptAccounts,
  EXTRA_ACCOUNTS_COOKIE,
  ACTIVE_ACCOUNT_COOKIE,
  ACCOUNT_ADD_STATE_COOKIE,
  ACCOUNT_COOKIE_OPTS,
  type AccountToken,
} from "@/lib/accounts";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const session = await auth();

  if (!session) {
    return NextResponse.redirect(`${baseUrl}/`);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(ACCOUNT_ADD_STATE_COOKIE)?.value;

  // Always clear the state cookie to prevent reuse
  if (storedState) cookieStore.delete(ACCOUNT_ADD_STATE_COOKIE);

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/inbox?error=oauth_failed`);
  }

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${baseUrl}/inbox?error=oauth_state`);
  }

  const redirectUri = `${baseUrl}/api/accounts/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${baseUrl}/inbox?error=oauth_failed`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!tokenData.refresh_token) {
    return NextResponse.redirect(`${baseUrl}/inbox?error=oauth_failed`);
  }

  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(`${baseUrl}/inbox?error=oauth_failed`);
  }

  const userData = (await userRes.json()) as { email?: string };
  if (!userData.email) {
    return NextResponse.redirect(`${baseUrl}/inbox?error=oauth_failed`);
  }

  const newAccount: AccountToken = {
    email: userData.email,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  };

  const extraEncrypted = cookieStore.get(EXTRA_ACCOUNTS_COOKIE)?.value;
  let accounts: AccountToken[] = [];
  if (extraEncrypted) {
    try {
      accounts = decryptAccounts(extraEncrypted);
    } catch {
      // Corrupted cookie — start fresh
    }
  }

  const idx = accounts.findIndex((a) => a.email === newAccount.email);
  if (idx >= 0) accounts[idx] = newAccount;
  else accounts.push(newAccount);

  // Primary account must not appear in extra list
  accounts = accounts.filter((a) => a.email !== session.user?.email);

  cookieStore.set(
    EXTRA_ACCOUNTS_COOKIE,
    encryptAccounts(accounts),
    ACCOUNT_COOKIE_OPTS,
  );
  cookieStore.set(ACTIVE_ACCOUNT_COOKIE, newAccount.email, ACCOUNT_COOKIE_OPTS);

  return NextResponse.redirect(`${baseUrl}/inbox`);
}
