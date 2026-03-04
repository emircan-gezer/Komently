export interface Comment {
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

export interface CommentSection {
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

export interface CommenterTokenResponse {
  token: string;
}

export interface UserResponse {
  user: {
    id: string;
    email: string | null;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
}

export interface Reaction {
  id: string;
  user_id: string;
  state: -1 | 0 | 1;
  created_at: string;
}

export interface ReactionsResponse {
  reactions: Reaction[];
  totals: {
    likes: number;
    dislikes: number;
  };
}

export interface KomentlyConfig {
  baseUrl: string;
  apiKey: string;
}

export interface EmbedConfig {
  sectionId: string;
  apiKey: string;
  publicId?: string;
  containerId?: string;
  theme?: 'light' | 'dark' | 'auto';
}

