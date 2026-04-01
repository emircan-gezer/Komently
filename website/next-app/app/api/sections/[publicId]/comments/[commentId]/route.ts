// app/api/sections/[publicId]/comments/[commentId]/route.ts
// PATCH /api/sections/:publicId/comments/:commentId — update comment moderation status
// DELETE /api/sections/:publicId/comments/:commentId — soft delete
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
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string, commentId: string }> }
) {
  const { publicId, commentId } = await params;
  const owner = await getOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  if (!body.moderation_status) {
    return NextResponse.json({ error: "Missing moderation_status" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const adminClient = await supabase(cookieStore);

  // Verify ownership of the section
  const { data: section } = await adminClient
    .from("comment_sections")
    .select("id")
    .eq("public_id", publicId)
    .eq("owner_id", owner.id)
    .single();

  if (!section) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  // Verify comment belongs to section and update
  const { data: updated, error: updErr } = await adminClient
    .from("comments")
    .update({ moderation_status: body.moderation_status, updated_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("section_id", section.id)
    .select("*")
    .single();

  if (updErr || !updated) {
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }

  return NextResponse.json({ comment: updated });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ publicId: string, commentId: string }> }
  ) {
    const { publicId, commentId } = await params;
    const owner = await getOwner(request);
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  
    const cookieStore = await cookies();
    const adminClient = await supabase(cookieStore);
  
    // Verify ownership
    const { data: section } = await adminClient
      .from("comment_sections")
      .select("id")
      .eq("public_id", publicId)
      .eq("owner_id", owner.id)
      .single();
  
    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }
  
    // Soft delete
    const { error: delErr } = await adminClient
      .from("comments")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("id", commentId)
      .eq("section_id", section.id);
  
    if (delErr) {
      return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
    }
  
    return NextResponse.json({ success: true });
}
