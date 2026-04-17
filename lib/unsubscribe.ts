// lib/unsubscribe.ts

export interface UnsubscribeTarget {
  mailto?: string;
  url?: string;
}

export function parseListUnsubscribe(
  header: string | undefined,
): UnsubscribeTarget | null {
  if (!header) return null;

  const mailtoMatch = header.match(/<mailto:([^>]+)>/i);
  const urlMatch = header.match(/<(https?:\/\/[^>]+)>/i);

  if (!mailtoMatch && !urlMatch) return null;

  return {
    mailto: mailtoMatch?.[1],
    url: urlMatch?.[1],
  };
}
