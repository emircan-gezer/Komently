// lib/commenter-auth.ts
// Helpers for issuing and verifying x-commenter-token JWTs.
// These tokens identify a commenter (visitor) — not a site owner.

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// ── Guard: fail loudly at startup if secret is not configured ─────────────────
const rawSecret = process.env.COMMENTER_JWT_SECRET;
if (!rawSecret && process.env.NODE_ENV === "production") {
  throw new Error(
    "[commenter-auth] COMMENTER_JWT_SECRET env var is not set. " +
      "Set it to a strong random value before deploying."
  );
}

const SECRET = new TextEncoder().encode(
  rawSecret ?? "dev-only-secret-CHANGE-ME"
);

const ALG = "HS256";

export interface CommenterPayload extends JWTPayload {
  commenterId: string;
}

/** Issue a signed commenter token (call from your register/login endpoint). */
export async function signCommenterToken(commenterId: string): Promise<string> {
  return new SignJWT({ commenterId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

/** Verify and decode a commenter token from request headers. Returns null on failure. */
export async function verifyCommenterToken(
  request: Request
): Promise<CommenterPayload | null> {
  // Accept both "x-commenter-token" (canonical) and "X-Commenter-Token" (case-normalised)
  const token =
    request.headers.get("x-commenter-token") ??
    request.headers.get("X-Commenter-Token");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (typeof (payload as CommenterPayload).commenterId !== "string") return null;
    return payload as CommenterPayload;
  } catch {
    return null;
  }
}
