// src/config.ts
var defaultBaseUrl = "http://localhost:3000";
var defaultApiKey = "";
function configure(config) {
  defaultBaseUrl = config.baseUrl.replace(/\/$/, "");
  if (config.apiKey) {
    defaultApiKey = config.apiKey;
  }
}
function getBaseUrl() {
  return defaultBaseUrl;
}
function getApiKey() {
  return defaultApiKey;
}

// src/token-manager.ts
var TOKEN_COOKIE_NAME = "komently_session";
var TokenManager = class {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || getBaseUrl();
  }
  /**
   * Get stored commenter token from cookie only
   */
  getStoredToken() {
    if (typeof window === "undefined") return null;
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === TOKEN_COOKIE_NAME && value) {
        return decodeURIComponent(value);
      }
    }
    return null;
  }
  /**
   * Store commenter token in cookie only
   */
  storeToken(token) {
    if (typeof window === "undefined") return;
    const expires = /* @__PURE__ */ new Date();
    expires.setTime(expires.getTime() + 24 * 60 * 60 * 1e3);
    const isSecure = window.location.protocol === "https:";
    const encodedToken = encodeURIComponent(token);
    document.cookie = `${TOKEN_COOKIE_NAME}=${encodedToken}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${isSecure ? "; Secure" : ""}`;
  }
  /**
   * Clear stored token (cookie only)
   */
  clearToken() {
    if (typeof window === "undefined") return;
    document.cookie = `${TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
  }
  /**
   * Fetch a new commenter token from the server
   * This requires the user to be authenticated via Clerk on the Komently domain
   */
  async fetchToken() {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/token`, {
        method: "GET",
        credentials: "include",
        // Include cookies for Clerk session
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      if (data.token) {
        this.storeToken(data.token);
        return data.token;
      }
      return null;
    } catch (error) {
      console.error("Error fetching commenter token:", error);
      return null;
    }
  }
  /**
   * Get or fetch token, fetching if not available or expired
   */
  async getToken(forceRefresh = false) {
    if (!forceRefresh) {
      const stored = this.getStoredToken();
      if (stored) return stored;
    }
    return await this.fetchToken();
  }
  /**
   * Open login popup and wait for authentication
   */
  openLoginPopup(redirectUrl) {
    return new Promise((resolve) => {
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const origin = redirectUrl ? new URL(redirectUrl).origin : window.location.origin;
      const popupUrl = `${this.baseUrl}/sign-in?redirect_url=${encodeURIComponent(`${this.baseUrl}/komently/oauth?origin=${encodeURIComponent(origin)}`)}`;
      const popup = window.open(
        popupUrl,
        "komently-auth",
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );
      if (!popup) {
        console.error("Failed to open popup. Please allow popups for this site.");
        resolve(null);
        return;
      }
      const timeoutTimer = setTimeout(() => {
        clearInterval(pollTimer);
        popup.close();
        resolve(null);
      }, 5 * 60 * 1e3);
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          clearTimeout(timeoutTimer);
          window.removeEventListener("message", messageHandler);
          const token = this.getStoredToken();
          resolve(token);
        }
      }, 500);
      const messageHandler = (event) => {
        if (event.origin !== this.baseUrl) return;
        if (event.data.type === "komently-auth-success") {
          window.removeEventListener("message", messageHandler);
          clearInterval(pollTimer);
          clearTimeout(timeoutTimer);
          const token = event.data.token;
          if (token) {
            this.storeToken(token);
            popup.close();
            resolve(token);
          } else {
            popup.close();
            resolve(null);
          }
        } else if (event.data.type === "komently-auth-error") {
          window.removeEventListener("message", messageHandler);
          clearInterval(pollTimer);
          clearTimeout(timeoutTimer);
          console.error("Authentication error:", event.data.error);
          popup.close();
          resolve(null);
        }
      };
      window.addEventListener("message", messageHandler);
    });
  }
};

