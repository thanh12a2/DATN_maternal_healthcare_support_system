import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiRequest } from '../services/api';
import { getCurrentUser, login as loginRequest, logout as logoutRequest, refresh, register as registerRequest, type AuthUser, type LoginResponse } from '../services/auth';
import type { LoginFormValues, RegisterFormValues } from '../schemas/auth';
import { autoRecordAudit } from '../services/auditInterceptor';

// Tách riêng biệt session key giữa Admin Portal và Patient/Staff để không đụng độ hay đè token của nhau
export function getSessionStorageKey(): string {
  if (typeof window === 'undefined') return 'an-tam-auth-session';
  const isPort3001 = window.location.port === '3001';
  const path = window.location.pathname.toLowerCase();
  const isAdminRoute = isPort3001 || path.startsWith('/admin') || path.startsWith('/workspace/admin');
  return isAdminRoute ? 'an-tam-admin-session' : 'an-tam-auth-session';
}

interface StoredSession extends LoginResponse { remember: boolean; }
type AuthStatus = 'loading' | 'anonymous' | 'authenticated';
interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signIn(values: LoginFormValues, remember: boolean): Promise<AuthUser>;
  signUp(values: RegisterFormValues): Promise<AuthUser>;
  signOut(): Promise<void>;
  request<T>(path: string, init?: RequestInit): Promise<T>;
  stream(path: string, signal?: AbortSignal): Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const key = getSessionStorageKey();
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const raw = storage.getItem(key);
      if (raw) return JSON.parse(raw) as StoredSession;
    } catch { /* ignore unavailable storage */ }
  }
  return null;
}

function persist(session: StoredSession | null) {
  if (typeof window === 'undefined') return;
  const key = getSessionStorageKey();
  window.localStorage.removeItem(key);
  window.sessionStorage.removeItem(key);
  if (!session) return;
  (session.remember ? window.localStorage : window.sessionStorage).setItem(key, JSON.stringify(session));
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(() => readStoredSession());
  const [status, setStatus] = useState<AuthStatus>(() => session ? 'loading' : 'anonymous');
  const sessionRef = useRef(session);
  const refreshRef = useRef<Promise<StoredSession> | null>(null);

  const commit = useCallback((next: StoredSession | null) => {
    sessionRef.current = next;
    setSession(next);
    setStatus(next ? 'authenticated' : 'anonymous');
    persist(next);
  }, []);

  const renew = useCallback(async () => {
    const current = sessionRef.current;
    if (!current?.refreshToken) throw new ApiError('Phiên đăng nhập đã hết hạn.', 401);
    if (!refreshRef.current) {
      refreshRef.current = refresh(current.refreshToken)
        .then((next) => ({ ...next, remember: current.remember }))
        .then((next) => { commit(next); return next; })
        .finally(() => { refreshRef.current = null; });
    }
    return refreshRef.current;
  }, [commit]);

  useEffect(() => {
    const initial = sessionRef.current;
    if (!initial) return;
    let active = true;
    getCurrentUser(initial.accessToken)
      .then(({ user }) => { if (active) commit({ ...initial, user }); })
      .catch(async (error) => {
        if (!active) return;
        try {
          if (error instanceof ApiError && error.statusCode === 401) await renew();
          else throw error;
        } catch { if (active) commit(null); }
      });
    return () => { active = false; };
  }, [commit, renew]);

  const signIn = useCallback(async (values: LoginFormValues, remember: boolean): Promise<AuthUser> => {
    const next = await loginRequest(values);
    commit({ ...next, remember });
    return next.user;
  }, [commit]);

  const signUp = useCallback(async (values: RegisterFormValues): Promise<AuthUser> => {
    await registerRequest(values);
    const next = await loginRequest(values);
    commit({ ...next, remember: true });
    return next.user;
  }, [commit]);

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    try { if (current?.refreshToken) await logoutRequest(current.refreshToken); }
    finally { commit(null); }
  }, [commit]);

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}) => {
    let current = sessionRef.current;
    if (!current) {
      if (path.startsWith('/api/catalog') || path.startsWith('/auth') || path.startsWith('/health')) {
        return apiRequest<T>(path, init);
      }
      throw new ApiError('Bạn cần đăng nhập để tiếp tục.', 401);
    }

    const method = (init.method || 'GET').toUpperCase();
    let bodyData: any = null;
    if (init.body && typeof init.body === 'string') {
      try { bodyData = JSON.parse(init.body); }
      catch { bodyData = { raw: init.body }; }
    }

    let result: T;
    let thrownError: any = null;
    try {
      result = await apiRequest<T>(path, init, current.accessToken);
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        current = await renew();
        try {
          result = await apiRequest<T>(path, init, current.accessToken);
          return result;
        } catch (retryError) {
          thrownError = retryError;
          throw retryError;
        }
      } else {
        thrownError = error;
        throw error;
      }
    } finally {
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const token = sessionRef.current?.accessToken || current?.accessToken;
        const currentUser = sessionRef.current?.user ?? null;
        // Chỉ ghi Audit Log khi người thực hiện là ADMIN hoặc đang thao tác ở admin portal/dịch vụ quản trị
        const isAdminOperation = currentUser?.role === 'ADMIN' || (typeof window !== 'undefined' && window.location.pathname.includes('/admin'));
        if (token && isAdminOperation) {
          autoRecordAudit(
            (p: string, i?: RequestInit) => apiRequest(p, i, token),
            method,
            path,
            bodyData,
            thrownError ? null : result!,
            thrownError,
            currentUser ? { userId: currentUser.userId, email: currentUser.email, role: currentUser.role } : null,
          );
        }
      }
    }
  }, [renew]);

  const stream = useCallback(async (path: string, signal?: AbortSignal): Promise<Response> => {
    let current = sessionRef.current;
    if (!current) throw new ApiError('Bạn cần đăng nhập để tiếp tục.', 401);
    let response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}${path}`, {
      headers: { Authorization: `Bearer ${current.accessToken}`, Accept: 'text/event-stream' },
      signal,
    });
    if (response.status === 401) {
      current = await renew();
      response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}${path}`, {
        headers: { Authorization: `Bearer ${current.accessToken}`, Accept: 'text/event-stream' },
        signal,
      });
    }
    if (!response.ok || !response.body) throw new ApiError('Không thể kết nối cập nhật hàng đợi.', response.status);
    return response;
  }, [renew]);

  const value = useMemo<AuthContextValue>(() => ({ status, user: session?.user ?? null, signIn, signUp, signOut, request, stream }), [status, session, signIn, signUp, signOut, request, stream]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuthSession must be used inside AuthSessionProvider');
  return value;
}
