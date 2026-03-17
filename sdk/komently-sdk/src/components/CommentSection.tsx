import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";

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
        "komently-vote-btn",
        active && "komently-vote-btn-active"
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
      <div className="komently-auth-prompt">
        <span>You must be logged in to reply.</span>
        <button
          onClick={onLogin}
          className="komently-button-primary-sm"
          style={{ height: '32px' }}
        >
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
        rows={3}
        placeholder="Write a reply…"
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
        <button
          onClick={onCancel}
          className="komently-button-ghost-sm"
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
      const res = await fetch(`${baseUrl}/api/comments/vote`, {
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
      setComment((c) => ({ ...c, ...prev }));
    } finally {
      setVoting(false);
    }
  }

  async function handleReplySubmit(body: string) {
    if (!commenterToken) return;
    const res = await fetch(`${baseUrl}/api/comments/${publicId}/post`, {
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
    <div className="komently-comment-item">
      <div
        className="komently-avatar-container"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div
          className={cn(
            "komently-avatar",
            depth === 0 ? "size-lg" : "size-md",
            collapsed && "komently-avatar-collapsed"
          )}
          style={{ background: comment.author.color }}
        >
          {comment.author.avatarInitial}
        </div>
        {!collapsed && (
          <div className="komently-thread-line" />
        )}
      </div>

      <div className="komently-comment-content">
        <div
          className="komently-comment-header"
          onClick={() => setCollapsed(!collapsed)}
        >
          <span className={cn(
            "komently-username",
            collapsed && "komently-username-collapsed"
          )}>
            {comment.author.username}
          </span>
          <span className="komently-timestamp">
            • {timeAgo(comment.createdAt)}
          </span>
          {collapsed && (
            <span className="komently-collapsed-badge">
              {hasReplies ? (comment.replies!.length + 1) : 1} comments hidden
            </span>
          )}
        </div>

        {!collapsed && (
          <div className="komently-body-reveal">
            <p className="komently-comment-body">
              {comment.body}
            </p>

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
                className={cn(
                  "komently-reply-trigger",
                  replying && "komently-reply-trigger-active"
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
                onLogin={onLogin}
              />
            )}

            {hasReplies && (
              <div className="komently-comment-replies" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

  async function handlePost() {
    if (!body.trim() || !commenterToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/comments/${publicId}/post`, {
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
      <div className="komently-login-prompt">
        <span className="komently-login-text">Sign in as a commenter to join the discussion.</span>
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
        rows={3}
        placeholder="Share your thoughts…"
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

// ── CommenterProfileEditor ───────────────────────────────────────────────────

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
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/commenters/me/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-commenter-token": commenterToken,
        },
        body: JSON.stringify({
          username: username.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update profile");
      }
      const data = await res.json();
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
            value={username} onChange={e => setUsername(e.target.value)}
            className="komently-input"
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
        <button
          onClick={onCancel}
          className="komently-button-ghost-sm"
        >
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
  baseUrl = "https://komently.io", // Default base URL
  onLogin,
}: CommentSectionProps) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [me, setMe] = useState<{ loggedIn: boolean, token?: string, commenter?: any } | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<Sorting>("top");
  const [page, setPage] = useState(1);
  const [editingProfile, setEditingProfile] = useState(false);

  const activeToken = me?.token || externalToken;

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await fetch(`${baseUrl}/api/commenters/me`);
        if (res.ok) {
          setMe(await res.json());
        } else {
          setMe({ loggedIn: false });
        }
      } catch {
        setMe({ loggedIn: false });
      } finally {
        setIsAuthLoaded(true);
      }
    }

    if (externalToken !== null) {
      setMe({ loggedIn: true, token: externalToken });
      setIsAuthLoaded(true);
    } else {
      fetchMe();
    }
  }, [externalToken, baseUrl]);

  const fetchComments = useCallback(async () => {
    if (!isAuthLoaded) return;

    setLoading(true);
    try {
      const res = await fetch(
        `${baseUrl}/api/comments/${publicId}?pageSize=${pageSize}&sorting=${sorting}&page=${page}&replyDepth=2`,
        activeToken
          ? { headers: { "x-commenter-token": activeToken } }
          : {}
      );
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("Failed to fetch comments", e);
    } finally {
      setLoading(false);
    }
  }, [publicId, pageSize, sorting, page, activeToken, isAuthLoaded, baseUrl]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

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

  const defaultOnLogin = () => {
    if (typeof window !== 'undefined') {
      window.location.href = `${baseUrl}/login?next=${encodeURIComponent(window.location.href)}`;
    }
  };

  const handleLoginClick = onLogin || defaultOnLogin;

  return (
    <div className="komently-sdk-root">
      <div className="komently-container">
        {/* Toolbar */}
        <div className="komently-toolbar">
          <div className="komently-toolbar-title">
            <h3 className="komently-title">Discussion</h3>
            {data && (
              <span className="komently-count">
                {data.totalCount}
              </span>
            )}
          </div>

          <div className="komently-sorting-tabs">
            {SORTINGS.map((s) => (
              <button
                key={s}
                onClick={() => { setSorting(s); setPage(1); }}
                className={cn(
                  "komently-sort-tab",
                  sorting === s && "komently-sort-tab-active"
                )}
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
              <span className="komently-loading-text">
                awaiting response…
              </span>
            </div>
          ) : data?.comments.length === 0 ? (
            <div className="komently-empty-state">
              <p>
                The silence is loud.
              </p>
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
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="komently-pagination-btn"
            >
              PREVIOUS
            </button>
            <span className="komently-pagination-info">
              {page} / {data.totalPages}
            </span>
            <button
              disabled={page === data.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="komently-pagination-btn"
            >
              NEXT
            </button>
          </div>
        )}

        {/* User Profile Bar (if logged in) */}
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
            <button
              onClick={() => setEditingProfile(true)}
              className="komently-edit-profile-btn"
            >
              Edit Profile
            </button>
          </div>
        )}

        {/* Profile Editor */}
        {editingProfile && me?.commenter && activeToken && (
          <CommenterProfileEditor
            commenterToken={activeToken}
            me={me.commenter}
            baseUrl={baseUrl}
            onSave={(newData) => {
              setMe({ ...me, commenter: newData });
              setEditingProfile(false);
            }}
            onCancel={() => setEditingProfile(false)}
          />
        )}

        {/* Post new comment */}
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
