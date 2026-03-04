// lib/commenter-auth.ts
// Helpers for issuing and verifying x-commenter-token JWTs.
// These tokens identify a commenter (visitor) — not a site owner.

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const SECRET = new TextEncoder().encode(
    process.env.COMMENTER_JWT_SECRET ?? "change-me-in-production"
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
    const token = request.headers.get("x-commenter-token");
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, SECRET);
        if (typeof (payload as CommenterPayload).commenterId !== "string") return null;
        return payload as CommenterPayload;
    } catch {
        return null;
    }
}
