import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { ACCOUNT_ADD_STATE_COOKIE } from "@/lib/accounts";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://mail.google.com/",
].join(" ");

export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const session = await auth();
  if (!session) return NextResponse.redirect(`${baseUrl}/`);

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(ACCOUNT_ADD_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${baseUrl}/api/accounts/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
