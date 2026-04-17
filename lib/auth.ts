// lib/auth.ts
import { createHash } from "crypto";

const GATE_COOKIE = "gate_token";

export function expectedGateToken(): string {
  return createHash("sha256")
    .update(process.env.SITE_PASSWORD! + process.env.AUTH_SECRET!)
    .digest("hex");
}

export { GATE_COOKIE };
