import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiRequest } from '../services/api';
import { getCurrentUser, login as loginRequest, logout as logoutRequest, refresh, register as registerRequest, type AuthUser, type LoginResponse } from '../services/auth';
import type { LoginFormValues, RegisterFormValues } from '../schemas/auth';

const SESSION_KEY = 'an-tam-auth-session';
interface StoredSession extends LoginResponse { remember: boolean; }
type AuthStatus = 'loading' | 'anonymous' | 'authenticated';
interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signIn(values: LoginFormValues, remember: boolean): Promise<void>;
  signUp(values: RegisterFormValues): Promise<void>;
  signOut(): Promise<void>;
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const raw = storage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw) as StoredSession;
    } catch { /* ignore unavailable storage */ }
  }
  return null;
}

function persist(session: StoredSession | null) {
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  if (!session) return;
  (session.remember ? window.localStorage : window.sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
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

  const signIn = useCallback(async (values: LoginFormValues, remember: boolean) => {
    const next = await loginRequest(values);
    commit({ ...next, remember });
  }, [commit]);

  const signUp = useCallback(async (values: RegisterFormValues) => {
    await registerRequest(values);
    const next = await loginRequest(values);
    commit({ ...next, remember: true });
  }, [commit]);

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    try { if (current?.refreshToken) await logoutRequest(current.refreshToken); }
    finally { commit(null); }
  }, [commit]);

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}) => {
    let current = sessionRef.current;
    if (!current) throw new ApiError('Bạn cần đăng nhập để tiếp tục.', 401);
    try { return await apiRequest<T>(path, init, current.accessToken); }
    catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 401) throw error;
      current = await renew();
      return apiRequest<T>(path, init, current.accessToken);
    }
  }, [renew]);

  const value = useMemo<AuthContextValue>(() => ({ status, user: session?.user ?? null, signIn, signUp, signOut, request }), [status, session, signIn, signUp, signOut, request]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthSession() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuthSession must be used inside AuthSessionProvider');
  return value;
}
