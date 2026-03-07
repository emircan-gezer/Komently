// src/components/CommentSection.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 6e4);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "just now";
}
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
function VoteAction({
  active,
  onClick,
  label,
  disabled
}) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      onClick,
      disabled,
      className: cn(
        "komently-vote-btn",
        active && "komently-vote-btn-active"
      ),
      children: label
    }
  );
}
function ReplyBox({
  onSubmit,
  onCancel,
  commenterToken,
  onLogin
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);
  async function handleSubmit() {
    if (!body.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(body.trim());
      setBody("");
    } catch (e) {
      setError(e?.message ?? "Failed to post reply");
    } finally {
      setLoading(false);
    }
  }
  if (!commenterToken) {
    return /* @__PURE__ */ jsxs("div", { className: "komently-auth-prompt", children: [
      /* @__PURE__ */ jsx("span", { children: "You must be logged in to reply." }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onLogin,
          className: "komently-button-primary-sm",
          style: { height: "32px" },
          children: "Login"
        }
      )
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "komently-reply-box-container", children: [
    /* @__PURE__ */ jsx(
      "textarea",
      {
        ref: textareaRef,
        value: body,
        onChange: (e) => setBody(e.target.value),
        rows: 3,
        placeholder: "Write a reply\u2026",
        className: "komently-textarea"
      }
    ),
    error && /* @__PURE__ */ jsx("p", { className: "komently-error-text", children: error }),
    /* @__PURE__ */ jsxs("div", { className: "komently-reply-actions", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleSubmit,
          disabled: loading || !body.trim(),
          className: "komently-button-primary-sm",
          children: loading ? "Posting\u2026" : "Reply"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onCancel,
          className: "komently-button-ghost-sm",
          children: "Cancel"
        }
      )
    ] })
  ] });
}
function CommentNode({
  comment: initialComment,
  depth = 0,
  commenterToken,
  publicId,
  baseUrl,
  onReplyPosted,
  onLogin
}) {
  const [comment, setComment] = useState(initialComment);
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [voting, setVoting] = useState(false);
  useEffect(() => {
    setComment(initialComment);
  }, [initialComment]);
  async function handleVote(dir) {
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
          "x-commenter-token": commenterToken
        },
        body: JSON.stringify({ commentId: comment.id, value: dir })
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
  async function handleReplySubmit(body) {
    if (!commenterToken) return;
    const res = await fetch(`${baseUrl}/api/comments/${publicId}/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-commenter-token": commenterToken
      },
      body: JSON.stringify({ body, parentId: comment.id })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to post reply");
    }
    const newComment = await res.json();
    onReplyPosted?.(comment.id, newComment);
    setReplying(false);
  }
  const hasReplies = (comment.replies?.length ?? 0) > 0;
  return /* @__PURE__ */ jsxs("div", { className: "komently-comment-item", children: [
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: "komently-avatar-container",
        onClick: () => setCollapsed(!collapsed),
        children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: cn(
                "komently-avatar",
                depth === 0 ? "size-lg" : "size-md",
                collapsed && "komently-avatar-collapsed"
              ),
              style: { background: comment.author.color },
              children: comment.author.avatarInitial
            }
          ),
          !collapsed && /* @__PURE__ */ jsx("div", { className: "komently-thread-line" })
        ]
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "komently-comment-content", children: [
      /* @__PURE__ */ jsxs(
        "div",
        {
          className: "komently-comment-header",
          onClick: () => setCollapsed(!collapsed),
          children: [
            /* @__PURE__ */ jsx("span", { className: cn(
              "komently-username",
              collapsed && "komently-username-collapsed"
            ), children: comment.author.username }),
            /* @__PURE__ */ jsxs("span", { className: "komently-timestamp", children: [
              "\u2022 ",
              timeAgo(comment.createdAt)
            ] }),
            collapsed && /* @__PURE__ */ jsxs("span", { className: "komently-collapsed-badge", children: [
              "[",
              hasReplies ? comment.replies.length + 1 : 1,
              " comments hidden]"
            ] })
          ]
        }
      ),
      !collapsed && /* @__PURE__ */ jsxs("div", { className: "komently-body-reveal", children: [
        /* @__PURE__ */ jsx("p", { className: "komently-comment-body", children: comment.body }),
        /* @__PURE__ */ jsxs("div", { className: "komently-comment-actions", children: [
          /* @__PURE__ */ jsx(
            VoteAction,
            {
              active: comment.myVote === 1,
              onClick: () => handleVote(1),
              label: `\u25B2 ${comment.likes}`,
              disabled: !commenterToken || voting
            }
          ),
          /* @__PURE__ */ jsx(
            VoteAction,
            {
              active: comment.myVote === -1,
              onClick: () => handleVote(-1),
              label: `\u25BC ${comment.dislikes}`,
              disabled: !commenterToken || voting
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "komently-divider" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setReplying((r) => !r),
              className: cn(
                "komently-reply-trigger",
                replying && "komently-reply-trigger-active"
              ),
              children: "Reply"
            }
          )
        ] }),
        replying && /* @__PURE__ */ jsx(
          ReplyBox,
          {
            commenterToken,
            onSubmit: handleReplySubmit,
            onCancel: () => setReplying(false),
            onLogin
          }
        ),
        hasReplies && /* @__PURE__ */ jsx("div", { className: "komently-comment-replies", style: { marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "1rem" }, children: comment.replies.map((reply) => /* @__PURE__ */ jsx(
          CommentNode,
          {
            comment: reply,
            depth: depth + 1,
            commenterToken,
            publicId,
            baseUrl,
            onReplyPosted,
            onLogin
          },
          reply.id
        )) })
      ] })
    ] })
  ] });
}
function NewCommentBox({
  commenterToken,
  publicId,
  baseUrl,
  onPosted,
  onLogin
}) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  async function handlePost() {
    if (!body.trim() || !commenterToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/comments/${publicId}/post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-commenter-token": commenterToken
        },
        body: JSON.stringify({ body: body.trim() })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to post");
      }
      const newComment = await res.json();
      onPosted(newComment);
      setBody("");
    } catch (e) {
      setError(e?.message ?? "Failed to post comment");
    } finally {
      setLoading(false);
    }
  }
  if (!commenterToken) {
    return /* @__PURE__ */ jsxs("div", { className: "komently-login-prompt", children: [
      /* @__PURE__ */ jsx("span", { className: "komently-login-text", children: "Sign in as a commenter to join the discussion." }),
      /* @__PURE__ */ jsx("button", { onClick: onLogin, className: "komently-button-primary", children: "Login with Komently" })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "komently-new-comment-container", children: [
    /* @__PURE__ */ jsx(
      "textarea",
      {
        value: body,
        onChange: (e) => setBody(e.target.value),
        rows: 3,
        placeholder: "Share your thoughts\u2026",
        className: "komently-textarea"
      }
    ),
    error && /* @__PURE__ */ jsx("p", { className: "komently-error-text", children: error }),
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: handlePost,
        disabled: loading || !body.trim(),
        className: "komently-button-primary-heavy",
        children: loading ? "POSTING\u2026" : "POST COMMENT"
      }
    )
  ] });
}
function CommenterProfileEditor({
  commenterToken,
  me,
  baseUrl,
  onSave,
  onCancel
}) {
  const [username, setUsername] = useState(me?.username || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  async function handleUpdate() {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/commenters/me/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-commenter-token": commenterToken
        },
        body: JSON.stringify({
          username: username.trim()
        })
      });
      if (!res.ok) {
        const data2 = await res.json().catch(() => ({}));
        throw new Error(data2.error ?? "Failed to update profile");
      }
      const data = await res.json();
      onSave(data.commenter);
    } catch (e) {
      setError(e?.message ?? "An error occurred");
    } finally {
      setLoading(false);
    }
  }
  return /* @__PURE__ */ jsx("div", { className: "komently-profile-editor", children: /* @__PURE__ */ jsxs("div", { className: "komently-profile-editor-content", children: [
    /* @__PURE__ */ jsx("h4", { className: "komently-profile-editor-title", children: "Commenter Profile" }),
    error && /* @__PURE__ */ jsx("p", { className: "komently-error-text", children: error }),
    /* @__PURE__ */ jsxs("div", { className: "komently-input-group", children: [
      /* @__PURE__ */ jsx("label", { className: "komently-label", children: "Username" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          value: username,
          onChange: (e) => setUsername(e.target.value),
          className: "komently-input"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "komently-profile-editor-actions", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: handleUpdate,
          disabled: loading || !username.trim(),
          className: "komently-button-primary-sm",
          children: loading ? "Saving\u2026" : "Save Changes"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onCancel,
          className: "komently-button-ghost-sm",
          children: "Cancel"
        }
      )
    ] })
  ] }) });
}
var SORTINGS = ["top", "new", "old"];
function CommentSection({
  publicId,
  pageSize = 5,
  commenterToken: externalToken = null,
  baseUrl = "https://komently.io",
  // Default base URL
  onLogin
}) {
  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState("top");
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
        activeToken ? { headers: { "x-commenter-token": activeToken } } : {}
      );
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error("Failed to fetch comments", e);
    } finally {
      setLoading(false);
    }
  }, [publicId, pageSize, sorting, page, activeToken, isAuthLoaded, baseUrl]);
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);
  function handleNewComment(newComment) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        totalCount: prev.totalCount + 1,
        comments: [newComment, ...prev.comments]
      };
    });
  }
  function handleReplyPosted(parentId, newReply) {
    setData((prev) => {
      if (!prev) return prev;
      function insertReply(comments) {
        return comments.map((c) => {
          if (c.id === parentId) {
            return { ...c, replies: [...c.replies ?? [], newReply] };
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
    if (typeof window !== "undefined") {
      window.location.href = `${baseUrl}/login?next=${encodeURIComponent(window.location.href)}`;
    }
  };
  const handleLoginClick = onLogin || defaultOnLogin;
  return /* @__PURE__ */ jsx("div", { className: "komently-sdk-root", children: /* @__PURE__ */ jsxs("div", { className: "komently-container", children: [
    /* @__PURE__ */ jsxs("div", { className: "komently-toolbar", children: [
      /* @__PURE__ */ jsxs("div", { className: "komently-toolbar-title", children: [
        /* @__PURE__ */ jsx("h3", { className: "komently-title", children: "Discussion" }),
        data && /* @__PURE__ */ jsx("span", { className: "komently-count", children: data.totalCount })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "komently-sorting-tabs", children: SORTINGS.map((s) => /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => {
            setSorting(s);
            setPage(1);
          },
          className: cn(
            "komently-sort-tab",
            sorting === s && "komently-sort-tab-active"
          ),
          children: s
        },
        s
      )) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "komently-list", children: loading ? /* @__PURE__ */ jsxs("div", { className: "komently-loading-state", children: [
      /* @__PURE__ */ jsx("div", { className: "komently-spinner" }),
      /* @__PURE__ */ jsx("span", { className: "komently-loading-text", children: "awaiting response\u2026" })
    ] }) : data?.comments.length === 0 ? /* @__PURE__ */ jsx("div", { className: "komently-empty-state", children: /* @__PURE__ */ jsx("p", { children: "The silence here is loud. Be the first to speak." }) }) : /* @__PURE__ */ jsx("div", { className: "komently-comments-wrapper", children: data?.comments.map((comment, i, arr) => /* @__PURE__ */ jsx(
      "div",
      {
        className: cn(i < arr.length - 1 && "komently-border-bottom", "komently-comment-node-wrapper"),
        children: /* @__PURE__ */ jsx(
          CommentNode,
          {
            comment,
            depth: 0,
            commenterToken: activeToken,
            publicId,
            baseUrl,
            onReplyPosted: handleReplyPosted,
            onLogin: handleLoginClick
          }
        )
      },
      comment.id
    )) }) }),
    data && data.totalPages > 1 && /* @__PURE__ */ jsxs("div", { className: "komently-pagination", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          disabled: page === 1,
          onClick: () => setPage((p) => p - 1),
          className: "komently-pagination-btn",
          children: "PREVIOUS"
        }
      ),
      /* @__PURE__ */ jsxs("span", { className: "komently-pagination-info", children: [
        page,
        " / ",
        data.totalPages
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          disabled: page === data.totalPages,
          onClick: () => setPage((p) => p + 1),
          className: "komently-pagination-btn",
          children: "NEXT"
        }
      )
    ] }),
    me?.loggedIn && me?.commenter && !editingProfile && /* @__PURE__ */ jsxs("div", { className: "komently-profile-bar", children: [
      /* @__PURE__ */ jsxs("div", { className: "komently-profile-info", children: [
        /* @__PURE__ */ jsx("div", { className: "komently-profile-avatar", style: { background: me.commenter.color }, children: me.commenter.avatar_initial }),
        /* @__PURE__ */ jsxs("span", { className: "komently-profile-text", children: [
          "Commenting as ",
          /* @__PURE__ */ jsx("strong", { children: me.commenter.username })
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => setEditingProfile(true),
          className: "komently-edit-profile-btn",
          children: "Edit Profile"
        }
      )
    ] }),
    editingProfile && me?.commenter && activeToken && /* @__PURE__ */ jsx(
      CommenterProfileEditor,
      {
        commenterToken: activeToken,
        me: me.commenter,
        baseUrl,
        onSave: (newData) => {
          setMe({ ...me, commenter: newData });
          setEditingProfile(false);
        },
        onCancel: () => setEditingProfile(false)
      }
    ),
    /* @__PURE__ */ jsx(
      NewCommentBox,
      {
        commenterToken: activeToken,
        publicId,
        baseUrl,
        onPosted: handleNewComment,
        onLogin: handleLoginClick
      }
    )
  ] }) });
}
export {
  CommentSection
};
