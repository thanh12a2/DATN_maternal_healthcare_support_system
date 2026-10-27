import { getSessionStorageKey } from '../../app/AuthSessionProvider';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  const key = getSessionStorageKey();
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.accessToken || null;
      }
    } catch {
      // ignore
    }
  }
  return null;
}
