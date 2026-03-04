"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommentData {
    id: string;
    author: { username: string; avatarInitial: string; color: string };
    body: string;
    likes: number;
    dislikes: number;
    myVote: 1 | -1 | 0;
    createdAt: string;
    replies?: CommentData[];
}

interface ApiResponse {
    comments: CommentData[];
    totalPages: number;
    totalCount: number;
    page: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return "just now";
}

// ── VoteAction ────────────────────────────────────────────────────────────────

function VoteAction({
    active,
    onClick,
    label,
    disabled,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    disabled?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "font-mono text-[10px] px-2 py-0.5 rounded-md border transition-all disabled:cursor-not-allowed",
                active
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-transparent border-transparent text-muted-foreground/50 hover:bg-muted hover:text-foreground"
            )}
        >
            {label}
        </button>
    );
}

// ── ReplyBox ──────────────────────────────────────────────────────────────────

function ReplyBox({
    onSubmit,
    onCancel,
    commenterToken,
}: {
    onSubmit: (body: string) => Promise<void>;
    onCancel: () => void;
    commenterToken: string | null;
}) {
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { textareaRef.current?.focus(); }, []);

    async function handleSubmit() {
        if (!body.trim()) return;
        setLoading(true);
        setError(null);
        try {
            await onSubmit(body.trim());
            setBody("");
        } catch (e: any) {
            setError(e?.message ?? "Failed to post reply");
        } finally {
            setLoading(false);
        }
    }

    if (!commenterToken) {
        return (
            <div className="mt-2 mb-4 text-[11px] text-muted-foreground italic">
                You must be logged in to reply.
            </div>
        );
    }

    return (
        <div className="mt-2 mb-4 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <textarea
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Write a reply…"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            {error && <p className="text-[11px] text-destructive">{error}</p>}
            <div className="flex gap-2">
                <button
                    onClick={handleSubmit}
                    disabled={loading || !body.trim()}
                    className="text-[11px] font-bold px-3 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                    {loading ? "Posting…" : "Reply"}
                </button>
                <button
                    onClick={onCancel}
                    className="text-[11px] font-medium px-3 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// ── CommentNode ───────────────────────────────────────────────────────────────

function CommentNode({
    comment: initialComment,
    depth = 0,
    commenterToken,
    publicId,
    onReplyPosted,
}: {
    comment: CommentData;
    depth?: number;
    commenterToken: string | null;
    publicId: string;
    onReplyPosted?: (parentId: string, newComment: CommentData) => void;
}) {
    const [comment, setComment] = useState(initialComment);
    const [collapsed, setCollapsed] = useState(false);
    const [replying, setReplying] = useState(false);
    const [voting, setVoting] = useState(false);

    // Keep in sync when parent refreshes
    useEffect(() => { setComment(initialComment); }, [initialComment]);

    async function handleVote(dir: 1 | -1) {
        if (!commenterToken || voting) return;
        setVoting(true);

        // Optimistic update
        const prev = { likes: comment.likes, dislikes: comment.dislikes, myVote: comment.myVote };
        const next = { ...comment };

        if (comment.myVote === dir) {
            // retract
            next.myVote = 0;
            dir === 1 ? next.likes-- : next.dislikes--;
        } else {
            if (comment.myVote === 1) next.likes--;
            if (comment.myVote === -1) next.dislikes--;
            next.myVote = dir;
            dir === 1 ? next.likes++ : next.dislikes++;
        }
        setComment(next);

        try {
            const res = await fetch("/api/comments/vote", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-commenter-token": commenterToken,
                },
                body: JSON.stringify({ commentId: comment.id, value: dir }),
            });
            if (!res.ok) throw new Error("Vote failed");
            const data = await res.json();
            setComment((c) => ({ ...c, likes: data.likes, dislikes: data.dislikes, myVote: data.myVote }));
        } catch {
            // Roll back
            setComment((c) => ({ ...c, ...prev }));
        } finally {
            setVoting(false);
        }
    }

    async function handleReplySubmit(body: string) {
        if (!commenterToken) return;
        const res = await fetch(`/api/comments/${publicId}/post`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-commenter-token": commenterToken,
            },
            body: JSON.stringify({ body, parentId: comment.id }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? "Failed to post reply");
        }
        const newComment: CommentData = await res.json();
        onReplyPosted?.(comment.id, newComment);
        setReplying(false);
    }

    const hasReplies = (comment.replies?.length ?? 0) > 0;

    return (
        <div className="flex gap-2.5">
            {/* Avatar + thread line */}
            <div
                className="group flex-none flex flex-col items-center cursor-pointer select-none"
                onClick={() => setCollapsed(!collapsed)}
            >
                <div
                    className={cn(
                        "flex items-center justify-center rounded-full text-[10px] font-bold text-white transition-opacity duration-200",
                        depth === 0 ? "size-7" : "size-5",
                        collapsed ? "opacity-30 grayscale" : "opacity-100"
                    )}
                    style={{ background: comment.author.color }}
                >
                    {comment.author.avatarInitial}
                </div>
                {!collapsed && (
                    <div className="mt-2 w-[2px] flex-grow bg-border/40 group-hover:bg-primary/50 transition-colors" />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div
                    className="flex flex-wrap items-center gap-2 mb-1 cursor-pointer select-none py-0.5 group/header"
                    onClick={() => setCollapsed(!collapsed)}
                >
                    <span className={cn(
                        "text-xs font-bold leading-tight transition-colors",
                        collapsed ? "text-muted-foreground/60" : "text-foreground group-hover/header:text-primary"
                    )}>
                        {comment.author.username}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground/40 leading-none">
                        • {timeAgo(comment.createdAt)}
                    </span>
                    {collapsed && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium animate-in fade-in zoom-in-95 duration-200">
                            [{hasReplies ? (comment.replies!.length + 1) : 1} comments hidden]
                        </span>
                    )}
                </div>

                {!collapsed && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <p className="text-sm text-foreground/90 leading-relaxed mb-3 break-words">
                            {comment.body}
                        </p>

                        <div className="flex items-center gap-1.5 mb-2" onClick={(e) => e.stopPropagation()}>
                            <VoteAction
                                active={comment.myVote === 1}
                                onClick={() => handleVote(1)}
                                label={`▲ ${comment.likes}`}
                                disabled={!commenterToken || voting}
                            />
                            <VoteAction
                                active={comment.myVote === -1}
                                onClick={() => handleVote(-1)}
                                label={`▼ ${comment.dislikes}`}
                                disabled={!commenterToken || voting}
                            />
                            <div className="w-px h-3 bg-border mx-1" />
                            <button
                                onClick={(e) => { e.stopPropagation(); setReplying((r) => !r); }}
                                className={cn(
                                    "text-[11px] font-medium px-2 py-0.5 rounded transition-colors",
                                    replying
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                            >
                                Reply
                            </button>
                        </div>

                        {replying && (
                            <ReplyBox
                                commenterToken={commenterToken}
                                onSubmit={handleReplySubmit}
                                onCancel={() => setReplying(false)}
                            />
                        )}

                        {hasReplies && (
                            <div className="space-y-4 mt-2">
                                {comment.replies!.map((reply) => (
                                    <CommentNode
                                        key={reply.id}
                                        comment={reply}
                                        depth={depth + 1}
                                        commenterToken={commenterToken}
                                        publicId={publicId}
                                        onReplyPosted={onReplyPosted}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── NewCommentBox ─────────────────────────────────────────────────────────────

function NewCommentBox({
    commenterToken,
    publicId,
    onPosted,
}: {
    commenterToken: string | null;
    publicId: string;
    onPosted: (comment: CommentData) => void;
}) {
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handlePost() {
        if (!body.trim() || !commenterToken) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/comments/${publicId}/post`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-commenter-token": commenterToken,
                },
                body: JSON.stringify({ body: body.trim() }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? "Failed to post");
            }
            const newComment: CommentData = await res.json();
            onPosted(newComment);
            setBody("");
        } catch (e: any) {
            setError(e?.message ?? "Failed to post comment");
        } finally {
            setLoading(false);
        }
    }

    if (!commenterToken) {
        return (
            <div className="px-6 py-4 border-t border-border bg-muted/10 text-[12px] text-muted-foreground text-center">
                <span className="italic">Sign in as a commenter to join the discussion.</span>
            </div>
        );
    }

    return (
        <div className="px-6 py-4 border-t border-border bg-muted/10 space-y-2">
            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Share your thoughts…"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            {error && <p className="text-[11px] text-destructive">{error}</p>}
            <button
                onClick={handlePost}
                disabled={loading || !body.trim()}
                className="text-[11px] font-bold px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
                {loading ? "Posting…" : "Post Comment"}
            </button>
        </div>
    );
}

// ── CommentSection (main export) ──────────────────────────────────────────────

const SORTINGS = ["top", "new", "old"] as const;
type Sorting = (typeof SORTINGS)[number];

export function CommentSection({
    publicId,
    pageSize = 5,
    commenterToken = null,
}: {
    publicId: string;
    pageSize?: number;
    /** Pass the JWT from x-commenter-token storage (localStorage, cookie, etc.) */
    commenterToken?: string | null;
}) {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [sorting, setSorting] = useState<Sorting>("top");
    const [page, setPage] = useState(1);

    const fetchComments = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `/api/comments/${publicId}?pageSize=${pageSize}&sorting=${sorting}&page=${page}&replyDepth=2`,
                commenterToken
                    ? { headers: { "x-commenter-token": commenterToken } }
                    : {}
            );
            if (res.ok) setData(await res.json());
        } catch (e) {
            console.error("Failed to fetch comments", e);
        } finally {
            setLoading(false);
        }
    }, [publicId, pageSize, sorting, page, commenterToken]);

    useEffect(() => { fetchComments(); }, [fetchComments]);

    // Insert a newly posted top-level comment optimistically
    function handleNewComment(newComment: CommentData) {
        setData((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                totalCount: prev.totalCount + 1,
                comments: [newComment, ...prev.comments],
            };
        });
    }

    // Insert a reply into the tree
    function handleReplyPosted(parentId: string, newReply: CommentData) {
        setData((prev) => {
            if (!prev) return prev;

            function insertReply(comments: CommentData[]): CommentData[] {
                return comments.map((c) => {
                    if (c.id === parentId) {
                        return { ...c, replies: [...(c.replies ?? []), newReply] };
                    }
                    if (c.replies?.length) {
                        return { ...c, replies: insertReply(c.replies) };
                    }
                    return c;
                });
            }

            return { ...prev, comments: insertReply(prev.comments) };
        });
    }

    return (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold tracking-tight text-foreground">Discussion</h3>
                    {data && (
                        <span className="font-mono text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">
                            {data.totalCount}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                    {SORTINGS.map((s) => (
                        <button
                            key={s}
                            onClick={() => { setSorting(s); setPage(1); }}
                            className={cn(
                                "px-3 py-1 text-[11px] font-bold capitalize rounded-md transition-all",
                                sorting === s
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Comments list */}
            <div className="p-6 min-h-[300px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="size-6 border-2 border-primary/30 border-t-primary animate-spin rounded-full" />
                        <span className="text-xs font-mono text-muted-foreground/40 animate-pulse">
                            awaiting response…
                        </span>
                    </div>
                ) : data?.comments.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-sm text-muted-foreground">
                            The silence here is loud. Be the first to speak.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {data?.comments.map((comment, i, arr) => (
                            <div
                                key={comment.id}
                                className={cn(i < arr.length - 1 && "pb-6 border-b border-border/40")}
                            >
                                <CommentNode
                                    comment={comment}
                                    depth={0}
                                    commenterToken={commenterToken}
                                    publicId={publicId}
                                    onReplyPosted={handleReplyPosted}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Post new comment */}
            <NewCommentBox
                commenterToken={commenterToken}
                publicId={publicId}
                onPosted={handleNewComment}
            />

            {/* Pagination */}
            {data && data.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="text-[11px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors"
                    >
                        PREVIOUS
                    </button>
                    <span className="font-mono text-[10px] text-muted-foreground/40">
                        {page} <span className="mx-1">/</span> {data.totalPages}
                    </span>
                    <button
                        disabled={page === data.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="text-[11px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors"
                    >
                        NEXT
                    </button>
                </div>
            )}
        </div>
    );
}