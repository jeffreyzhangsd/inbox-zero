// app/api/gate/route.ts
import { NextResponse } from "next/server";
import { createHash } from "crypto";
import type { NextRequest } from "next/server";

const GATE_COOKIE = "gate_token";

function expectedToken(): string {
  return createHash("sha256")
    .update(process.env.SITE_PASSWORD! + process.env.AUTH_SECRET!)
    .digest("hex");
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(GATE_COOKIE)?.value;
  if (token === expectedToken()) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { password } = body as { password: string };

  if (password !== process.env.SITE_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(GATE_COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
