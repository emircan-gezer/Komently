// app/api/commenters/me/update/route.ts
// POST /api/commenters/me/update — update the calling commenter's profile
//
// Headers:
//   x-commenter-token: <JWT>  (required)
//
// Body (JSON):
//   { username: string }

import { NextRequest, NextResponse } from "next/server";
import { verifyCommenterToken, signCommenterToken } from "@/lib/commenter-auth";
import { supabase } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { z } from "zod";

// ── Zod schema ────────────────────────────────────────────────────────────────

const UpdateProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "username must be at least 2 characters")
    .max(32, "username must be at most 32 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "username may only contain letters, numbers, underscores, and hyphens"
    ),
});

export async function POST(request: NextRequest) {
  // 1 — auth
  const commenter = await verifyCommenterToken(request);
  if (!commenter) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2 — parse + validate body
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = UpdateProfileSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Validation error";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { username } = parsed.data;

  const cookieStore = await cookies();
  const adminClient = await supabase(cookieStore);

  // 3 — check username uniqueness (exclude own record)
  const { data: conflict } = await adminClient
    .from("commenters")
    .select("id")
    .eq("username", username)
    .neq("id", commenter.commenterId)
    .maybeSingle();

  if (conflict) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  // 4 — update
  const { data: updated, error: updateError } = await adminClient
    .from("commenters")
    .update({ username })
    .eq("id", commenter.commenterId)
    .select("id, username, color, avatar_initial")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  // Re-issue token (future-proof if we ever embed username in payload)
  const token = await signCommenterToken(commenter.commenterId);

  return NextResponse.json({ success: true, commenter: updated, token });
}
