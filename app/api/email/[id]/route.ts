import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchEmailBody } from "@/lib/gmail";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await fetchEmailBody(session.accessToken, id);
  return NextResponse.json(body);
}
