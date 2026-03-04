import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Comment } from '../types';
import { KomentlyClient } from '../api-client';
// Uses global classNames like "komently-form". See README to import CSS globally.
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { CommentForm } from './internal/CommentForm';
import { CommentItem } from './internal/CommentItem';

export type ReactionHandler = (commentId: string, state: -1 | 0 | 1) => Promise<void> | void;

export interface CommentSectionProps {
  publicId: string;
  apiKey: string;
  baseUrl?: string;

  // Optional custom renderers (for full control)
  renderComment?: (args: {
    comment: Comment;
    onReply: (parentId: string, text: string) => Promise<void>;
    onDelete?: (commentId: string) => Promise<void>;
    onLike?: ReactionHandler;
    onDislike?: ReactionHandler;
    currentUserId?: string | null;
  }) => React.ReactNode;

  renderReply?: (args: {
    comment: Comment;
    onReply: (parentId: string, text: string) => Promise<void>;
    onDelete?: (commentId: string) => Promise<void>;
    onLike?: ReactionHandler;
    onDislike?: ReactionHandler;
    currentUserId?: string | null;
  }) => React.ReactNode;

  renderForm?: (args: {
    onSubmit: (text: string) => Promise<void>;
    onLogin: () => Promise<void>;
    isAuthenticated: boolean;
    currentUser: {
      id: string | null;
      email: string | null;
      username: string | null;
      firstName: string | null;
      lastName: string | null;
      avatarUrl: string | null;
    } | null;
    submitting: boolean;
    onLogout?: () => void;
    allowGuestComments?: boolean;
  }) => React.ReactNode;

  // Optional handlers to override built-ins
  onLike?: ReactionHandler;
  onDislike?: ReactionHandler;
  onDelete?: (commentId: string) => Promise<void>;
  onEdit?: (commentId: string, text: string) => Promise<void>;
}

// Internal defaults are split into separate files for easier swapping and tree-shaking.

