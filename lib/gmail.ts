// lib/gmail.ts
import { google } from "googleapis";
import type { Email } from "@/types";
import { parseFromHeader } from "@/lib/categorize";

function getClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

async function fetchAllMessageIds(
  gmail: ReturnType<typeof getClient>,
): Promise<string[]> {
  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 500,
    q: "in:inbox",
  });
  return (res.data.messages ?? []).map((m) => m.id!);
}

async function fetchEmailMetadata(
  gmail: ReturnType<typeof getClient>,
  ids: string[],
): Promise<Email[]> {
  const CHUNK = 10;
  const emails: Email[] = [];

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    if (i > 0) await new Promise((r) => setTimeout(r, 200));
    const results = await Promise.all(
      chunk.map((id) =>
        gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "List-Unsubscribe"],
        }),
      ),
    );

    for (const res of results) {
      const msg = res.data;
      const headers = msg.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value ?? "";

      const from = getHeader("From");
      const parsed = parseFromHeader(from);
      const labelIds = msg.labelIds ?? [];

      emails.push({
        id: msg.id!,
        threadId: msg.threadId!,
        from,
        ...parsed,
        subject: getHeader("Subject"),
        snippet: msg.snippet ?? "",
        isRead: !labelIds.includes("UNREAD"),
        date: parseInt(msg.internalDate ?? "0"),
        labelIds,
        listUnsubscribe: getHeader("List-Unsubscribe") || undefined,
      });
    }
  }

  return emails;
}

export async function fetchAllEmails(accessToken: string): Promise<Email[]> {
  const gmail = getClient(accessToken);
  const ids = await fetchAllMessageIds(gmail);
  return fetchEmailMetadata(gmail, ids);
}

export async function batchModify(
  accessToken: string,
  ids: string[],
  addLabelIds: string[],
  removeLabelIds: string[],
): Promise<void> {
  const gmail = getClient(accessToken);
  await gmail.users.messages.batchModify({
    userId: "me",
    requestBody: { ids, addLabelIds, removeLabelIds },
  });
}

export async function batchDelete(
  accessToken: string,
  ids: string[],
): Promise<void> {
  const gmail = getClient(accessToken);
  await gmail.users.messages.batchDelete({
    userId: "me",
    requestBody: { ids },
  });
}

export async function sendEmail(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  const gmail = getClient(accessToken);
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain",
    "",
    body,
  ].join("\r\n");
  const raw = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

export async function createSpamFilter(
  accessToken: string,
  fromAddress: string,
): Promise<void> {
  const gmail = getClient(accessToken);
  await gmail.users.settings.filters.create({
    userId: "me",
    requestBody: {
      criteria: { from: fromAddress },
      action: { addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] },
    },
  });
}

export async function searchEmails(
  accessToken: string,
  query: string,
): Promise<Email[]> {
  const gmail = getClient(accessToken);
  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 100,
  });
  const ids = (res.data.messages ?? []).map((m) => m.id!);
  if (ids.length === 0) return [];
  return fetchEmailMetadata(gmail, ids);
}
