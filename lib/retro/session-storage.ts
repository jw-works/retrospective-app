// Browser storage helpers for active session and participant tokens.
export const ACTIVE_SLUG_KEY = "retro.activeSlug";

export function tokenKey(slug: string) {
  return `retro.token.${slug}`;
}

export function getStoredActiveSlug() {
  return localStorage.getItem(ACTIVE_SLUG_KEY);
}

export function setStoredActiveSlug(slug: string) {
  localStorage.setItem(ACTIVE_SLUG_KEY, slug);
}

export function clearStoredActiveSlug() {
  localStorage.removeItem(ACTIVE_SLUG_KEY);
}

export function getStoredToken(slug: string) {
  return localStorage.getItem(tokenKey(slug)) ?? "";
}

export function setStoredToken(slug: string, token: string) {
  localStorage.setItem(tokenKey(slug), token);
}

export function clearStoredToken(slug: string) {
  localStorage.removeItem(tokenKey(slug));
}
