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

    // 3 — resolve section
    const { data: section, error: sErr } = await supabase
        .from("comment_sections")
        .select("id")
        .eq("public_id", publicId)
        .single();

    if (sErr || !section) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // 4 — validate parent comment exists in same section (if replying)
    if (parentId) {
        const { data: parent, error: pErr } = await supabase
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
    const { data: inserted, error: iErr } = await supabase
        .from("comments")
        .insert({
            section_id: section.id,
            commenter_id: commenter.commenterId,
            parent_id: parentId ?? null,
            body,
        })
        .select(`
            id, parent_id, body, created_at,
            commenters ( username, avatar_initial, color )
        `)
        .single();

    if (iErr || !inserted) {
        console.error("insert comment error:", iErr);
        return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
    }

    const c = inserted as any;
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