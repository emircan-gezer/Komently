import React, { useEffect, useState, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommentAuthor {
  username: string;
  avatarInitial: string;
  color: string;
}

export interface CommentData {
  id: string;
  author: CommentAuthor;
  body: string;
  likes: number;
  dislikes: number;
  myVote: 1 | -1 | 0;
  createdAt: string;
  replies?: CommentData[];
}

export interface ApiResponse {
  comments: CommentData[];
  totalPages: number;
  totalCount: number;
  page: number;
}

export interface CommentSectionProps {
  publicId: string;
  pageSize?: number;
  commenterToken?: string | null;
  baseUrl?: string;
  onLogin?: () => void;
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

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// ── Shared API helper (used by sub-components to avoid raw fetch duplication) ─

async function apiPost(
  baseUrl: string,
  path: string,
  body: unknown,
  token: string | null
): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-commenter-token"] = token;

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data;
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
      className={cn("komently-vote-btn", active && "komently-vote-btn-active")}
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
  onLogin,
}: {
  onSubmit: (body: string) => Promise<void>;
  onCancel: () => void;
  commenterToken: string | null;
  onLogin?: () => void;
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Ctrl+Enter to submit
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (body.trim() && !loading) handleSubmit();
    }
  }

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setBody("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to post reply");
    } finally {
      setLoading(false);
    }
  }

  if (!commenterToken) {
    return (
      <div className="komently-auth-prompt">
        <span>You must be logged in to reply.</span>
        <button onClick={onLogin} className="komently-button-primary-sm">
          Login
        </button>
      </div>
    );
  }

  return (
    <div className="komently-reply-box-container">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder="Write a reply… (Ctrl+Enter to submit)"
        className="komently-textarea"
      />
      {error && <p className="komently-error-text">{error}</p>}
      <div className="komently-reply-actions">
        <button
          onClick={handleSubmit}
          disabled={loading || !body.trim()}
          className="komently-button-primary-sm"
        >
          {loading ? "Posting…" : "Reply"}
        </button>
        <button onClick={onCancel} className="komently-button-ghost-sm">
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
  baseUrl,
  onReplyPosted,
  onLogin,
}: {
  comment: CommentData;
  depth?: number;
  commenterToken: string | null;
  publicId: string;
  baseUrl: string;
  onReplyPosted?: (parentId: string, newComment: CommentData) => void;
  onLogin?: () => void;
}) {
  const [comment, setComment] = useState(initialComment);
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [voting, setVoting] = useState(false);

  useEffect(() => { setComment(initialComment); }, [initialComment]);

  async function handleVote(dir: 1 | -1) {
    if (!commenterToken || voting) return;
    setVoting(true);

    // Optimistic update
    const prev = { likes: comment.likes, dislikes: comment.dislikes, myVote: comment.myVote };
    const next = { ...comment };
    if (comment.myVote === dir) {
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
      const data = await apiPost(baseUrl, "/api/comments/vote", { commentId: comment.id, value: dir }, commenterToken);
      setComment((c) => ({ ...c, likes: data.likes, dislikes: data.dislikes, myVote: data.myVote }));
    } catch {
      setComment((c) => ({ ...c, ...prev }));
    } finally {
      setVoting(false);
    }
  }

  async function handleReplySubmit(body: string) {
    if (!commenterToken) return;
    const newComment: CommentData = await apiPost(
      baseUrl,
      `/api/comments/${publicId}/post`,
      { body, parentId: comment.id },
      commenterToken
    );
    onReplyPosted?.(comment.id, newComment);
    setReplying(false);
  }

  const hasReplies = (comment.replies?.length ?? 0) > 0;

  return (
    <div className="komently-comment-item">
      <div className="komently-avatar-container" onClick={() => setCollapsed(!collapsed)}>
        <div
          className={cn("komently-avatar", depth === 0 ? "size-lg" : "size-md", collapsed && "komently-avatar-collapsed")}
          style={{ background: comment.author.color }}
        >
          {comment.author.avatarInitial}
        </div>
        {!collapsed && <div className="komently-thread-line" />}
      </div>

      <div className="komently-comment-content">
        <div className="komently-comment-header" onClick={() => setCollapsed(!collapsed)}>
          <span className={cn("komently-username", collapsed && "komently-username-collapsed")}>
            {comment.author.username}
          </span>
          <span className="komently-timestamp">• {timeAgo(comment.createdAt)}</span>
          {collapsed && (
            <span className="komently-collapsed-badge">
              {hasReplies ? comment.replies!.length + 1 : 1} hidden
            </span>
          )}
        </div>

        {!collapsed && (
          <div className="komently-body-reveal">
            <p className="komently-comment-body">{comment.body}</p>

            <div className="komently-comment-actions">
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
              <div className="komently-divider" />
              <button
                onClick={() => setReplying((r) => !r)}
                className={cn("komently-reply-trigger", replying && "komently-reply-trigger-active")}
              >
                Reply
              </button>
            </div>

            {replying && (
              <ReplyBox
                commenterToken={commenterToken}
                onSubmit={handleReplySubmit}
                onCancel={() => setReplying(false)}
                onLogin={onLogin}
              />
            )}

            {hasReplies && (
              <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {comment.replies!.map((reply) => (
                  <CommentNode
                    key={reply.id}
                    comment={reply}
                    depth={depth + 1}
                    commenterToken={commenterToken}
                    publicId={publicId}
                    baseUrl={baseUrl}
                    onReplyPosted={onReplyPosted}
                    onLogin={onLogin}
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
  baseUrl,
  onPosted,
  onLogin,
}: {
  commenterToken: string | null;
  publicId: string;
  baseUrl: string;
  onPosted: (comment: CommentData) => void;
  onLogin?: () => void;
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (body.trim() && !loading && commenterToken) handlePost();
    }
  }

  async function handlePost() {
    const trimmed = body.trim();
    if (!trimmed || !commenterToken) return;
    setLoading(true);
    setError(null);
    try {
      const newComment: CommentData = await apiPost(
        baseUrl,
        `/api/comments/${publicId}/post`,
        { body: trimmed },
        commenterToken
      );
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
      <div className="komently-login-prompt">
        <span className="komently-login-text">Sign in to join the discussion.</span>
        <button onClick={onLogin} className="komently-button-primary">
          Login with Komently
        </button>
      </div>
    );
  }

  return (
    <div className="komently-new-comment-container">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder="Share your thoughts… (Ctrl+Enter to submit)"
        className="komently-textarea"
      />
      {error && <p className="komently-error-text">{error}</p>}
      <button
        onClick={handlePost}
        disabled={loading || !body.trim()}
        className="komently-button-primary-heavy"
      >
        {loading ? "POSTING…" : "POST COMMENT"}
      </button>
    </div>
  );
}

// ── CommenterProfileEditor ────────────────────────────────────────────────────

function CommenterProfileEditor({
  commenterToken,
  me,
  baseUrl,
  onSave,
  onCancel,
}: {
  commenterToken: string;
  me: any;
  baseUrl: string;
  onSave: (newData: any) => void;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState(me?.username || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate() {
    const trimmed = username.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost(
        baseUrl,
        "/api/commenters/me/update",
        { username: trimmed },
        commenterToken
      );
      onSave(data.commenter);
    } catch (e: any) {
      setError(e?.message ?? "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="komently-profile-editor">
      <div className="komently-profile-editor-content">
        <h4 className="komently-profile-editor-title">Commenter Profile</h4>
        {error && <p className="komently-error-text">{error}</p>}
        <div className="komently-input-group">
          <label className="komently-label">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="komently-input"
            maxLength={32}
          />
        </div>
        <div className="komently-profile-editor-actions">
          <button
            onClick={handleUpdate}
            disabled={loading || !username.trim()}
            className="komently-button-primary-sm"
          >
            {loading ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onCancel} className="komently-button-ghost-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CommentSection (main export) ──────────────────────────────────────────────

const SORTINGS = ["top", "new", "old"] as const;
type Sorting = (typeof SORTINGS)[number];

export function CommentSection({
  publicId,
  pageSize = 5,
  commenterToken: externalToken = null,
  baseUrl = "https://komently.io",
  onLogin,
}: CommentSectionProps) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [me, setMe] = useState<{ loggedIn: boolean; token?: string; commenter?: any } | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<Sorting>("top");
  const [page, setPage] = useState(1);
  const [editingProfile, setEditingProfile] = useState(false);

  const activeToken = me?.token || externalToken;

  // ── Auth + initial comments fetched IN PARALLEL ───────────────────────────
  useEffect(() => {
    if (externalToken !== null) {
      // Token provided externally — skip /me fetch, directly load comments
      setMe({ loggedIn: true, token: externalToken });
      setIsAuthLoaded(true);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      // Fire both requests simultaneously
      const [meRes, commentsRes] = await Promise.allSettled([
        fetch(`${baseUrl}/api/commenters/me`),
        fetch(
          `${baseUrl}/api/comments/${publicId}?pageSize=${pageSize}&sorting=${sorting}&page=${page}&replyDepth=2`
        ),
      ]);

      if (cancelled) return;

      // Resolve auth
      if (meRes.status === "fulfilled" && meRes.value.ok) {
        const meData = await meRes.value.json().catch(() => null);
        setMe(meData ?? { loggedIn: false });
      } else {
        setMe({ loggedIn: false });
      }
      setIsAuthLoaded(true);

      // Resolve comments (no token yet, so myVote will be 0 — will re-fetch if user is authed)
      if (commentsRes.status === "fulfilled" && commentsRes.value.ok) {
        const commentsData = await commentsRes.value.json().catch(() => null);
        if (commentsData) setData(commentsData);
      }

      setLoading(false);
    }

    bootstrap();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalToken, baseUrl, publicId]);

  // ── Re-fetch comments when sort/page/token changes (after initial load) ────
  const fetchComments = useCallback(async () => {
    if (!isAuthLoaded) return;
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (activeToken) headers["x-commenter-token"] = activeToken;

      const res = await fetch(
        `${baseUrl}/api/comments/${publicId}?pageSize=${pageSize}&sorting=${sorting}&page=${page}&replyDepth=2`,
        { headers }
      );
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("Failed to fetch comments", e);
    } finally {
      setLoading(false);
    }
  }, [publicId, pageSize, sorting, page, activeToken, isAuthLoaded, baseUrl]);

  // Only re-run when sort/page/token changes (skip the very first render — bootstrap already covers it)
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    fetchComments();
  }, [fetchComments]);

  function handleNewComment(newComment: CommentData) {
    setData((prev) =>
      prev ? { ...prev, totalCount: prev.totalCount + 1, comments: [newComment, ...prev.comments] } : prev
    );
  }

  function handleReplyPosted(parentId: string, newReply: CommentData) {
    setData((prev) => {
      if (!prev) return prev;
      function insert(comments: CommentData[]): CommentData[] {
        return comments.map((c) => {
          if (c.id === parentId) return { ...c, replies: [...(c.replies ?? []), newReply] };
          if (c.replies?.length) return { ...c, replies: insert(c.replies) };
          return c;
        });
      }
      return { ...prev, comments: insert(prev.comments) };
    });
  }

  const handleLoginClick = onLogin ?? (() => {
    if (typeof window !== "undefined") {
      window.location.href = `${baseUrl}/login?next=${encodeURIComponent(window.location.href)}`;
    }
  });

  return (
    <div className="komently-sdk-root">
      <div className="komently-container">
        {/* Toolbar */}
        <div className="komently-toolbar">
          <div className="komently-toolbar-title">
            <h3 className="komently-title">Discussion</h3>
            {data && <span className="komently-count">{data.totalCount}</span>}
          </div>
          <div className="komently-sorting-tabs">
            {SORTINGS.map((s) => (
              <button
                key={s}
                onClick={() => { setSorting(s); setPage(1); }}
                className={cn("komently-sort-tab", sorting === s && "komently-sort-tab-active")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Comments list */}
        <div className="komently-list">
          {loading ? (
            <div className="komently-loading-state">
              <div className="komently-spinner" />
              <span className="komently-loading-text">loading…</span>
            </div>
          ) : data?.comments.length === 0 ? (
            <div className="komently-empty-state">
              <p>No comments yet. Be the first.</p>
            </div>
          ) : (
            <div className="komently-comments-wrapper">
              {data?.comments.map((comment, i, arr) => (
                <div
                  key={comment.id}
                  className={cn(i < arr.length - 1 && "komently-border-bottom", "komently-comment-node-wrapper")}
                >
                  <CommentNode
                    comment={comment}
                    depth={0}
                    commenterToken={activeToken}
                    publicId={publicId}
                    baseUrl={baseUrl}
                    onReplyPosted={handleReplyPosted}
                    onLogin={handleLoginClick}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="komently-pagination">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="komently-pagination-btn">
              ← Previous
            </button>
            <span className="komently-pagination-info">{page} / {data.totalPages}</span>
            <button disabled={page === data.totalPages} onClick={() => setPage((p) => p + 1)} className="komently-pagination-btn">
              Next →
            </button>
          </div>
        )}

        {/* Profile bar */}
        {me?.loggedIn && me?.commenter && !editingProfile && (
          <div className="komently-profile-bar">
            <div className="komently-profile-info">
              <div className="komently-profile-avatar" style={{ background: me.commenter.color }}>
                {me.commenter.avatar_initial}
              </div>
              <span className="komently-profile-text">
                Commenting as <strong>{me.commenter.username}</strong>
              </span>
            </div>
            <button onClick={() => setEditingProfile(true)} className="komently-edit-profile-btn">
              Edit Profile
            </button>
          </div>
        )}

        {/* Profile editor */}
        {editingProfile && me?.commenter && activeToken && (
          <CommenterProfileEditor
            commenterToken={activeToken}
            me={me.commenter}
            baseUrl={baseUrl}
            onSave={(newData) => { setMe({ ...me, commenter: newData }); setEditingProfile(false); }}
            onCancel={() => setEditingProfile(false)}
          />
        )}

        {/* New comment box */}
        <NewCommentBox
          commenterToken={activeToken}
          publicId={publicId}
          baseUrl={baseUrl}
          onPosted={handleNewComment}
          onLogin={handleLoginClick}
        />
      </div>
    </div>
  );
}
