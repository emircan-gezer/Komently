import { getBaseUrl } from './config';

const GUEST_TOKEN_COOKIE_NAME = 'komently_guest_token';

export class GuestManager {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getBaseUrl();
  }

  /**
   * Get stored guest token from cookie
   */
  getStoredGuestToken(): string | null {
    if (typeof window === 'undefined') return null;

    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === GUEST_TOKEN_COOKIE_NAME && value) {
        return decodeURIComponent(value);
      }
    }

    return null;
  }

  /**
   * Store guest token in cookie
   */
  private storeGuestToken(token: string): void {
    if (typeof window === 'undefined') return;

    const expires = new Date();
    expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
    const isSecure = window.location.protocol === 'https:';
    const encodedToken = encodeURIComponent(token);
    document.cookie = `${GUEST_TOKEN_COOKIE_NAME}=${encodedToken}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${isSecure ? '; Secure' : ''}`;
  }

  /**
   * Get or fetch guest token
   */
  async getGuestToken(): Promise<string | null> {
    // Check if we already have a token
    const stored = this.getStoredGuestToken();
    if (stored) return stored;

    try {
      // Fetch new guest token from server
      const response = await fetch(`${this.baseUrl}/api/guest/token`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data.guestToken) {
        this.storeGuestToken(data.guestToken);
        return data.guestToken;
      }

      return null;
    } catch (error) {
      console.error('Error fetching guest token:', error);
      return null;
    }
  }

  /**
   * Clear guest token
   */
  clearGuestToken(): void {
    if (typeof window === 'undefined') return;
    document.cookie = `${GUEST_TOKEN_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
  }
}

