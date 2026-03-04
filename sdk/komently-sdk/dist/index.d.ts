import React from 'react';

interface Comment {
    id: string;
    comment: string;
    reply_to: string | null;
    created_at: string;
    updated_at: string;
    edited_at?: string | null;
    deleted_at?: string | null;
    deleted_by?: string | null;
    deletion_type?: 'commenter' | 'moderator' | null;
    user_id: string | null;
    metadata?: {
        guest_name?: string | null;
        [key: string]: unknown;
    };
    author?: {
        username: string | null;
        firstName: string | null;
        lastName: string | null;
        avatarUrl: string | null;
    } | null;
    replies?: Comment[];
    reactions?: {
        likes: number;
        dislikes: number;
        total: number;
    };
    likeState?: -1 | 0 | 1;
    isShared?: boolean;
}
interface CommentSection$1 {
    id: string;
    public_id: string;
    title: string | null;
    description: string | null;
    settings: {
        allow_guest_comments?: boolean;
        require_moderation?: boolean;
        allow_nested_replies?: boolean;
        max_reply_depth?: number;
    };
    is_active: boolean;
}
interface CommenterTokenResponse {
    token: string;
}
interface UserResponse {
    user: {
        id: string;
        email: string | null;
        username: string | null;
        firstName: string | null;
        lastName: string | null;
        avatarUrl: string | null;
    };
}
interface Reaction {
    id: string;
    user_id: string;
    state: -1 | 0 | 1;
    created_at: string;
}
interface ReactionsResponse {
    reactions: Reaction[];
    totals: {
        likes: number;
        dislikes: number;
    };
}
interface KomentlyConfig {
    baseUrl: string;
    apiKey: string;
}
interface EmbedConfig {
    sectionId: string;
    apiKey: string;
    publicId?: string;
    containerId?: string;
    theme?: 'light' | 'dark' | 'auto';
}

declare function configure(config: {
    baseUrl: string;
    apiKey?: string;
}): void;
declare function getBaseUrl(): string;
declare function getApiKey(): string;

declare class KomentlyClient {
    private baseUrl;
    private apiKey;
    private tokenManager;
    private guestManager;
    private cache;
    private inflight;
    constructor(config?: {
        baseUrl?: string;
        apiKey?: string;
    });
    /**
     * Get authentication headers including API key, optional commenter token, and guest token
     */
    private getHeaders;
    /**
     * Fetch top-level comments for a section by publicId
     */
    getComments(params: {
        publicId: string;
        limit?: number;
        cursor?: string;
        replyDepth?: number;
    }): Promise<{
        comments: Comment[];
        nextCursor: string | null;
        hasMore: boolean;
        viewerId: string | null;
        settings?: any;
    }>;
    /**
     * Create a new comment (or reply when replyTo provided)
     */
    createComment(publicId: string, comment: string, options?: {
        username?: string;
        replyTo?: string;
    }): Promise<Comment>;
    /**
     * Fetch replies for a given parent comment
     */
    getReplies(params: {
        publicId: string;
        parentId: string;
        limit?: number;
        cursor?: string;
    }): Promise<{
        comments: Comment[];
        nextCursor: string | null;
        hasMore: boolean;
    }>;
    /**
     * Get reactions for a comment
     */
    getReactions(commentId: string): Promise<ReactionsResponse>;
    /**
     * Add or update a reaction (like/dislike)
     */
    setReaction(commentId: string, state: -1 | 0 | 1): Promise<void>;
    /**
     * Get section details by public ID
     */
    getSectionByPublicId(publicId: string): Promise<CommentSection$1>;
    /**
     * Get or fetch commenter token
     */
    getCommenterToken(): Promise<string | null>;
    /**
     * Get current user info using commenter JWT token
     */
    getCurrentUser(): Promise<{
        id: string | null;
        email: string | null;
        username: string | null;
        firstName: string | null;
        lastName: string | null;
        avatarUrl: string | null;
    } | null>;
    /**
     * Link guest account to authenticated user
     */
    linkGuestAccount(): Promise<{
        success: boolean;
        linkedComments: number;
    } | null>;
    /**
     * Open login popup for authentication
     * After login, fetches user info using the JWT token and links guest account
     */
    login(redirectUrl?: string): Promise<{
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
    } | null>;
    /**
     * Update/edit a comment
     */
    updateComment(commentId: string, comment: string): Promise<Comment>;
    /**
     * Delete a comment (soft delete)
     */
    deleteComment(commentId: string): Promise<void>;
    /**
     * Logout (clear token)
     */
    logout(): void;
}

declare class TokenManager {
    private baseUrl;
    constructor(baseUrl?: string);
    /**
     * Get stored commenter token from cookie only
     */
    getStoredToken(): string | null;
    /**
     * Store commenter token in cookie only
     */
    private storeToken;
    /**
     * Clear stored token (cookie only)
     */
    clearToken(): void;
    /**
     * Fetch a new commenter token from the server
     * This requires the user to be authenticated via Clerk on the Komently domain
     */
    fetchToken(): Promise<string | null>;
    /**
     * Get or fetch token, fetching if not available or expired
     */
    getToken(forceRefresh?: boolean): Promise<string | null>;
    /**
     * Open login popup and wait for authentication
     */
    openLoginPopup(redirectUrl?: string): Promise<string | null>;
}

type ReactionHandler = (commentId: string, state: -1 | 0 | 1) => Promise<void> | void;
interface CommentSectionProps {
    publicId: string;
    apiKey: string;
    baseUrl?: string;
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
    onLike?: ReactionHandler;
    onDislike?: ReactionHandler;
    onDelete?: (commentId: string) => Promise<void>;
    onEdit?: (commentId: string, text: string) => Promise<void>;
}
declare function CommentSection(props: CommentSectionProps): React.JSX.Element;

declare function createClient(config?: {
    baseUrl?: string;
    apiKey?: string;
}): KomentlyClient;
/**
 * Easy embed function (for non-React usage)
 */
declare function embedComments(config: EmbedConfig): void;

export { type Comment, CommentSection, type CommentSectionProps, type CommenterTokenResponse, type EmbedConfig, KomentlyClient, type KomentlyConfig, type Reaction, type ReactionHandler, type ReactionsResponse, TokenManager, type UserResponse, configure, createClient, embedComments, getApiKey, getBaseUrl };