// src/guest-manager.ts
var GUEST_TOKEN_COOKIE_NAME = "komently_guest_token";
var GuestManager = class {
  constructor(baseUrl) {
    this.baseUrl = baseUrl || getBaseUrl();
  }
  /**
   * Get stored guest token from cookie
   */
  getStoredGuestToken() {
    if (typeof window === "undefined") return null;
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === GUEST_TOKEN_COOKIE_NAME && value) {
        return decodeURIComponent(value);
      }
    }
    return null;
  }
  /**
   * Store guest token in cookie
   */
  storeGuestToken(token) {
    if (typeof window === "undefined") return;
    const expires = /* @__PURE__ */ new Date();
    expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1e3);
    const isSecure = window.location.protocol === "https:";
    const encodedToken = encodeURIComponent(token);
    document.cookie = `${GUEST_TOKEN_COOKIE_NAME}=${encodedToken}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${isSecure ? "; Secure" : ""}`;
  }
  /**
   * Get or fetch guest token
   */
  async getGuestToken() {
    const stored = this.getStoredGuestToken();
    if (stored) return stored;
    try {
      const response = await fetch(`${this.baseUrl}/api/guest/token`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data.guestToken) {
        this.storeGuestToken(data.guestToken);
        return data.guestToken;
      }
      return null;
    } catch (error) {
      console.error("Error fetching guest token:", error);
      return null;
    }
  }
  /**
   * Clear guest token
   */
  clearGuestToken() {
    if (typeof window === "undefined") return;
    document.cookie = `${GUEST_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
  }
};

// src/api-client.ts
var KomentlyClient = class {
  constructor(config) {
    this.cache = /* @__PURE__ */ new Map();
    this.inflight = /* @__PURE__ */ new Map();
    this.baseUrl = config?.baseUrl?.replace(/\/$/, "") || getBaseUrl();
    this.apiKey = config?.apiKey || getApiKey();
    this.tokenManager = new TokenManager(this.baseUrl);
    this.guestManager = new GuestManager(this.baseUrl);
  }
  /**
   * Get authentication headers including API key, optional commenter token, and guest token
   */
  async getHeaders(includeGuestToken = false) {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`,
      "X-API-Key": this.apiKey
    };
    const token = await this.tokenManager.getToken();
    if (token) {
      headers["X-Commenter-Token"] = token;
    }
    if (includeGuestToken && !token) {
      const guestToken = await this.guestManager.getGuestToken();
      if (guestToken) {
        headers["X-Guest-Token"] = guestToken;
      }
    }
    return headers;
  }
  /**
   * Fetch top-level comments for a section by publicId
   */
  async getComments(params) {
    const search = new URLSearchParams();
    if (params.pageSize) search.set("pageSize", String(params.pageSize));
    if (params.page) search.set("page", String(params.page));
    if (params.sorting) search.set("sorting", params.sorting);
    if (params.replyDepth) search.set("replyDepth", String(params.replyDepth));
    const url = `${this.baseUrl}/api/comments/${encodeURIComponent(params.publicId)}?${search.toString()}`;
    const key = `comments:${url}`;
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && now - cached.t < 1e4) {
      return cached.data;
    }
    const inflight = this.inflight.get(key);
    if (inflight) return inflight;
    const promise = (async () => {
      const response = await fetch(url, {
        method: "GET",
        headers: await this.getHeaders(true),
        credentials: this.includeCredentials ? "include" : "omit"
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch comments");
      }
      const data = await response.json();
      const normalized = {
        comments: data.comments || [],
        totalPages: data.totalPages || 0,
        totalCount: data.totalCount || 0,
        page: data.page || 1
      };
      this.cache.set(key, { t: Date.now(), data: normalized });
      this.inflight.delete(key);
      return normalized;
    })();
    this.inflight.set(key, promise);
    return promise;
  }
  /**
   * Create a new comment (or reply when parentId provided)
   */
  async createComment(publicId, body, options) {
    const headers = await this.getHeaders(true);
    const response = await fetch(`${this.baseUrl}/api/comments/${encodeURIComponent(publicId)}/post`, {
      method: "POST",
      headers,
      credentials: this.includeCredentials ? "include" : "omit",
      body: JSON.stringify({
        body: body.trim(),
        parentId: options?.parentId
      })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create comment");
    }
    return await response.json();
  }
  /**
   * Fetch replies for a given parent comment
   */
  async getReplies(params) {
    const search = new URLSearchParams();
    search.set("parentId", params.parentId);
    if (params.limit) search.set("limit", String(params.limit));
    if (params.cursor) search.set("cursor", params.cursor);
    const url = `${this.baseUrl}/api/comments/${encodeURIComponent(params.publicId)}/replies?${search.toString()}`;
    const key = `replies:${url}`;
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && now - cached.t < 1e4) {
      return cached.data;
    }
    const inflight = this.inflight.get(key);
    if (inflight) return inflight;
    const promise = (async () => {
      const response = await fetch(url, {
        method: "GET",
        headers: await this.getHeaders(),
        credentials: this.includeCredentials ? "include" : "omit"
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch replies");
      }
      const data = await response.json();
      const normalized = {
        comments: data.comments || [],
        nextCursor: data.nextCursor ?? null,
        hasMore: Boolean(data.hasMore)
      };
      this.cache.set(key, { t: Date.now(), data: normalized });
      this.inflight.delete(key);
      return normalized;
    })();
    this.inflight.set(key, promise);
    return promise;
  }
  /**
   * Get reactions for a comment
   */
  async getReactions(commentId) {
    const response = await fetch(
      `${this.baseUrl}/api/reactions?commentId=${commentId}`,
      {
        method: "GET",
        headers: await this.getHeaders()
      }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch reactions");
    }
    return await response.json();
  }
  /**
   * Add or update a reaction (like/dislike)
   */
  async setReaction(commentId, value) {
    const response = await fetch(`${this.baseUrl}/api/comments/vote`, {
      method: "POST",
      headers: await this.getHeaders(true),
      credentials: this.includeCredentials ? "include" : "omit",
      body: JSON.stringify({ commentId, value })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to set reaction: ${response.statusText}`);
    }
    return response.json();
  }
  async updateProfile(data) {
    const response = await fetch(`${this.baseUrl}/api/commenters/me/update`, {
      method: "POST",
      headers: await this.getHeaders(),
      credentials: this.includeCredentials ? "include" : "omit",
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error ?? `Failed to update profile: ${response.statusText}`);
    }
    return response.json();
  }
  /**
   * Get section details by public ID
   */
  async getSectionByPublicId(publicId) {
    const response = await fetch(
      `${this.baseUrl}/api/sections/public/${publicId}`,
      {
        method: "GET",
        headers: await this.getHeaders()
      }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch section");
    }
    const data = await response.json();
    return data.section;
  }
  /**
   * Get or fetch commenter token
   */
  async getCommenterToken() {
    return await this.tokenManager.getToken();
  }
  /**
   * Get current user info using commenter JWT token
   */
  async getCurrentUser() {
    const response = await fetch(`${this.baseUrl}/api/commenters/me`, {
      method: "GET",
      headers: await this.getHeaders()
    });
    if (!response.ok) return null;
    return await response.json();
  }
  /**
   * Link guest account to authenticated user
   */
  async linkGuestAccount() {
    const token = await this.tokenManager.getToken();
    const guestToken = await this.guestManager.getGuestToken();
    if (!token || !guestToken) {
      return null;
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/guest/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Commenter-Token": token,
          "X-Guest-Token": guestToken
        },
        credentials: this.includeCredentials ? "include" : "omit"
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error("Error linking guest account:", error);
      return null;
    }
  }
  /**
   * Open login popup for authentication
   * After login, fetches user info using the JWT token and links guest account
   */
  async login(redirectUrl) {
    const token = await this.tokenManager.openLoginPopup(redirectUrl);
    if (!token) return null;
    const response = await fetch(`${this.baseUrl}/api/user`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Commenter-Token": token
      },
      credentials: this.includeCredentials ? "include" : "omit"
    });
    let user = null;
    if (response.ok) {
      const data = await response.json();
      user = data?.user ?? null;
    }
    const linkResult = await this.linkGuestAccount();
    return {
      token,
      user,
      linkedComments: linkResult?.linkedComments ?? 0
    };
  }
  /**
   * Update/edit a comment
   */
  async updateComment(commentId, comment) {
    const token = await this.tokenManager.getToken();
    if (!token) {
      throw new Error("Authentication required. Please log in to edit comments.");
    }
    const headers = await this.getHeaders(true);
    const response = await fetch(`${this.baseUrl}/api/comment/${encodeURIComponent(commentId)}`, {
      method: "PATCH",
      headers,
      credentials: this.includeCredentials ? "include" : "omit",
      body: JSON.stringify({ comment })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update comment");
    }
    const data = await response.json();
    return data.comment;
  }
  /**
   * Delete a comment (soft delete)
   */
  async deleteComment(commentId) {
    const token = await this.tokenManager.getToken();
    if (!token) {
      throw new Error("Authentication required. Please log in to delete comments.");
    }
    const headers = await this.getHeaders(true);
    const response = await fetch(`${this.baseUrl}/api/comment/${encodeURIComponent(commentId)}`, {
      method: "DELETE",
      headers,
      credentials: this.includeCredentials ? "include" : "omit"
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete comment");
    }
  }
  /**
   * Logout (clear token)
   */
  logout() {
    this.tokenManager.clearToken();
  }
};

// src/browser.tsx
import React2 from "react";
import { createRoot } from "react-dom/client";

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
              hasReplies ? comment.replies.length + 1 : 1,
              " comments hidden"
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
    ] }) : data?.comments.length === 0 ? /* @__PURE__ */ jsx("div", { className: "komently-empty-state", children: /* @__PURE__ */ jsx("p", { children: "The silence is loud." }) }) : /* @__PURE__ */ jsx("div", { className: "komently-comments-wrapper", children: data?.comments.map((comment, i, arr) => /* @__PURE__ */ jsx(
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

// src/browser.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
function init(options) {
  const { container, ...props } = options;
  const target = typeof container === "string" ? document.getElementById(container) : container || document.getElementById("komently-container");
  if (!target) {
    console.warn("Komently: Target container not found.");
    return;
  }
  const root = createRoot(target);
  root.render(
    /* @__PURE__ */ jsx2(React2.StrictMode, { children: /* @__PURE__ */ jsx2(CommentSection, { ...props }) })
  );
}
function autoInit() {
  const selectors = ["[data-public-id]", "[data-section-id]", "#komently-container"];
  const containers = document.querySelectorAll(selectors.join(","));
  containers.forEach((el) => {
    if (el.hasAttribute("data-komently-initialized")) return;
    const publicId = el.getAttribute("data-public-id") || el.getAttribute("data-section-id");
    const baseUrl = el.getAttribute("data-base-url") || void 0;
    const pageSize = parseInt(el.getAttribute("data-page-size") || "5", 10);
    if (publicId) {
      el.setAttribute("data-komently-initialized", "true");
      const root = createRoot(el);
      root.render(
        /* @__PURE__ */ jsx2(React2.StrictMode, { children: /* @__PURE__ */ jsx2(
          CommentSection,
          {
            publicId,
            baseUrl,
            pageSize
          }
        ) })
      );
    }
  });
}
if (typeof window !== "undefined") {
  window.Komently = { init };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
}
export {
  CommentSection,
  GuestManager,
  KomentlyClient,
  TokenManager,
  configure,
  getApiKey,
  getBaseUrl,
  init
};
