// app/api/commenters/register/route.ts
// POST /api/commenters/register — create a new commenter identity and return a JWT
//
// Body (JSON):
//   { username: string, color?: string }
//
// Returns:
//   { commenterId, token }

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { signCommenterToken } from "@/lib/commenter-auth";
import { cookies } from "next/headers";
import { z } from "zod";

// ── Zod schema ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#7c3aed", "#0891b2", "#059669", "#dc2626",
  "#d97706", "#be185d", "#0284c7",
] as const;

// Hex color regex
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const RegisterSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "username must be at least 2 characters")
    .max(32, "username must be at most 32 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "username may only contain letters, numbers, underscores, and hyphens"
    ),
  color: z
    .string()
    .regex(HEX_COLOR_RE, "color must be a valid hex color (e.g. #7c3aed)")
    .optional(),
});

function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export async function POST(request: NextRequest) {
  // Parse body
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate with Zod
  const parsed = RegisterSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Validation error";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { username, color = randomColor() } = parsed.data;

  const cookieStore = await cookies();
  const adminClient = await supabase(cookieStore);

  // Check username uniqueness
  const { data: existing } = await adminClient
    .from("commenters")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const { data: commenter, error } = await adminClient
    .from("commenters")
    .insert({ username, color })
    .select("id")
    .single();

  if (error || !commenter) {
    return NextResponse.json({ error: "Failed to create commenter" }, { status: 500 });
  }

  const token = await signCommenterToken(commenter.id);

  return NextResponse.json({ commenterId: commenter.id, token }, { status: 201 });
}