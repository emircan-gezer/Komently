import type { CommenterTokenResponse } from './types';
import { getBaseUrl } from './config';

const TOKEN_COOKIE_NAME = 'komently_session';

export class TokenManager {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getBaseUrl();
  }

  /**
   * Get stored commenter token from cookie only
   */
  getStoredToken(): string | null {
    if (typeof window === 'undefined') return null;

    // Read token from cookie
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === TOKEN_COOKIE_NAME && value) {
        return decodeURIComponent(value);
      }
    }

    return null;
  }

  /**
   * Store commenter token in cookie only
   */
  private storeToken(token: string): void {
    if (typeof window === 'undefined') return;

    // Set cookie (expires in 24 hours)
    const expires = new Date();
    expires.setTime(expires.getTime() + 24 * 60 * 60 * 1000);
    const isSecure = window.location.protocol === 'https:';
    // URL encode the token value to handle special characters
    const encodedToken = encodeURIComponent(token);
    document.cookie = `${TOKEN_COOKIE_NAME}=${encodedToken}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${isSecure ? '; Secure' : ''}`;
  }

  /**
   * Clear stored token (cookie only)
   */
  clearToken(): void {
    if (typeof window === 'undefined') return;

    // Clear cookie by setting it to expire in the past
    document.cookie = `${TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
  }

  /**
   * Fetch a new commenter token from the server
   * This requires the user to be authenticated via Clerk on the Komently domain
   */
  async fetchToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/token`, {
        method: 'GET',
        credentials: 'include', // Include cookies for Clerk session
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data: CommenterTokenResponse = await response.json();
      if (data.token) {
        this.storeToken(data.token);
        return data.token;
      }

      return null;
    } catch (error) {
      console.error('Error fetching commenter token:', error);
      return null;
    }
  }

  /**
   * Get or fetch token, fetching if not available or expired
   */
  async getToken(forceRefresh: boolean = false): Promise<string | null> {
    if (!forceRefresh) {
      const stored = this.getStoredToken();
      if (stored) return stored;
    }

    return await this.fetchToken();
  }

  /**
   * Open login popup and wait for authentication
   */
  openLoginPopup(redirectUrl?: string): Promise<string | null> {
    return new Promise((resolve) => {
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      // Get the origin of the page opening the popup (the SDK consumer)
      const origin = redirectUrl ? new URL(redirectUrl).origin : window.location.origin;
      
      // Redirect to OAuth callback which will handle token and postMessage
      const popupUrl = `${this.baseUrl}/sign-in?redirect_url=${encodeURIComponent(`${this.baseUrl}/komently/oauth?origin=${encodeURIComponent(origin)}`)}`;

      const popup = window.open(
        popupUrl,
        'komently-auth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        console.error('Failed to open popup. Please allow popups for this site.');
        resolve(null);
        return;
      }

      // Timeout after 5 minutes
      const timeoutTimer = setTimeout(() => {
        clearInterval(pollTimer);
        popup.close();
        resolve(null);
      }, 5 * 60 * 1000);

      // Poll for popup closure
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          clearTimeout(timeoutTimer);
          window.removeEventListener('message', messageHandler);
          // If popup closed without message, try to get token from cookie
          const token = this.getStoredToken();
          resolve(token);
        }
      }, 500);

      // Listen for auth success message from OAuth callback
      const messageHandler = (event: MessageEvent) => {
        // Only accept messages from the Komently base URL
        if (event.origin !== this.baseUrl) return;
        
        if (event.data.type === 'komently-auth-success') {
          window.removeEventListener('message', messageHandler);
          clearInterval(pollTimer);
          clearTimeout(timeoutTimer);
          
          const token = event.data.token;
          if (token) {
            // Store the token in cookie on the SDK consumer's domain
            this.storeToken(token);
            popup.close();
            resolve(token);
          } else {
            popup.close();
            resolve(null);
          }
        } else if (event.data.type === 'komently-auth-error') {
          window.removeEventListener('message', messageHandler);
          clearInterval(pollTimer);
          clearTimeout(timeoutTimer);
          console.error('Authentication error:', event.data.error);
          popup.close();
          resolve(null);
        }
      };

      window.addEventListener('message', messageHandler);
    });
  }
}