export function CommentSection(props: CommentSectionProps) {
  const { publicId, apiKey, baseUrl } = props;

  const client = useMemo(() => new KomentlyClient({ apiKey, baseUrl }), [apiKey, baseUrl]);

  const [comments, setComments] = useState<Comment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const [currentUser, setCurrentUser] = useState<{
    id: string | null;
    email: string | null;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  } | null>(null);

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [sectionSettings, setSectionSettings] = useState<{ allow_guest_comments?: boolean; [key: string]: any }>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await client.getComments({ publicId, limit: 20, replyDepth: 2 });
      setComments(data.comments);
      setNextCursor(data.nextCursor);
      if (data.viewerId) setViewerId(data.viewerId);
      if (data.settings) setSectionSettings(data.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [client, publicId]);

  const refreshAuth = useCallback(async () => {
    const token = await client.getCommenterToken();
    const authed = Boolean(token);
    setIsAuthenticated(authed);
    if (authed) {
      const user = await client.getCurrentUser();
      setCurrentUser(user);
      // viewerId will be set from API response in load()
      // Also set it from user.id (which is now Clerk ID) for immediate use
      if (user?.id) setViewerId(user.id);
    } else {
      setCurrentUser(null);
      setViewerId(null);
    }
  }, [client]);

  useEffect(() => {
    load();
    refreshAuth();
  }, [load, refreshAuth]);

  const handleLogin = useCallback(async () => {
    const result = await client.login();
    if (result?.linkedComments && result.linkedComments > 0) {
      // Reload comments to show updated user info for linked guest comments
      await load();
    }
    await refreshAuth();
  }, [client, refreshAuth, load]);

  const handleCreate = useCallback(
    async (text: string) => {
      setSubmitting(true);
      try {
        const newComment = await client.createComment(publicId, text);
        setComments((prev) => [newComment, ...prev]);
      } finally {
        setSubmitting(false);
      }
    },
    [client, publicId]
  );

  const handleReply = useCallback(
    async (parentId: string, text: string) => {
      const reply = await client.createComment(publicId, text, { replyTo: parentId });
      setComments((prev) => [reply, ...prev]);
    },
    [client, publicId]
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await client.getComments({ publicId, limit: 20, cursor: nextCursor });
      setComments((prev) => [...prev, ...data.comments]);
      setNextCursor(data.nextCursor);
      if (data.viewerId) setViewerId(data.viewerId);
    } finally {
      setLoadingMore(false);
    }
  }, [client, publicId, nextCursor]);

  // Nested replies are included by API up to replyDepth; no client-side replies pagination

  const handleLike: ReactionHandler = useCallback(
    async (commentId, state) => {
      if (props.onLike) return props.onLike(commentId, state);
      // Optimistic update: adjust like/dislike counts and likeState
      setComments((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        const target = byId.get(commentId);
        if (!target) return prev;
        const prevState = target.likeState ?? 0;
        const reactions = target.reactions || { likes: 0, dislikes: 0, total: 0 };
        let { likes, dislikes } = reactions;
        // Remove previous
        if (prevState === 1) likes = Math.max(0, likes - 1);
        if (prevState === -1) dislikes = Math.max(0, dislikes - 1);
        // Apply new
        if (state === 1) likes += 1;
        if (state === -1) dislikes += 1;
        const total = likes - dislikes;
        const updated = { ...target, likeState: state, reactions: { likes, dislikes, total } } as Comment;
        byId.set(commentId, updated);
        return prev.map((c) => (c.id === commentId ? updated : c));
      });
      try {
        await client.setReaction(commentId, state);
      } catch (e) {
        // Revert on failure
        setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, likeState: 0 } : c)));
      }
    },
    [client, props]
  );

  const handleDislike: ReactionHandler = useCallback(
    async (commentId, state) => {
      if (props.onDislike) return props.onDislike(commentId, state);
      // Alias to handleLike with -1
      await handleLike(commentId, state);
    },
    [handleLike, props]
  );

  const handleEdit = useCallback(
    async (commentId: string, text: string) => {
      if (props.onEdit) return props.onEdit(commentId, text);
      const updated = await client.updateComment(commentId, text);
      setComments((prev) => {
        const updateComment = (c: Comment): Comment => {
          if (c.id === commentId) {
            return { ...updated, replies: c.replies };
          }
          if (c.replies) {
            return { ...c, replies: c.replies.map(updateComment) };
          }
          return c;
        };
        return prev.map(updateComment);
      });
    },
    [client, props]
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (props.onDelete) return props.onDelete(commentId);
      await client.deleteComment(commentId);
      // Mark as deleted instead of removing
      setComments((prev) => {
        const markDeleted = (c: Comment): Comment => {
          if (c.id === commentId) {
            return { ...c, deleted_at: new Date().toISOString(), deletion_type: 'commenter' as const };
          }
          if (c.replies) {
            return { ...c, replies: c.replies.map(markDeleted) };
          }
          return c;
        };
        return prev.map(markDeleted);
      });
    },
    [client, props]
  );

  const renderOne = (comment: Comment) => {
    const common = {
      comment,
      onReply: handleReply,
      onDelete: handleDelete,
      onEdit: handleEdit,
      onLike: handleLike,
      onDislike: handleDislike,
      collapsed: Boolean(collapsedIds[comment.id]),
      toggleCollapse,
      currentUserId: viewerId,
    } as const;

    if (props.renderComment) return props.renderComment(common);
    return <CommentItem {...common} />;
  };

  const renderChildren = (node: Comment | undefined): React.ReactNode => {
    const children = node?.replies || [];
    if (!children || children.length === 0) return null;
    return (
      <div className="komently-replies">
        {children.map((r) => (
          <div key={r.id}>
            {renderOne(r)}
            {!collapsedIds[r.id] && renderChildren(r)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="komently-comment-section">
      {(props.renderForm || ((args) => <CommentForm {...args} />))({
        onSubmit: handleCreate,
        onLogin: handleLogin,
        isAuthenticated,
        currentUser,
        submitting,
        onLogout: () => client.logout(),
        allowGuestComments: sectionSettings.allow_guest_comments ?? false,
      })}
      {loading && <div className="komently-loading">Loading comments…</div>}
      {error && <div className="komently-error">{error}</div>}
      {!loading && !error && comments.length === 0 && (
        <div className="komently-empty">No comments yet. Be the first to comment!</div>
      )}

      <div className="komently-replies">
        {comments
          .filter((c) => !c.reply_to)
          .map((c) => (
            <div key={c.id}>
              {renderOne(c)}
              {/* Render replies recursively */}
              {!collapsedIds[c.id] && renderChildren(c)}
            </div>
          ))}
      </div>
      {nextCursor && (
        <div className="komently-actions">
          <Button type="button" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more comments'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default CommentSection;


