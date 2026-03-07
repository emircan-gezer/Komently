export interface Comment {
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

