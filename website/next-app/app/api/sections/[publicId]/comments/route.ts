// app/api/sections/[publicId]/comments/route.ts
// GET /api/sections/:publicId/comments — fetch all comments for dashboard moderation
//
// Authentication: Supabase Auth session (site owner)

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabase } from "@/lib/supabase/server";

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
        setAll: () => { },
      },
    }
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params;
  const owner = await getOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse query params for pagination / filtering
  const searchParams = request.nextUrl.searchParams;
  const statusFilter = searchParams.get("status"); // e.g. 'pending', 'flagged'
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);

  const cookieStore = await cookies();
  const adminClient = await supabase(cookieStore);

  // 1. Verify owner holds this section
  const { data: section, error: secErr } = await adminClient
    .from("comment_sections")
    .select("id")
    .eq("public_id", publicId)
    .eq("owner_id", owner.id)
    .single();

  if (secErr || !section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  // 2. Fetch comments with commenter info
  let query = adminClient
    .from("comments")
    .select(`
        id, 
        body, 
        moderation_status, 
        toxicity_score, 
        is_spam, 
        ai_metadata, 
        created_at,
        is_deleted,
        commenters:commenters!comments_commenter_id_fkey ( id, username, color )
    `, { count: "exact" })
    .eq("section_id", section.id)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("moderation_status", statusFilter);
  }

  // Handle soft-deleted comments (maybe we still want to see them in moderation, but let's exclude for now or filter)
  if (statusFilter !== "deleted") {
    query = query.eq("is_deleted", false);
  } else {
    query = query.eq("is_deleted", true);
  }

  query = query.range(offset, offset + limit - 1);

  const { data: comments, count, error: cErr } = await query;

  if (cErr) {
    console.error("Failed to fetch comments:", cErr);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }

  return NextResponse.json({
    comments: comments || [],
    count: count || 0,
    page: Math.floor(offset / limit) + 1,
    limit
  });
}
