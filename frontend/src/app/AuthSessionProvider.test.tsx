import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthSessionProvider, useAuthSession } from './AuthSessionProvider';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/login');
});

it('stores an admin login under the admin session key from a public login path', async () => {
  const session = {
    accessToken: 'admin-access',
    refreshToken: 'admin-refresh',
    tokenType: 'Bearer',
    expiresIn: 900,
    user: { userId: 'admin-2', email: 'admin@example.com', role: 'ADMIN' },
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify(session),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )));

  function LoginProbe() {
    const auth = useAuthSession();
    return <button onClick={() => void auth.signIn({ email: session.user.email, password: 'Password123!' }, true)}>Login</button>;
  }

  render(<AuthSessionProvider><LoginProbe /></AuthSessionProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));

  await waitFor(() => expect(JSON.parse(window.localStorage.getItem('an-tam-admin-session') ?? 'null')?.user.userId).toBe('admin-2'));
  expect(window.localStorage.getItem('an-tam-auth-session')).toBeNull();
});
