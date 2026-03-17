import * as react_jsx_runtime from 'react/jsx-runtime';

interface Comment {
    id: string;
    author: {
        username: string;
        avatarInitial: string;
        color: string;
    };
    body: string;
    likes: number;
    dislikes: number;
    myVote: 1 | -1 | 0;
    createdAt: string;
    replies?: Comment[];
}
interface CommentSectionData {
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
        pageSize?: number;
        page?: number;
        sorting?: string;
        replyDepth?: number;
    }): Promise<{
        comments: Comment[];
        totalPages: number;
        totalCount: number;
        page: number;
    }>;
    /**
     * Create a new comment (or reply when parentId provided)
     */
    createComment(publicId: string, body: string, options?: {
        parentId?: string;
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
    setReaction(commentId: string, value: 1 | -1 | 0): Promise<any>;
    updateProfile(data: {
        username: string;
    }): Promise<any>;
    /**
     * Get section details by public ID
     */
    getSectionByPublicId(publicId: string): Promise<CommentSectionData>;
    /**
     * Get or fetch commenter token
     */
    getCommenterToken(): Promise<string | null>;
    /**
     * Get current user info using commenter JWT token
     */
    getCurrentUser(): Promise<any | null>;
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

interface CommentAuthor {
    username: string;
    avatarInitial: string;
    color: string;
}
interface CommentData {
    id: string;
    author: CommentAuthor;
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
interface CommentSectionProps {
    publicId: string;
    pageSize?: number;
    commenterToken?: string | null;
    baseUrl?: string;
    onLogin?: () => void;
}
declare function CommentSection({ publicId, pageSize, commenterToken: externalToken, baseUrl, // Default base URL
onLogin, }: CommentSectionProps): react_jsx_runtime.JSX.Element;

/**
 * Komently Browser SDK
 * Auto-mounts to <div id="komently-container"> or elements with [data-public-id]
 */
declare function init(options: CommentSectionProps & {
    container?: string | HTMLElement;
}): void;

declare function configure(config: {
    baseUrl: string;
    apiKey?: string;
}): void;
declare function getBaseUrl(): string;
declare function getApiKey(): string;

declare class GuestManager {
    private baseUrl;
    constructor(baseUrl?: string);
    /**
     * Get stored guest token from cookie
     */
    getStoredGuestToken(): string | null;
    /**
     * Store guest token in cookie
     */
    private storeGuestToken;
    /**
     * Get or fetch guest token
     */
    getGuestToken(): Promise<string | null>;
    /**
     * Clear guest token
     */
    clearGuestToken(): void;
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

export { type ApiResponse, type Comment, type CommentAuthor, type CommentData, CommentSection, type CommentSectionData, type CommentSectionProps, type CommenterTokenResponse, type EmbedConfig, GuestManager, KomentlyClient, type KomentlyConfig, type Reaction, type ReactionsResponse, TokenManager, type UserResponse, configure, getApiKey, getBaseUrl, init };
