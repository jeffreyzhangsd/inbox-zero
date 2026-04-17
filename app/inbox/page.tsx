// app/inbox/page.tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import InboxLayout from "@/components/inbox/InboxLayout";

export default async function InboxPage() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect("/");
  }

  return <InboxLayout />;
}
