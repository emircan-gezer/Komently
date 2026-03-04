import React, { useState, useEffect } from 'react';
import type { Comment } from '../../types';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { ArrowBigUp, ArrowBigDown, MessageSquare, ChevronDown, ChevronRight, Trash2, Share2, Edit } from 'lucide-react';

export type ReactionHandler = (commentId: string, state: -1 | 0 | 1) => Promise<void> | void;

function CommentItemBase({
  comment,
  onReply,
  onDelete,
  onEdit,
  onLike,
  onDislike,
  collapsed,
  toggleCollapse,
  currentUserId,
}: {
  comment: Comment;
  onReply: (parentId: string, text: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onEdit?: (commentId: string, text: string) => Promise<void>;
  onLike?: ReactionHandler;
  onDislike?: ReactionHandler;
  collapsed: boolean;
  toggleCollapse: (commentId: string) => void;
  currentUserId?: string | null;
}) {
  const [showReply, setShowReply] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [text, setText] = useState('');
  const [editText, setEditText] = useState(comment.comment);

  // Update editText when comment changes
  useEffect(() => {
    if (!showEdit) {
      setEditText(comment.comment);
    }
  }, [comment.comment, showEdit]);

  const displayName =
    comment.author?.firstName && comment.author?.lastName
      ? `${comment.author.firstName} ${comment.author.lastName}`
      : comment.author?.username || comment.metadata?.guest_name || 'Anonymous';

  const displayAvatar = comment.author?.avatarUrl;
  const likes = comment.reactions?.likes ?? 0;
  const dislikes = comment.reactions?.dislikes ?? 0;
  const total = comment.reactions?.total ?? likes - dislikes;
  const likeState = comment.likeState ?? 0;

  return (
    <div className={`komently-comment ${collapsed ? 'collapsed' : ''}`}>
      {/* Thread line only shown for nested replies, positioned via CSS */}
      {comment.reply_to && (
        <div 
          className="komently-comment-thread-line" 
          onClick={() => toggleCollapse(comment.id)}
          role="button"
          tabIndex={0}
          aria-label={collapsed ? 'Expand comment' : 'Collapse comment'}
        />
      )}
      <div className="komently-comment-content">
        <div className="komently-comment-header">
        <Button type="button" className="komently-collapse-toggle" onClick={() => toggleCollapse(comment.id)} aria-label="Toggle">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </Button>
        {displayAvatar ? (
          <img src={displayAvatar} alt="avatar" className="komently-avatar" />
        ) : (
          <div className="komently-avatar-fallback" title="avatar">
            {(displayName || 'U').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="komently-comment-username">{displayName}</div>
        {comment.edited_at && (
          <span className="komently-edited-badge" title={`Edited ${new Date(comment.edited_at).toLocaleString()}`}>
            edited
          </span>
        )}
        {comment.isShared && (
          <span className="komently-shared-badge" title="This comment has been shared">
            <Share2 size={12} />
          </span>
        )}
        <div className="komently-spacer" />
        {comment.user_id === currentUserId && !comment.deleted_at && (
          <>
            {onEdit && (
              <Button onClick={() => setShowEdit(true)} className="komently-icon-btn" title="Edit">
                <Edit size={14} />
              </Button>
            )}
            {onDelete && (
              <Button onClick={() => onDelete(comment.id)} className="komently-icon-btn" title="Delete">
                <Trash2 size={14} />
              </Button>
            )}
          </>
        )}
      </div>
      {!collapsed && (
        <>
          {comment.deleted_at ? (
            <div className="komently-deleted-badge">
              <span className="komently-deleted-text">
                This comment is deleted by {comment.deletion_type === 'moderator' ? 'moderator' : 'commenter'}
              </span>
            </div>
          ) : showEdit && onEdit ? (
            <div>
              <Textarea 
                value={editText} 
                onChange={(e) => setEditText(e.target.value)} 
                className="komently-textarea"
                rows={2}
              />
              <div className="komently-actions">
                <Button
                  onClick={async () => {
                    if (!editText.trim()) return;
                    await onEdit(comment.id, editText);
                    setShowEdit(false);
                  }}
                  className="komently-button"
                >
                  Save
                </Button>
                <Button onClick={() => { setShowEdit(false); setEditText(comment.comment); }} className="komently-button">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="komently-comment-body">{comment.comment}</div>
          )}
          <div className="komently-comment-toolbar">
            <div className="komently-vote">
              <Button type="button" className={`komently-vote-btn ${likeState === 1 ? 'is-active' : ''}`} onClick={() => onLike?.(comment.id, likeState === 1 ? 0 : 1)}>
                <ArrowBigUp size={14} />
              </Button>
              <div className="komently-score" title={`+${likes} / -${dislikes}`}>{total}</div>
              <Button type="button" className={`komently-vote-btn ${likeState === -1 ? 'is-active' : ''}`} onClick={() => onDislike?.(comment.id, likeState === -1 ? 0 : -1)}>
                <ArrowBigDown size={14} />
              </Button>
            </div>
            <Button type="button" onClick={() => setShowReply((s) => !s)} className="komently-icon-btn" title="Reply">
              <MessageSquare size={14} />
              <span>Reply</span>
            </Button>
          </div>
          {showReply && (
            <div className="komently-reply-form">
              <Textarea 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                placeholder="Write a reply..."
                className="komently-textarea"
                rows={2}
              />
              <div className="komently-actions">
                <Button
                  onClick={async () => {
                    if (!text.trim()) return;
                    await onReply(comment.id, text);
                    setText('');
                    setShowReply(false);
                  }}
                  className="komently-button"
                >
                  Post
                </Button>
                <Button onClick={() => setShowReply(false)} className="komently-button">Cancel</Button>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}

export const CommentItem = React.memo(CommentItemBase);


