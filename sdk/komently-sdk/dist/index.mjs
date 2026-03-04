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
    if (params.limit) search.set("limit", String(params.limit));
    if (params.cursor) search.set("cursor", params.cursor);
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
        // Optional cookie support when server is configured for credentials
        credentials: this.includeCredentials ? "include" : "omit"
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch comments");
      }
      const data = await response.json();
      const normalized = {
        comments: data.comments || [],
        nextCursor: data.nextCursor ?? null,
        hasMore: Boolean(data.hasMore),
        viewerId: data.viewerId ?? null,
        settings: data.settings || {}
      };
      this.cache.set(key, { t: Date.now(), data: normalized });
      this.inflight.delete(key);
      return normalized;
    })();
    this.inflight.set(key, promise);
    return promise;
  }
  /**
   * Create a new comment (or reply when replyTo provided)
   */
  async createComment(publicId, comment, options) {
    const headers = await this.getHeaders(true);
    const response = await fetch(`${this.baseUrl}/api/comments/${encodeURIComponent(publicId)}`, {
      method: "POST",
      headers,
      credentials: this.includeCredentials ? "include" : "omit",
      body: JSON.stringify({
        comment: comment.trim(),
        username: options?.username,
        reply_to: options?.replyTo
      })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create comment");
    }
    const data = await response.json();
    return data.comment;
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
  async setReaction(commentId, state) {
    const token = await this.tokenManager.getToken();
    if (!token) {
      throw new Error("Authentication required. Please log in to react to comments.");
    }
    const headers = await this.getHeaders(true);
    const response = await fetch(`${this.baseUrl}/api/comment/${encodeURIComponent(commentId)}/vote`, {
      method: "POST",
      headers,
      credentials: this.includeCredentials ? "include" : "omit",
      body: JSON.stringify({ state })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to set reaction");
    }
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
    const token = await this.tokenManager.getToken();
    if (!token) return null;
    const response = await fetch(`${this.baseUrl}/api/user`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Commenter-Token": token
      }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.user ?? null;
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

// src/components/CommentSection.tsx
import React6, { useCallback, useEffect as useEffect2, useMemo, useState as useState3 } from "react";

// src/components/ui/Button.tsx
import React from "react";
function Button(props) {
  const { className = "", ...rest } = props;
  return /* @__PURE__ */ React.createElement("button", { ...rest, className: `komently-button ${className}`.trim() });
}

// src/components/internal/CommentForm.tsx
import React4, { useState } from "react";

// src/components/ui/Textarea.tsx
import React2 from "react";
function Textarea(props) {
  const { className = "", ...rest } = props;
  return /* @__PURE__ */ React2.createElement("textarea", { ...rest, className: `komently-textarea ${className}`.trim() });
}

// src/components/ui/Form.tsx
import React3 from "react";
function Form(props) {
  const { className = "", ...rest } = props;
  return /* @__PURE__ */ React3.createElement("form", { ...rest, className: `komently-form ${className}`.trim() });
}

// src/components/internal/CommentForm.tsx
import { LogOut } from "lucide-react";
function CommentForm({ onSubmit, onLogin, isAuthenticated, currentUser, submitting, onLogout, allowGuestComments = false }) {
  const [value, setValue] = useState("");
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    await onSubmit(value);
    setValue("");
  };
  const canPost = isAuthenticated || allowGuestComments;
  return /* @__PURE__ */ React4.createElement(Form, { onSubmit: handleSubmit }, allowGuestComments && !isAuthenticated && /* @__PURE__ */ React4.createElement("div", { className: "komently-guest-message" }, /* @__PURE__ */ React4.createElement("p", { className: "komently-guest-text" }, "Comment as guest or ", /* @__PURE__ */ React4.createElement("button", { type: "button", onClick: onLogin, className: "komently-guest-login-link" }, "login with Google, etc"))), isAuthenticated && /* @__PURE__ */ React4.createElement("div", { className: "komently-form-header" }, currentUser?.avatarUrl ? /* @__PURE__ */ React4.createElement("img", { src: currentUser.avatarUrl, alt: "avatar", className: "komently-avatar" }) : /* @__PURE__ */ React4.createElement("div", { className: "komently-avatar-fallback", title: "avatar" }, (currentUser?.username || currentUser?.firstName || "U").slice(0, 1).toUpperCase()), /* @__PURE__ */ React4.createElement("div", { className: "komently-user-name" }, currentUser?.firstName || currentUser?.username || currentUser?.email || "You"), onLogout && /* @__PURE__ */ React4.createElement(Button, { type: "button", onClick: onLogout, title: "Logout" }, /* @__PURE__ */ React4.createElement(LogOut, { size: 14 }))), /* @__PURE__ */ React4.createElement(
    Textarea,
    {
      placeholder: canPost ? "Join the conversation..." : "Log in to comment",
      value,
      onChange: (e) => setValue(e.target.value),
      disabled: !canPost || submitting,
      rows: 2
    }
  ), /* @__PURE__ */ React4.createElement("div", { className: "komently-actions" }, !isAuthenticated && !allowGuestComments && /* @__PURE__ */ React4.createElement(Button, { type: "button", onClick: onLogin }, "Log in"), /* @__PURE__ */ React4.createElement(Button, { type: "submit", disabled: !canPost || submitting, className: "komently-button-primary" }, submitting ? "Posting\u2026" : "Post")));
}

// src/components/internal/CommentItem.tsx
import React5, { useState as useState2, useEffect } from "react";
import { ArrowBigUp, ArrowBigDown, MessageSquare, ChevronDown, ChevronRight, Trash2, Share2, Edit } from "lucide-react";
function CommentItemBase({
  comment,
  onReply,
  onDelete,
  onEdit,
  onLike,
  onDislike,
  collapsed,
  toggleCollapse,
  currentUserId
}) {
  const [showReply, setShowReply] = useState2(false);
  const [showEdit, setShowEdit] = useState2(false);
  const [text, setText] = useState2("");
  const [editText, setEditText] = useState2(comment.comment);
  useEffect(() => {
    if (!showEdit) {
      setEditText(comment.comment);
    }
  }, [comment.comment, showEdit]);
  const displayName = comment.author?.firstName && comment.author?.lastName ? `${comment.author.firstName} ${comment.author.lastName}` : comment.author?.username || comment.metadata?.guest_name || "Anonymous";
  const displayAvatar = comment.author?.avatarUrl;
  const likes = comment.reactions?.likes ?? 0;
  const dislikes = comment.reactions?.dislikes ?? 0;
  const total = comment.reactions?.total ?? likes - dislikes;
  const likeState = comment.likeState ?? 0;
  return /* @__PURE__ */ React5.createElement("div", { className: `komently-comment ${collapsed ? "collapsed" : ""}` }, comment.reply_to && /* @__PURE__ */ React5.createElement(
    "div",
    {
      className: "komently-comment-thread-line",
      onClick: () => toggleCollapse(comment.id),
      role: "button",
      tabIndex: 0,
      "aria-label": collapsed ? "Expand comment" : "Collapse comment"
    }
  ), /* @__PURE__ */ React5.createElement("div", { className: "komently-comment-content" }, /* @__PURE__ */ React5.createElement("div", { className: "komently-comment-header" }, /* @__PURE__ */ React5.createElement(Button, { type: "button", className: "komently-collapse-toggle", onClick: () => toggleCollapse(comment.id), "aria-label": "Toggle" }, collapsed ? /* @__PURE__ */ React5.createElement(ChevronRight, { size: 16 }) : /* @__PURE__ */ React5.createElement(ChevronDown, { size: 16 })), displayAvatar ? /* @__PURE__ */ React5.createElement("img", { src: displayAvatar, alt: "avatar", className: "komently-avatar" }) : /* @__PURE__ */ React5.createElement("div", { className: "komently-avatar-fallback", title: "avatar" }, (displayName || "U").slice(0, 1).toUpperCase()), /* @__PURE__ */ React5.createElement("div", { className: "komently-comment-username" }, displayName), comment.edited_at && /* @__PURE__ */ React5.createElement("span", { className: "komently-edited-badge", title: `Edited ${new Date(comment.edited_at).toLocaleString()}` }, "edited"), comment.isShared && /* @__PURE__ */ React5.createElement("span", { className: "komently-shared-badge", title: "This comment has been shared" }, /* @__PURE__ */ React5.createElement(Share2, { size: 12 })), /* @__PURE__ */ React5.createElement("div", { className: "komently-spacer" }), comment.user_id === currentUserId && !comment.deleted_at && /* @__PURE__ */ React5.createElement(React5.Fragment, null, onEdit && /* @__PURE__ */ React5.createElement(Button, { onClick: () => setShowEdit(true), className: "komently-icon-btn", title: "Edit" }, /* @__PURE__ */ React5.createElement(Edit, { size: 14 })), onDelete && /* @__PURE__ */ React5.createElement(Button, { onClick: () => onDelete(comment.id), className: "komently-icon-btn", title: "Delete" }, /* @__PURE__ */ React5.createElement(Trash2, { size: 14 })))), !collapsed && /* @__PURE__ */ React5.createElement(React5.Fragment, null, comment.deleted_at ? /* @__PURE__ */ React5.createElement("div", { className: "komently-deleted-badge" }, /* @__PURE__ */ React5.createElement("span", { className: "komently-deleted-text" }, "This comment is deleted by ", comment.deletion_type === "moderator" ? "moderator" : "commenter")) : showEdit && onEdit ? /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement(
    Textarea,
    {
      value: editText,
      onChange: (e) => setEditText(e.target.value),
      className: "komently-textarea",
      rows: 2
    }
  ), /* @__PURE__ */ React5.createElement("div", { className: "komently-actions" }, /* @__PURE__ */ React5.createElement(
    Button,
    {
      onClick: async () => {
        if (!editText.trim()) return;
        await onEdit(comment.id, editText);
        setShowEdit(false);
      },
      className: "komently-button"
    },
    "Save"
  ), /* @__PURE__ */ React5.createElement(Button, { onClick: () => {
    setShowEdit(false);
    setEditText(comment.comment);
  }, className: "komently-button" }, "Cancel"))) : /* @__PURE__ */ React5.createElement("div", { className: "komently-comment-body" }, comment.comment), /* @__PURE__ */ React5.createElement("div", { className: "komently-comment-toolbar" }, /* @__PURE__ */ React5.createElement("div", { className: "komently-vote" }, /* @__PURE__ */ React5.createElement(Button, { type: "button", className: `komently-vote-btn ${likeState === 1 ? "is-active" : ""}`, onClick: () => onLike?.(comment.id, likeState === 1 ? 0 : 1) }, /* @__PURE__ */ React5.createElement(ArrowBigUp, { size: 14 })), /* @__PURE__ */ React5.createElement("div", { className: "komently-score", title: `+${likes} / -${dislikes}` }, total), /* @__PURE__ */ React5.createElement(Button, { type: "button", className: `komently-vote-btn ${likeState === -1 ? "is-active" : ""}`, onClick: () => onDislike?.(comment.id, likeState === -1 ? 0 : -1) }, /* @__PURE__ */ React5.createElement(ArrowBigDown, { size: 14 }))), /* @__PURE__ */ React5.createElement(Button, { type: "button", onClick: () => setShowReply((s) => !s), className: "komently-icon-btn", title: "Reply" }, /* @__PURE__ */ React5.createElement(MessageSquare, { size: 14 }), /* @__PURE__ */ React5.createElement("span", null, "Reply"))), showReply && /* @__PURE__ */ React5.createElement("div", { className: "komently-reply-form" }, /* @__PURE__ */ React5.createElement(
    Textarea,
    {
      value: text,
      onChange: (e) => setText(e.target.value),
      placeholder: "Write a reply...",
      className: "komently-textarea",
      rows: 2
    }
  ), /* @__PURE__ */ React5.createElement("div", { className: "komently-actions" }, /* @__PURE__ */ React5.createElement(
    Button,
    {
      onClick: async () => {
        if (!text.trim()) return;
        await onReply(comment.id, text);
        setText("");
        setShowReply(false);
      },
      className: "komently-button"
    },
    "Post"
  ), /* @__PURE__ */ React5.createElement(Button, { onClick: () => setShowReply(false), className: "komently-button" }, "Cancel"))))));
}
var CommentItem = React5.memo(CommentItemBase);

// src/components/CommentSection.tsx
function CommentSection(props) {
  const { publicId, apiKey, baseUrl } = props;
  const client = useMemo(() => new KomentlyClient({ apiKey, baseUrl }), [apiKey, baseUrl]);
  const [comments, setComments] = useState3([]);
  const [nextCursor, setNextCursor] = useState3(null);
  const [loadingMore, setLoadingMore] = useState3(false);
  const [loading, setLoading] = useState3(true);
  const [error, setError] = useState3(null);
  const [submitting, setSubmitting] = useState3(false);
  const [isAuthenticated, setIsAuthenticated] = useState3(false);
  const [collapsedIds, setCollapsedIds] = useState3({});
  const toggleCollapse = useCallback((id) => {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);
  const [currentUser, setCurrentUser] = useState3(null);
  const [viewerId, setViewerId] = useState3(null);
  const [sectionSettings, setSectionSettings] = useState3({});
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
      setError(e instanceof Error ? e.message : "Failed to load comments");
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
      if (user?.id) setViewerId(user.id);
    } else {
      setCurrentUser(null);
      setViewerId(null);
    }
  }, [client]);
  useEffect2(() => {
    load();
    refreshAuth();
  }, [load, refreshAuth]);
  const handleLogin = useCallback(async () => {
    const result = await client.login();
    if (result?.linkedComments && result.linkedComments > 0) {
      await load();
    }
    await refreshAuth();
  }, [client, refreshAuth, load]);
  const handleCreate = useCallback(
    async (text) => {
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
    async (parentId, text) => {
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
  const handleLike = useCallback(
    async (commentId, state) => {
      if (props.onLike) return props.onLike(commentId, state);
      setComments((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        const target = byId.get(commentId);
        if (!target) return prev;
        const prevState = target.likeState ?? 0;
        const reactions = target.reactions || { likes: 0, dislikes: 0, total: 0 };
        let { likes, dislikes } = reactions;
        if (prevState === 1) likes = Math.max(0, likes - 1);
        if (prevState === -1) dislikes = Math.max(0, dislikes - 1);
        if (state === 1) likes += 1;
        if (state === -1) dislikes += 1;
        const total = likes - dislikes;
        const updated = { ...target, likeState: state, reactions: { likes, dislikes, total } };
        byId.set(commentId, updated);
        return prev.map((c) => c.id === commentId ? updated : c);
      });
      try {
        await client.setReaction(commentId, state);
      } catch (e) {
        setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, likeState: 0 } : c));
      }
    },
    [client, props]
  );
  const handleDislike = useCallback(
    async (commentId, state) => {
      if (props.onDislike) return props.onDislike(commentId, state);
      await handleLike(commentId, state);
    },
    [handleLike, props]
  );
  const handleEdit = useCallback(
    async (commentId, text) => {
      if (props.onEdit) return props.onEdit(commentId, text);
      const updated = await client.updateComment(commentId, text);
      setComments((prev) => {
        const updateComment = (c) => {
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
    async (commentId) => {
      if (props.onDelete) return props.onDelete(commentId);
      await client.deleteComment(commentId);
      setComments((prev) => {
        const markDeleted = (c) => {
          if (c.id === commentId) {
            return { ...c, deleted_at: (/* @__PURE__ */ new Date()).toISOString(), deletion_type: "commenter" };
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
  const renderOne = (comment) => {
    const common = {
      comment,
      onReply: handleReply,
      onDelete: handleDelete,
      onEdit: handleEdit,
      onLike: handleLike,
      onDislike: handleDislike,
      collapsed: Boolean(collapsedIds[comment.id]),
      toggleCollapse,
      currentUserId: viewerId
    };
    if (props.renderComment) return props.renderComment(common);
    return /* @__PURE__ */ React6.createElement(CommentItem, { ...common });
  };
  const renderChildren = (node) => {
    const children = node?.replies || [];
    if (!children || children.length === 0) return null;
    return /* @__PURE__ */ React6.createElement("div", { className: "komently-replies" }, children.map((r) => /* @__PURE__ */ React6.createElement("div", { key: r.id }, renderOne(r), !collapsedIds[r.id] && renderChildren(r))));
  };
  return /* @__PURE__ */ React6.createElement("div", { className: "komently-comment-section" }, (props.renderForm || ((args) => /* @__PURE__ */ React6.createElement(CommentForm, { ...args })))({
    onSubmit: handleCreate,
    onLogin: handleLogin,
    isAuthenticated,
    currentUser,
    submitting,
    onLogout: () => client.logout(),
    allowGuestComments: sectionSettings.allow_guest_comments ?? false
  }), loading && /* @__PURE__ */ React6.createElement("div", { className: "komently-loading" }, "Loading comments\u2026"), error && /* @__PURE__ */ React6.createElement("div", { className: "komently-error" }, error), !loading && !error && comments.length === 0 && /* @__PURE__ */ React6.createElement("div", { className: "komently-empty" }, "No comments yet. Be the first to comment!"), /* @__PURE__ */ React6.createElement("div", { className: "komently-replies" }, comments.filter((c) => !c.reply_to).map((c) => /* @__PURE__ */ React6.createElement("div", { key: c.id }, renderOne(c), !collapsedIds[c.id] && renderChildren(c)))), nextCursor && /* @__PURE__ */ React6.createElement("div", { className: "komently-actions" }, /* @__PURE__ */ React6.createElement(Button, { type: "button", onClick: loadMore, disabled: loadingMore }, loadingMore ? "Loading\u2026" : "Load more comments")));
}

// src/index.ts
function createClient(config) {
  return new KomentlyClient(config);
}
function embedComments(config) {
  if (typeof window === "undefined") return;
  const containerId = config.containerId || "komently-comments";
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Komently: Container with ID "${containerId}" not found`);
    return;
  }
  const iframe = document.createElement("iframe");
  const baseUrl = getBaseUrl();
  const iframeSrc = `${baseUrl}/embed/${config.publicId || config.sectionId}?apiKey=${encodeURIComponent(config.apiKey)}`;
  iframe.src = iframeSrc;
  iframe.style.width = "100%";
  iframe.style.border = "none";
  iframe.style.minHeight = "400px";
  iframe.setAttribute("title", "Komently Comments");
  iframe.setAttribute("loading", "lazy");
  window.addEventListener("message", (event) => {
    if (event.origin !== baseUrl) return;
    if (event.data.type === "komently-resize") {
      iframe.style.height = event.data.height + "px";
    }
  });
  container.appendChild(iframe);
}
export {
  CommentSection,
  KomentlyClient,
  TokenManager,
  configure,
  createClient,
  embedComments,
  getApiKey,
  getBaseUrl
};
