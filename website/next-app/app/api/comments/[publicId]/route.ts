// app/api/comments/[publicId]/route.ts
// GET  /api/comments/:publicId  — paginated, sorted, threaded comments
// Includes the requesting commenter's existing vote per comment (if token provided).

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { verifyCommenterToken } from "@/lib/commenter-auth";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CommentOut {
    id: string;
    author: { username: string; avatarInitial: string; color: string };
    body: string;
    likes: number;
    dislikes: number;
    myVote: 1 | -1 | 0;   // current commenter's vote (0 = none)
    createdAt: string;
    replies?: CommentOut[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildTree(
    rows: RawComment[],
    voteMap: Map<string, 1 | -1>,
    parentId: string | null,
    depth: number,
    maxDepth: number
): CommentOut[] {
    if (depth > maxDepth) return [];

    return rows
        .filter((r) => r.parent_id === parentId)
        .map((r) => ({
            id: r.id,
            author: {
                username: r.commenters.username,
                avatarInitial: r.commenters.avatar_initial,
                color: r.commenters.color,
            },
            body: r.is_deleted ? "[deleted]" : r.body,
            likes: r.likes ?? 0,
            dislikes: r.dislikes ?? 0,
            myVote: voteMap.get(r.id) ?? 0,
            createdAt: r.created_at,
            replies: buildTree(rows, voteMap, r.id, depth + 1, maxDepth),
        }));
}

interface RawComment {
    id: string;
    parent_id: string | null;
    body: string;
    is_deleted: boolean;
    created_at: string;
    likes: number | null;
    dislikes: number | null;
    commenters: { username: string; avatar_initial: string; color: string };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ publicId: string }> }
) {
    const { publicId } = await params;
    const sp = request.nextUrl.searchParams;

    const pageSize = Math.min(parseInt(sp.get("pageSize") ?? "10"), 20);
    const replyDepth = Math.min(parseInt(sp.get("replyDepth") ?? "2"), 3);
    const sorting = sp.get("sorting") ?? "top";
    const page = Math.max(parseInt(sp.get("page") ?? "1"), 1);

    // 1 — resolve section
    const { data: section, error: sErr } = await supabase
        .from("comment_sections")
        .select("id")
        .eq("public_id", publicId)
        .single();

    if (sErr || !section) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // 2 — fetch ALL top-level comment IDs for pagination (no body yet)
    let orderCol = "created_at";
    let ascending = false;
    if (sorting === "old") { orderCol = "created_at"; ascending = true; }
    if (sorting === "new") { orderCol = "created_at"; ascending = false; }
    // "top" sorting is applied after aggregating vote counts (post-fetch)

    const { data: topIds, error: topErr } = await supabase
        .from("comments")
        .select("id, created_at")
        .eq("section_id", section.id)
        .is("parent_id", null)
        .eq("is_deleted", false);

    if (topErr) {
        return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }

    // 3 — fetch vote counts for top-level IDs to enable "top" sort
    const topIdList = (topIds ?? []).map((r) => r.id);

    const { data: topVotes } = await supabase
        .from("comment_vote_counts")
        .select("comment_id, likes, dislikes")
        .in("comment_id", topIdList.length ? topIdList : ["__none__"]);

    const voteCountMap = new Map<string, { likes: number; dislikes: number }>();
    for (const v of topVotes ?? []) {
        voteCountMap.set(v.comment_id, { likes: v.likes, dislikes: v.dislikes });
    }

    // sort top-level IDs
    let sortedTopIds = [...topIdList];
    if (sorting === "top") {
        sortedTopIds.sort((a, b) => {
            const sa = (voteCountMap.get(a)?.likes ?? 0) - (voteCountMap.get(a)?.dislikes ?? 0);
            const sb = (voteCountMap.get(b)?.likes ?? 0) - (voteCountMap.get(b)?.dislikes ?? 0);
            return sb - sa;
        });
    } else if (sorting === "new") {
        const dateMap = new Map((topIds ?? []).map((r) => [r.id, r.created_at]));
        sortedTopIds.sort((a, b) =>
            new Date(dateMap.get(b)!).getTime() - new Date(dateMap.get(a)!).getTime()
        );
    } else {
        const dateMap = new Map((topIds ?? []).map((r) => [r.id, r.created_at]));
        sortedTopIds.sort((a, b) =>
            new Date(dateMap.get(a)!).getTime() - new Date(dateMap.get(b)!).getTime()
        );
    }

    const totalCount = sortedTopIds.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const pagedTopIds = sortedTopIds.slice((page - 1) * pageSize, page * pageSize);

    if (pagedTopIds.length === 0) {
        return NextResponse.json({
            publicId, sorting, pageSize, replyDepth, page,
            totalCount, totalPages, comments: [],
        });
    }

    // 4 — recursive fetch: get all descendants of paged top-level comments
    //     We use a recursive CTE via rpc, or fetch level-by-level (simpler, no RPC needed).
    const allIds = new Set<string>(pagedTopIds);
    let currentParents = new Set(pagedTopIds);

    for (let d = 0; d < replyDepth; d++) {
        if (currentParents.size === 0) break;
        const { data: children } = await supabase
            .from("comments")
            .select("id")
            .in("parent_id", [...currentParents]);
        const childIds = (children ?? []).map((r) => r.id);
        childIds.forEach((id) => allIds.add(id));
        currentParents = new Set(childIds);
    }

    // 5 — bulk fetch all relevant comments with commenter info + vote counts
    const { data: rawComments, error: rcErr } = await supabase
        .from("comments")
        .select(`
            id, parent_id, body, is_deleted, created_at,
            commenters ( username, avatar_initial, color ),
            comment_vote_counts ( likes, dislikes )
        `)
        .in("id", [...allIds]);

    if (rcErr) {
        return NextResponse.json({ error: "Failed to fetch comment details" }, { status: 500 });
    }

    // 6 — resolve commenter's own votes (if authenticated)
    const commenter = await verifyCommenterToken(request);
    const voteMap = new Map<string, 1 | -1>();

    if (commenter) {
        const { data: myVotes } = await supabase
            .from("votes")
            .select("comment_id, value")
            .eq("commenter_id", commenter.commenterId)
            .in("comment_id", [...allIds]);

        for (const v of myVotes ?? []) {
            voteMap.set(v.comment_id, v.value as 1 | -1);
        }
    }

    // 7 — flatten raw rows and build tree
    const flat: RawComment[] = (rawComments ?? []).map((r: any) => ({
        id: r.id,
        parent_id: r.parent_id,
        body: r.body,
        is_deleted: r.is_deleted,
        created_at: r.created_at,
        likes: r.comment_vote_counts?.likes ?? 0,
        dislikes: r.comment_vote_counts?.dislikes ?? 0,
        commenters: r.commenters,
    }));

    // Order tree roots according to sorted page order
    const idOrder = new Map(pagedTopIds.map((id, i) => [id, i]));
    const sortedFlat = flat.slice().sort((a, b) => {
        const ai = idOrder.get(a.id) ?? 999;
        const bi = idOrder.get(b.id) ?? 999;
        return ai - bi;
    });

    const comments = buildTree(sortedFlat, voteMap, null, 0, replyDepth);

    return NextResponse.json({
        publicId, sorting, pageSize, replyDepth, page,
        totalCount, totalPages, comments,
    });
}