// app/api/unsubscribe/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendEmail, createSpamFilter } from "@/lib/gmail";
import { parseListUnsubscribe } from "@/lib/unsubscribe";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
          session.accessToken,
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
  await createSpamFilter(session.accessToken, fromAddress);

  return NextResponse.json({ ok: true });
}
