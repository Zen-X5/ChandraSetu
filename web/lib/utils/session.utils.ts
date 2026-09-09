export const SESSION_TOKEN_KEY = 'access_token';
export const SESSION_COOKIE_NAME = 'chandrasetu_session';

export function setSessionCookie(token: string, days = 30) {
  if (typeof window === 'undefined') return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; expires=${expires}; path=/; SameSite=Lax`;
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function getSessionCookie(): string | null {
  if (typeof window === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + SESSION_COOKIE_NAME + ')=([^;]*)'));
  if (match) {
    return decodeURIComponent(match[3]);
  }
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function removeSessionCookie() {
  if (typeof window === 'undefined') return;
  document.cookie = `${SESSION_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

export function decodeJwtPayload<T = unknown>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload) as T;
  } catch {
    return null;
  }
}
