// app/api/comments/[publicId]/post/route.ts
// POST /api/comments/:publicId/post — create a new comment or reply
//
// Headers:
//   x-commenter-token: <JWT>          (required)
//
// Body (JSON):
//   { body: string, parentId?: string }

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { verifyCommenterToken } from "@/lib/commenter-auth";
import { cookies } from "next/headers";
import { z } from "zod";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const PostCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(10_000, "Comment must be at most 10 000 characters"),
  parentId: z
    .string()
    .uuid("parentId must be a valid UUID")
    .optional(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ publicId: string }> }
) {
    const { publicId } = await params;

    // 1 — auth
    const commenter = await verifyCommenterToken(request);
    if (!commenter) {
        return NextResponse.json(
            { error: "Missing or invalid x-commenter-token" },
            { status: 401 }
        );
    }

    // 2 — parse + validate body with Zod
    let body: string, parentId: string | undefined;
    try {
        const json = await request.json();
        const parsed = PostCommentSchema.safeParse(json);
        if (!parsed.success) {
            const message = parsed.error.issues[0]?.message ?? "Validation error";
            return NextResponse.json({ error: message }, { status: 422 });
        }
        body = parsed.data.body;
        parentId = parsed.data.parentId;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const adminClient = await supabase(cookieStore);

    // 3 — resolve section & settings
    const { data: section, error: sErr } = await adminClient
        .from("comment_sections")
        .select("id, settings")
        .eq("public_id", publicId)
        .single();

    if (sErr || !section) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const settings = (section.settings as any) || {};

    // ── Anti-Spam (Critical) ───────────────────────────────────────────────────

    // 1. Rate Limiting (1 comment per 10s by default)
    const rateLimitSeconds = settings.rate_limit_seconds ?? 10;
    const { data: recentComments } = await adminClient
        .from("comments")
        .select("created_at")
        .eq("commenter_id", commenter.commenterId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (recentComments?.[0]) {
        const lastPostTime = new Date(recentComments[0].created_at).getTime();
        const now = Date.now();
        if (now - lastPostTime < rateLimitSeconds * 1000) {
            return NextResponse.json(
                { error: `Please wait ${rateLimitSeconds} seconds between comments` },
                { status: 429 }
            );
        }
    }

    // 2. Duplicate Detection (check last 3 comments for exact body match)
    const { data: lastFew } = await adminClient
        .from("comments")
        .select("body")
        .eq("commenter_id", commenter.commenterId)
        .order("created_at", { ascending: false })
        .limit(3);

    const isDuplicate = lastFew?.some(c => c.body.trim().toLowerCase() === body.toLowerCase());
    if (isDuplicate) {
        return NextResponse.json(
            { error: "Duplicate comment detected" },
            { status: 422 }
        );
    }

    // ── Pre-moderation / Validation Based on Section Settings ──────────────────

    // 1. Max Characters
    const maxChars = settings.max_chars ?? 5000;
    if (body.length > maxChars) {
        return NextResponse.json(
            { error: `Comment is too long (max ${maxChars} characters)` },
            { status: 422 }
        );
    }

    // 2. Blacklist (improved with word boundaries)
    const blacklist = settings.blacklist ?? [];
    const hit = blacklist.find((word: string) => {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        return regex.test(body);
    });

    if (hit) {
        return NextResponse.json(
            { error: "Comment contains prohibited language" },
            { status: 422 }
        );
    }

    // 4 — validate parent comment exists in same section (if replying)
    if (parentId) {
        const { data: parent, error: pErr } = await adminClient
            .from("comments")
            .select("id, section_id")
            .eq("id", parentId)
            .single();

        if (pErr || !parent || parent.section_id !== section.id) {
            return NextResponse.json(
                { error: "Parent comment not found in this section" },
                { status: 404 }
            );
        }
    }

    // 5 — insert comment
    const { data: inserted, error: iErr } = await adminClient
        .from("comments")
        .insert({
            section_id: section.id,
            commenter_id: commenter.commenterId,
            parent_id: parentId ?? null,
            body,
            moderation_status: 'pending',
        })
        .select(`
            id, parent_id, body, created_at,
            commenters!comments_commenter_id_fkey ( username, avatar_initial, color )
        `)
        .single();

    if (iErr || !inserted) {
        console.error("insert comment error:", iErr);
        return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }

    const c = inserted as any;

    // trigger async AI moderation (non-blocking)
    import("@/lib/ai/moderator").then(({ processCommentModeration }) => {
        processCommentModeration(inserted.id, body, c.parent_id);
    });

    return NextResponse.json(
        {
            id: c.id,
            parentId: c.parent_id,
            body: c.body,
            createdAt: c.created_at,
            likes: 0,
            dislikes: 0,
            myVote: 0,
            author: {
                username: c.commenters.username,
                avatarInitial: c.commenters.avatar_initial,
                color: c.commenters.color,
            },
        },
        { status: 201 }
    );
}