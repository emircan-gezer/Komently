// app/api/comments/vote/route.ts
// POST /api/comments/vote — cast, change, or retract a vote
//
// Headers:
//   x-commenter-token: <JWT>          (required)
//
// Body (JSON):
//   { commentId: string, value: 1 | -1 }
//
// Behavior:
//   • If no existing vote → insert with given value
//   • If existing vote matches value → delete (toggle off)
//   • If existing vote differs → update to new value

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { verifyCommenterToken } from "@/lib/commenter-auth";
import { cookies } from "next/headers";
import { z } from "zod";

// ── Zod schema ────────────────────────────────────────────────────────────────

const VoteSchema = z.object({
  commentId: z
    .string()
    .uuid("commentId must be a valid UUID"),
  value: z.union([z.literal(1), z.literal(-1)]),
});

export async function POST(request: NextRequest) {
  // 1 — auth
  const commenter = await verifyCommenterToken(request);
  if (!commenter) {
    return NextResponse.json(
      { error: "Missing or invalid x-commenter-token" },
      { status: 401 }
    );
  }

  // 2 — parse body
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 3 — validate with Zod
  const parsed = VoteSchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Validation error";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { commentId, value } = parsed.data;

  const cookieStore = await cookies();
  const adminClient = await supabase(cookieStore);

  // 4 — check if comment exists
  const { data: comment, error: cErr } = await adminClient
    .from("comments")
    .select("id")
    .eq("id", commentId)
    .eq("is_deleted", false)
    .single();

  if (cErr || !comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // 5 — look up existing vote
  const { data: existing } = await adminClient
    .from("votes")
    .select("value")
    .eq("commenter_id", commenter.commenterId)
    .eq("comment_id", commentId)
    .maybeSingle();

  let action: "inserted" | "removed" | "updated";

  if (!existing) {
    const { error: insErr } = await adminClient
      .from("votes")
      .insert({ commenter_id: commenter.commenterId, comment_id: commentId, value });
    if (insErr) {
      return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
    }
    action = "inserted";
  } else if (existing.value === value) {
    const { error: delErr } = await adminClient
      .from("votes")
      .delete()
      .eq("commenter_id", commenter.commenterId)
      .eq("comment_id", commentId);
    if (delErr) {
      return NextResponse.json({ error: "Failed to retract vote" }, { status: 500 });
    }
    action = "removed";
  } else {
    const { error: updErr } = await adminClient
      .from("votes")
      .update({ value })
      .eq("commenter_id", commenter.commenterId)
      .eq("comment_id", commentId);
    if (updErr) {
      return NextResponse.json({ error: "Failed to update vote" }, { status: 500 });
    }
    action = "updated";
  }

  // 6 — return fresh counts
  const { data: counts } = await adminClient
    .from("comment_vote_counts")
    .select("likes, dislikes")
    .eq("comment_id", commentId)
    .maybeSingle();

  return NextResponse.json({
    commentId,
    action,
    myVote: action === "removed" ? 0 : value,
    likes: counts?.likes ?? 0,
    dislikes: counts?.dislikes ?? 0,
  });
}