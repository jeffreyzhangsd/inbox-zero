// middleware.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { NextAuthRequest } from "next-auth";

const GATE_COOKIE = "gate_token";

async function expectedToken(): Promise<string> {
  const data = new TextEncoder().encode(
    process.env.SITE_PASSWORD! + process.env.AUTH_SECRET!,
  );
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default auth(async (request: NextAuthRequest) => {
  const gateToken = request.cookies.get(GATE_COOKIE)?.value;
  if (gateToken !== (await expectedToken())) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/inbox/:path*", "/settings/:path*"],
};
