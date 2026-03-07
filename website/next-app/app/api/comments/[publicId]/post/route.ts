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

    // 2 — parse body
    let body: string, parentId: string | undefined;
    try {
        const json = await request.json();
        body = (json.body ?? "").toString().trim();
        parentId = json.parentId ?? undefined;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || body.length < 1 || body.length > 10000) {
        return NextResponse.json(
            { error: "body must be between 1 and 10 000 characters" },
            { status: 422 }
        );
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

    // ── Pre-moderation / Validation Based on Section Settings ──────────────────

    // 1. Max Characters
    const maxChars = settings.max_chars ?? 5000;
    if (body.length > maxChars) {
        return NextResponse.json(
            { error: `Comment is too long (max ${maxChars} characters)` },
            { status: 422 }
        );
    }

    // 2. Blacklist
    const blacklist = settings.blacklist ?? [];
    const lowerBody = body.toLowerCase();
    const hit = blacklist.find((word: string) => lowerBody.includes(word.toLowerCase()));
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
        processCommentModeration(inserted.id, body);
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