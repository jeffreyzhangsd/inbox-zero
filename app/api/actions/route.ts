// app/api/actions/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { batchModify, batchDelete } from "@/lib/gmail";
import { cookies } from "next/headers";
import {
  resolveActiveToken,
  EXTRA_ACCOUNTS_COOKIE,
  ACTIVE_ACCOUNT_COOKIE,
  ACCOUNT_COOKIE_OPTS,
} from "@/lib/accounts";

type Action =
  | "markRead"
  | "markUnread"
  | "archive"
  | "delete"
  | "spam"
  | "moveToFolder";

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
    action: Action;
    emailIds: string[];
    labelId?: string;
  };
  const { action, emailIds, labelId } = body;

  switch (action) {
    case "markRead":
      await batchModify(accessToken, emailIds, [], ["UNREAD"]);
      break;
    case "markUnread":
      await batchModify(accessToken, emailIds, ["UNREAD"], []);
      break;
    case "archive":
      await batchModify(accessToken, emailIds, [], ["INBOX"]);
      break;
    case "delete":
      await batchDelete(accessToken, emailIds);
      break;
    case "spam":
      await batchModify(accessToken, emailIds, ["SPAM"], ["INBOX"]);
      break;
    case "moveToFolder":
      if (!labelId)
        return NextResponse.json(
          { error: "labelId required" },
          { status: 400 },
        );
      await batchModify(accessToken, emailIds, [labelId], ["INBOX"]);
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
