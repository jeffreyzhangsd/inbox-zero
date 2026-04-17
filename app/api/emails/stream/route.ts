// app/api/emails/stream/route.ts
import { auth } from "@/auth";
import { getGmailClient, listMessagePage, fetchEmailChunk } from "@/lib/gmail";

// First page small → fast initial render. Subsequent pages max out Gmail's list limit.
const FIRST_PAGE_SIZE = 50;
const PAGE_SIZE = 500;
// Chunk size for metadata fetches and delay between chunks (safe rate ~12 req/sec)
const CHUNK = 5;
const DELAY_MS = 400;

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const accessToken = session.accessToken;
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

        // Paginate through the rest of the inbox
        let pageToken = first.nextPageToken;
        while (pageToken) {
          const page = await listMessagePage(gmail, {
            maxResults: PAGE_SIZE,
            pageToken,
          });
          await streamIds(page.ids, false);
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
