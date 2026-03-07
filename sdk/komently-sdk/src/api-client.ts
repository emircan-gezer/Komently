import type {
  Comment,
  CommentSection,
  ReactionsResponse,
  UserResponse,
} from './types';
import { getBaseUrl, getApiKey } from './config';
import { TokenManager } from './token-manager';
import { GuestManager } from './guest-manager';

export class KomentlyClient {
  private baseUrl: string;
  private apiKey: string;
  private tokenManager: TokenManager;
  private guestManager: GuestManager;
  private cache: Map<string, { t: number; data: any }> = new Map();
  private inflight: Map<string, Promise<any>> = new Map();

  constructor(config?: { baseUrl?: string; apiKey?: string }) {
    this.baseUrl = config?.baseUrl?.replace(/\/$/, '') || getBaseUrl();
    this.apiKey = config?.apiKey || getApiKey();
    this.tokenManager = new TokenManager(this.baseUrl);
    this.guestManager = new GuestManager(this.baseUrl);
  }

  /**
   * Get authentication headers including API key, optional commenter token, and guest token
   */
  private async getHeaders(includeGuestToken: boolean = false): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-API-Key': this.apiKey,
    };

    const token = await this.tokenManager.getToken();
    if (token) {
      headers['X-Commenter-Token'] = token;
    }

    if (includeGuestToken && !token) {
      // Include guest token if not authenticated
      const guestToken = await this.guestManager.getGuestToken();
      if (guestToken) {
        headers['X-Guest-Token'] = guestToken;
      }
    }

    return headers;
  }

  /**
   * Fetch top-level comments for a section by publicId
   */
  async getComments(params: { publicId: string; pageSize?: number; page?: number; sorting?: string; replyDepth?: number }): Promise<{ comments: Comment[]; totalPages: number; totalCount: number; page: number }> {
    const search = new URLSearchParams();
    if (params.pageSize) search.set('pageSize', String(params.pageSize));
    if (params.page) search.set('page', String(params.page));
    if (params.sorting) search.set('sorting', params.sorting);
    if (params.replyDepth) search.set('replyDepth', String(params.replyDepth));

    const url = `${this.baseUrl}/api/comments/${encodeURIComponent(params.publicId)}?${search.toString()}`;
    const key = `comments:${url}`;
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && now - cached.t < 10_000) {
      return cached.data;
    }
    const inflight = this.inflight.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getHeaders(true),
        credentials: (this as any).includeCredentials ? 'include' : 'omit',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch comments');
      }

      const data = await response.json();
      const normalized = {
        comments: data.comments || [],
        totalPages: data.totalPages || 0,
        totalCount: data.totalCount || 0,
        page: data.page || 1,
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
  async createComment(
    publicId: string,
    body: string,
    options?: { parentId?: string }
  ): Promise<Comment> {
    const headers = await this.getHeaders(true);

    const response = await fetch(`${this.baseUrl}/api/comments/${encodeURIComponent(publicId)}/post`, {
      method: 'POST',
      headers,
      credentials: (this as any).includeCredentials ? 'include' : 'omit',
      body: JSON.stringify({
        body: body.trim(),
        parentId: options?.parentId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create comment');
    }

    return await response.json();
  }

  /**
   * Fetch replies for a given parent comment
   */
  async getReplies(params: { publicId: string; parentId: string; limit?: number; cursor?: string }): Promise<{ comments: Comment[]; nextCursor: string | null; hasMore: boolean }> {
    const search = new URLSearchParams();
    search.set('parentId', params.parentId);
    if (params.limit) search.set('limit', String(params.limit));
    if (params.cursor) search.set('cursor', params.cursor);

    const url = `${this.baseUrl}/api/comments/${encodeURIComponent(params.publicId)}/replies?${search.toString()}`;
    const key = `replies:${url}`;
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && now - cached.t < 10_000) {
      return cached.data;
    }
    const inflight = this.inflight.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getHeaders(),
        credentials: (this as any).includeCredentials ? 'include' : 'omit',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch replies');
      }

      const data = await response.json();
      const normalized = {
        comments: data.comments || [],
        nextCursor: data.nextCursor ?? null,
        hasMore: Boolean(data.hasMore),
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
  async getReactions(commentId: string): Promise<ReactionsResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/reactions?commentId=${commentId}`,
      {
        method: 'GET',
        headers: await this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch reactions');
    }

    return await response.json();
  }

  /**
   * Add or update a reaction (like/dislike)
   */
  async setReaction(commentId: string, value: 1 | -1 | 0): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/comments/vote`, {
      method: 'POST',
      headers: await this.getHeaders(true),
      credentials: (this as any).includeCredentials ? 'include' : 'omit',
      body: JSON.stringify({ commentId, value }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to set reaction: ${response.statusText}`);
    }

    return response.json();
  }

  async updateProfile(data: { username: string }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/commenters/me/update`, {
      method: 'POST',
      headers: await this.getHeaders(),
      credentials: (this as any).includeCredentials ? 'include' : 'omit',
      body: JSON.stringify(data),
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
  async getSectionByPublicId(publicId: string): Promise<CommentSection> {
    const response = await fetch(
      `${this.baseUrl}/api/sections/public/${publicId}`,
      {
        method: 'GET',
        headers: await this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch section');
    }

    const data = await response.json();
    return data.section;
  }

  /**
   * Get or fetch commenter token
   */
  async getCommenterToken(): Promise<string | null> {
    return await this.tokenManager.getToken();
  }

  /**
   * Get current user info using commenter JWT token
   */
  async getCurrentUser(): Promise<any | null> {
    const response = await fetch(`${this.baseUrl}/api/commenters/me`, {
      method: 'GET',
      headers: await this.getHeaders(),
    });

    if (!response.ok) return null;
    return await response.json();
  }

  /**
   * Link guest account to authenticated user
   */
  async linkGuestAccount(): Promise<{ success: boolean; linkedComments: number } | null> {
    const token = await this.tokenManager.getToken();
    const guestToken = await this.guestManager.getGuestToken();

    if (!token || !guestToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/guest/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Commenter-Token': token,
          'X-Guest-Token': guestToken,
        },
        credentials: (this as any).includeCredentials ? 'include' : 'omit',
      });

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.error('Error linking guest account:', error);
      return null;
    }
  }

  /**
   * Open login popup for authentication
   * After login, fetches user info using the JWT token and links guest account
   */
  async login(redirectUrl?: string): Promise<{
    token: string;
    user: {
      id: string | null;
      email: string | null;
      username: string | null;
      firstName: string | null;
      lastName: string | null;
      avatarUrl: string | null;
    } | null;
    linkedComments?: number;
  } | null> {
    // Get JWT token from login popup
    const token = await this.tokenManager.openLoginPopup(redirectUrl);
    if (!token) return null;

    // Fetch user info using the JWT token
    const response = await fetch(`${this.baseUrl}/api/user`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Commenter-Token': token,
      },
      credentials: (this as any).includeCredentials ? 'include' : 'omit',
    });

    let user = null;
    if (response.ok) {
      const data = await response.json();
      user = data?.user ?? null;
    }

    // Link guest account if available
    const linkResult = await this.linkGuestAccount();

    return {
      token,
      user,
      linkedComments: linkResult?.linkedComments ?? 0,
    };
  }

  /**
   * Update/edit a comment
   */
  async updateComment(commentId: string, comment: string): Promise<Comment> {
    const token = await this.tokenManager.getToken();
    if (!token) {
      throw new Error('Authentication required. Please log in to edit comments.');
    }

    const headers = await this.getHeaders(true); // Include guest token if not authenticated

    const response = await fetch(`${this.baseUrl}/api/comment/${encodeURIComponent(commentId)}`, {
      method: 'PATCH',
      headers,
      credentials: (this as any).includeCredentials ? 'include' : 'omit',
      body: JSON.stringify({ comment }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update comment');
    }

    const data = await response.json();
    return data.comment;
  }

  /**
   * Delete a comment (soft delete)
   */
  async deleteComment(commentId: string): Promise<void> {
    const token = await this.tokenManager.getToken();
    if (!token) {
      throw new Error('Authentication required. Please log in to delete comments.');
    }

    const headers = await this.getHeaders(true); // Include guest token if not authenticated

    const response = await fetch(`${this.baseUrl}/api/comment/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
      headers,
      credentials: (this as any).includeCredentials ? 'include' : 'omit',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete comment');
    }
  }

  /**
   * Logout (clear token)
   */
  logout(): void {
    this.tokenManager.clearToken();
  }
}

