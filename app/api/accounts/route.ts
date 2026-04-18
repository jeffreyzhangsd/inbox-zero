import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import {
  decryptAccounts,
  EXTRA_ACCOUNTS_COOKIE,
  ACTIVE_ACCOUNT_COOKIE,
} from "@/lib/accounts";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const primaryEmail = session.user?.email ?? "";
  const accounts = [primaryEmail, ...extra.map((a) => a.email)].filter(Boolean);
  const cookieActive = cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value;
  // Validate active against known accounts; fall back to primary
  const active =
    cookieActive && accounts.includes(cookieActive)
      ? cookieActive
      : primaryEmail;

  return NextResponse.json({ accounts, active });
}
