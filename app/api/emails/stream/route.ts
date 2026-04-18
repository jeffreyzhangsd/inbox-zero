// app/api/emails/stream/route.ts
import { auth } from "@/auth";
import { getGmailClient, listMessagePage, fetchEmailChunk } from "@/lib/gmail";
import { cookies } from "next/headers";
import {
  resolveActiveToken,
  EXTRA_ACCOUNTS_COOKIE,
  ACTIVE_ACCOUNT_COOKIE,
  ACCOUNT_COOKIE_OPTS,
} from "@/lib/accounts";

// First page small → fast initial render. Remaining pages fill up to EMAIL_CAP total.
const FIRST_PAGE_SIZE = 50;
const PAGE_SIZE = 500;
const EMAIL_CAP = 1000;
// Chunk size for metadata fetches and delay between chunks (~40 req/sec, under Gmail's 50/sec quota)
const CHUNK = 10;
const DELAY_MS = 250;

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response("Unauthorized", { status: 401 });
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      async function streamIds(ids: string[], firstBatch: boolean) {
        for (let i = 0; i < ids.length; i += CHUNK) {
          // Skip delay on the very first chunk so first emails appear instantly
          if (!firstBatch || i > 0) {
            await new Promise((r) => setTimeout(r, DELAY_MS));
          }
          const emails = await fetchEmailChunk(gmail, ids.slice(i, i + CHUNK));
          send({ type: "batch", emails });
        }
      }

      const gmail = getGmailClient(accessToken);

      try {
        // First page: small for fast initial display
        const first = await listMessagePage(gmail, {
          maxResults: FIRST_PAGE_SIZE,
        });
        await streamIds(first.ids, true);

        // Paginate until EMAIL_CAP reached or inbox exhausted
        let pageToken = first.nextPageToken;
        let fetched = first.ids.length;
        while (pageToken && fetched < EMAIL_CAP) {
          const remaining = EMAIL_CAP - fetched;
          const page = await listMessagePage(gmail, {
            maxResults: Math.min(PAGE_SIZE, remaining),
            pageToken,
          });
          await streamIds(page.ids, false);
          fetched += page.ids.length;
          pageToken = page.nextPageToken;
        }

        send({ type: "done" });
      } catch (err) {
        send({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
