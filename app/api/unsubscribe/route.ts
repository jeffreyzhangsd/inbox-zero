// app/api/unsubscribe/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendEmail, createSpamFilter } from "@/lib/gmail";
import { parseListUnsubscribe } from "@/lib/unsubscribe";
import { cookies } from "next/headers";
import {
  resolveActiveToken,
  EXTRA_ACCOUNTS_COOKIE,
  ACTIVE_ACCOUNT_COOKIE,
  ACCOUNT_COOKIE_OPTS,
} from "@/lib/accounts";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const { accessToken, updatedExtraAccounts } = await resolveActiveToken({
    primaryEmail: session.user?.email ?? "",
    primaryAccessToken: session.accessToken,
    activeAccountEmail: cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value,
    extraAccountsEncrypted: cookieStore.get(EXTRA_ACCOUNTS_COOKIE)?.value,
  });
  if (updatedExtraAccounts) {
    cookieStore.set(
      EXTRA_ACCOUNTS_COOKIE,
      updatedExtraAccounts,
      ACCOUNT_COOKIE_OPTS,
    );
  }

  const body = (await request.json()) as {
    emailIds: string[];
    fromAddress: string;
    listUnsubscribe?: string;
  };
  const { emailIds, fromAddress, listUnsubscribe } = body;
  const target = parseListUnsubscribe(listUnsubscribe);

  if (target) {
    try {
      if (target.url) {
        await fetch(target.url, { method: "POST" }).catch(() =>
          fetch(target.url!, { method: "GET" }),
        );
      } else if (target.mailto) {
        await sendEmail(
          accessToken,
          target.mailto,
          "Unsubscribe",
          "Please unsubscribe me from this mailing list.",
        );
      }
    } catch {
      // Trigger failed — proceed to create filter anyway
    }
  }

  // Create a filter so future emails from this sender skip the inbox
  await createSpamFilter(accessToken, fromAddress);

  return NextResponse.json({ ok: true });
}
