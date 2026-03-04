import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Form } from '../ui/Form';
import { LogOut } from 'lucide-react';

export interface CommentFormProps {
  onSubmit: (text: string, username?: string) => Promise<void>;
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
}

export function CommentForm({ onSubmit, onLogin, isAuthenticated, currentUser, submitting, onLogout, allowGuestComments = false }: CommentFormProps) {
  const [value, setValue] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    // Guest name is handled automatically by the backend now via guest tokens
    await onSubmit(value);
    setValue('');
  };

  const canPost = isAuthenticated || allowGuestComments;

  return (
    <Form onSubmit={handleSubmit}>
      {allowGuestComments && !isAuthenticated && (
        <div className="komently-guest-message">
          <p className="komently-guest-text">
            Comment as guest or <button type="button" onClick={onLogin} className="komently-guest-login-link">login with Google, etc</button>
          </p>
        </div>
      )}
      {isAuthenticated && (
        <div className="komently-form-header">
          {currentUser?.avatarUrl ? (
            <img src={currentUser.avatarUrl} alt="avatar" className="komently-avatar" />
          ) : (
            <div className="komently-avatar-fallback" title="avatar">
              {(currentUser?.username || currentUser?.firstName || 'U').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="komently-user-name">
            {currentUser?.firstName || currentUser?.username || currentUser?.email || 'You'}
          </div>
          {onLogout && (
            <Button type="button" onClick={onLogout} title="Logout">
              <LogOut size={14} />
            </Button>
          )}
        </div>
      )}
      <Textarea
        placeholder={canPost ? 'Join the conversation...' : 'Log in to comment'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={!canPost || submitting}
        rows={2}
      />
      <div className="komently-actions">
        {!isAuthenticated && !allowGuestComments && (
          <Button type="button" onClick={onLogin}>
            Log in
          </Button>
        )}
        <Button type="submit" disabled={!canPost || submitting} className="komently-button-primary">
          {submitting ? 'Posting…' : 'Post'}
        </Button>
      </div>
    </Form>
  );
}

export default CommentForm;
