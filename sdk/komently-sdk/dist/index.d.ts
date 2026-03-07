import * as react_jsx_runtime from 'react/jsx-runtime';

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

export { type ApiResponse, type CommentAuthor, type CommentData, CommentSection, type CommentSectionProps };
