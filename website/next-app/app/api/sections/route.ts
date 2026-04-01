// app/api/sections/route.ts
// GET  /api/sections — list all sections owned by the authed user + aggregate stats
// POST /api/sections — create a new comment section
//
// Authentication: Supabase Auth session (site owner, not commenter)

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabase } from "@/lib/supabase/server";
import { z } from "zod";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const CreateSectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "name must be at least 1 character")
    .max(80, "name must be at most 80 characters"),
  publicId: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "publicId is required")
    .max(64, "publicId must be at most 64 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "publicId must contain only lowercase letters, numbers, and hyphens"
    ),
});

// ── Auth helper: resolve the calling site owner ───────────────────────────────

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
        setAll: () => {}, // read-only in route handlers
      },
    }
  );
  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
}

// ── GET — list sections + aggregate stats ────────────────────────────────────

export async function GET(request: NextRequest) {
  const owner = await getOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cookieStore = await cookies();
  const adminClient = await supabase(cookieStore);

  // Fetch sections owned by this user
  const { data: rawSections, error: sErr } = await adminClient
    .from("comment_sections")
    .select("id, public_id, name, status, created_at")
    .eq("owner_id", owner.id)
    .order("created_at", { ascending: false });

  if (sErr) {
    return NextResponse.json({ error: "Failed to load sections" }, { status: 500 });
  }

  if (!rawSections || rawSections.length === 0) {
    return NextResponse.json({
      sections: [],
      stats: { totalComments: 0, activeSections: 0, totalReactions: 0, newThisWeek: 0 },
    });
  }

  const sectionIds = rawSections.map((s: any) => s.id);

  // Fetch aggregates in parallel
  const [commentCountsResult, reactionCountsResult, latestCommentsResult, recentCommentsResult] =
    await Promise.all([
      adminClient
        .from("comments")
        .select("section_id")
        .in("section_id", sectionIds)
        .eq("is_deleted", false),
      adminClient
        .from("votes")
        .select("comment_id, comments!inner(section_id)")
        .in("comments.section_id", sectionIds),
      adminClient
        .from("comments")
        .select("section_id, created_at")
        .in("section_id", sectionIds)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
      adminClient
        .from("comments")
        .select("section_id")
        .in("section_id", sectionIds)
        .eq("is_deleted", false)
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        ),
    ]);

  // Build maps for O(1) lookup
  const countMap = new Map<string, number>();
  const reactionMap = new Map<string, number>();
  const lastMap = new Map<string, string>();

  for (const row of commentCountsResult.data ?? []) {
    countMap.set(row.section_id, (countMap.get(row.section_id) ?? 0) + 1);
  }
  for (const row of (reactionCountsResult.data ?? []) as any[]) {
    const sid = row.comments?.section_id;
    if (sid) reactionMap.set(sid, (reactionMap.get(sid) ?? 0) + 1);
  }
  // latestComments is already ordered desc — first occurrence per section = latest
  for (const row of latestCommentsResult.data ?? []) {
    if (!lastMap.has(row.section_id)) lastMap.set(row.section_id, row.created_at);
  }

  const sections = rawSections.map((s: any) => ({
    id: s.id,
    public_id: s.public_id,
    name: s.name,
    status: s.status ?? "active",
    created_at: s.created_at,
    commentCount: countMap.get(s.id) ?? 0,
    reactionCount: reactionMap.get(s.id) ?? 0,
    lastActive: lastMap.get(s.id) ?? null,
  }));

  const totalComments = sections.reduce((a: number, s: any) => a + s.commentCount, 0);
  const activeSections = sections.filter((s: any) => s.status === "active").length;
  const totalReactions = sections.reduce((a: number, s: any) => a + s.reactionCount, 0);
  const newThisWeek = (recentCommentsResult.data ?? []).length;

  return NextResponse.json({
    sections,
    stats: { totalComments, activeSections, totalReactions, newThisWeek },
  });
}

// ── POST — create section ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const owner = await getOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate body with Zod
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateSectionSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Validation error";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { name, publicId } = parsed.data;

  const cookieStore = await cookies();
  const adminClient = await supabase(cookieStore);

  // Check uniqueness
  const { data: existing } = await adminClient
    .from("comment_sections")
    .select("id")
    .eq("public_id", publicId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "A section with that publicId already exists" },
      { status: 409 }
    );
  }

  const { data: section, error: iErr } = await adminClient
    .from("comment_sections")
    .insert({ public_id: publicId, name, owner_id: owner.id, status: "active" })
    .select("id, public_id, name, status, created_at")
    .single();

  if (iErr || !section) {
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 });
  }

  return NextResponse.json(
    { ...section, commentCount: 0, reactionCount: 0, lastActive: null },
    { status: 201 }
  );
}