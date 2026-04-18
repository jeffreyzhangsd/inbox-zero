import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import {
  decryptAccounts,
  EXTRA_ACCOUNTS_COOKIE,
  ACTIVE_ACCOUNT_COOKIE,
  ACCOUNT_COOKIE_OPTS,
} from "@/lib/accounts";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let email: string | undefined;
  try {
    const body = (await request.json()) as { email?: string };
    email = body.email;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const extraEncrypted = cookieStore.get(EXTRA_ACCOUNTS_COOKIE)?.value;
  let extra: { email: string }[] = [];
  if (extraEncrypted) {
    try {
      extra = decryptAccounts(extraEncrypted);
    } catch {
      // Corrupted cookie — treat as no extra accounts
    }
  }

  const valid = [session.user?.email, ...extra.map((a) => a.email)].filter(
    Boolean,
  );
  if (!valid.includes(email)) {
    return NextResponse.json({ error: "Account not found" }, { status: 400 });
  }

  cookieStore.set(ACTIVE_ACCOUNT_COOKIE, email, ACCOUNT_COOKIE_OPTS);
  return NextResponse.json({ ok: true });
}
