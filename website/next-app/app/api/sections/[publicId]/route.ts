// app/api/sections/[publicId]/route.ts
// GET   /api/sections/:publicId — get detail for a specific section
// PATCH /api/sections/:publicId — update settings/metadata
//
// Authentication: Supabase Auth session (site owner)

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabase } from "@/lib/supabase/server";
import { z } from "zod";

// ── Zod schema ────────────────────────────────────────────────────────────────

const PatchSectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "name must be at least 1 character")
    .max(80, "name must be at most 80 characters")
    .optional(),
  status: z
    .enum(["active", "paused"], { message: "status must be 'active' or 'paused'" })
    .optional(),
  settings: z
    .object({
      max_chars: z
        .number()
        .int()
        .min(1, "max_chars must be at least 1")
        .max(50_000, "max_chars must be at most 50 000")
        .optional(),
      blacklist: z
        .array(z.string().max(100, "blacklist term cannot exceed 100 chars"))
        .max(500, "blacklist may contain at most 500 terms")
        .optional(),
      ai_moderation_enabled: z.boolean().optional(),
      ai_toxicity_threshold: z
        .number()
        .min(0, "threshold must be >= 0")
        .max(1, "threshold must be <= 1")
        .optional(),
      rate_limit_seconds: z
        .number()
        .int()
        .min(0)
        .max(3600)
        .optional(),
      spam_guard_enabled: z.boolean().optional(),
      context_analyzer_enabled: z.boolean().optional(),
      sentiment_analysis_enabled: z.boolean().optional(),
      auto_action_strikes: z.number().int().min(0).max(10).optional(),
    })
    .optional(),
}).strict(); // reject unknown keys

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getOwner(request: NextRequest) {
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: async () => {
          const cookieStore = await cookies();
          return cookieStore.getAll();
        },
        setAll: () => {},
      },
    }
  );
  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params;
  const owner = await getOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const adminClient = await supabase(cookieStore);

  const { data: section, error } = await adminClient
    .from("comment_sections")
    .select("*")
    .eq("public_id", publicId)
    .eq("owner_id", owner.id)
    .single();

  if (error || !section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  return NextResponse.json({ section });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params;
  const owner = await getOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse + validate body
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSectionSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Validation error";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const body = parsed.data;

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const adminClient = await supabase(cookieStore);

  // 1. Verify ownership
  const { data: existing, error: vErr } = await adminClient
    .from("comment_sections")
    .select("id, settings")
    .eq("public_id", publicId)
    .eq("owner_id", owner.id)
    .single();

  if (vErr || !existing) {
    return NextResponse.json({ error: "Section not found or unauthorized" }, { status: 404 });
  }

  // 2. Build update payload
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.status !== undefined) updates.status = body.status;
  if (body.settings !== undefined) {
    // Deep merge into existing settings so partial patches work
    updates.settings = {
      ...((existing.settings as Record<string, unknown>) ?? {}),
      ...body.settings,
    };
  }

  const { data: updated, error: uErr } = await adminClient
    .from("comment_sections")
    .update(updates)
    .eq("id", existing.id)
    .select("*")
    .single();

  if (uErr) {
    console.error("Update section error:", uErr);
    return NextResponse.json({ error: "Failed to update section" }, { status: 500 });
  }

  return NextResponse.json({ section: updated });
}
