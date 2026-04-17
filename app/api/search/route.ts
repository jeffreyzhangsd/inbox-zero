// app/api/search/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchEmails } from "@/lib/gmail";
import { categorize } from "@/lib/categorize";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q?.trim()) {
    return NextResponse.json({ error: "q param required" }, { status: 400 });
  }

  const emails = await searchEmails(session.accessToken, q);
  return NextResponse.json(categorize(emails));
}
