// app/inbox/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchAllEmails } from "@/lib/gmail";
import { categorize } from "@/lib/categorize";
import InboxLayout from "@/components/inbox/InboxLayout";

export default async function InboxPage() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect("/");
  }

  const emails = await fetchAllEmails(session.accessToken);
  const groupedInbox = categorize(emails);

  return <InboxLayout initialData={groupedInbox} />;
}
