// app/api/actions/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { batchModify, batchDelete } from "@/lib/gmail";

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

  const body = (await request.json()) as {
    action: Action;
    emailIds: string[];
    labelId?: string;
  };
  const { action, emailIds, labelId } = body;

  switch (action) {
    case "markRead":
      await batchModify(session.accessToken, emailIds, [], ["UNREAD"]);
      break;
    case "markUnread":
      await batchModify(session.accessToken, emailIds, ["UNREAD"], []);
      break;
    case "archive":
      await batchModify(session.accessToken, emailIds, [], ["INBOX"]);
      break;
    case "delete":
      await batchDelete(session.accessToken, emailIds);
      break;
    case "spam":
      await batchModify(session.accessToken, emailIds, ["SPAM"], ["INBOX"]);
      break;
    case "moveToFolder":
      if (!labelId)
        return NextResponse.json(
          { error: "labelId required" },
          { status: 400 },
        );
      await batchModify(session.accessToken, emailIds, [labelId], ["INBOX"]);
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
