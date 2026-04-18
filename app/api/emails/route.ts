// app/api/emails/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchAllEmails } from "@/lib/gmail";
import { categorize } from "@/lib/categorize";
import Anthropic from "@anthropic-ai/sdk";
import type { Email, Category } from "@/types";
import { ALL_CATEGORIES } from "@/types";
import { cookies } from "next/headers";
import {
  resolveActiveToken,
  EXTRA_ACCOUNTS_COOKIE,
  ACTIVE_ACCOUNT_COOKIE,
  ACCOUNT_COOKIE_OPTS,
} from "@/lib/accounts";

async function claudeCategorize(
  emails: Email[],
  apiKey: string,
): Promise<Map<string, Category>> {
  const client = new Anthropic({ apiKey });
  const result = new Map<string, Category>();
  const BATCH = 20;

  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH);
    const items = batch
      .map(
        (e, idx) =>
          `${idx + 1}. From: ${e.from} | Subject: ${e.subject} | Snippet: ${e.snippet}`,
      )
      .join("\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Categorize each email into one of: ${ALL_CATEGORIES.filter((c) => c !== "Uncategorized").join(", ")}, or Uncategorized.\nReply with only a JSON array of strings, one per email, in order. No explanation.\n\nEmails:\n${items}`,
        },
      ],
    });

    try {
      const text =
        response.content[0].type === "text" ? response.content[0].text : "[]";
      const categories: string[] = JSON.parse(text);
      batch.forEach((e, idx) => {
        const cat = categories[idx] as Category;
        if (ALL_CATEGORIES.includes(cat)) result.set(e.id, cat);
      });
    } catch {
      // Leave as Uncategorized on parse failure
    }
  }

  return result;
}

export async function GET(request: Request) {
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

  const emails = await fetchAllEmails(accessToken);

  const claudeKey = request.headers.get("x-claude-key");
  const claudeEnabled = request.headers.get("x-claude-enabled") === "true";

  if (claudeKey && claudeEnabled) {
    const uncatIds = new Set(
      categorize(emails)
        .categories.find((c) => c.name === "Uncategorized")
        ?.senders.flatMap((s) => s.emailIds) ?? [],
    );
    const uncEmails = emails.filter((e) => uncatIds.has(e.id));
    if (uncEmails.length > 0) {
      const overrides = await claudeCategorize(uncEmails, claudeKey);
      return NextResponse.json(categorize(emails, overrides));
    }
  }

  return NextResponse.json(categorize(emails));
}
