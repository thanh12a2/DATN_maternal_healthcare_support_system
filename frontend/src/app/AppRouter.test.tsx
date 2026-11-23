import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AppRouter } from './AppRouter';
import { navigate } from './navigation';

const patientSession = {
  accessToken: 'access',
  refreshToken: 'refresh',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: { userId: 'u1', email: 'patient@example.com', role: 'PATIENT' },
  remember: true,
};

const receptionistSession = {
  accessToken: 'access_rec',
  refreshToken: 'refresh_rec',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: {
    userId: 'r1',
    email: 'demo.receptionist@antam.local',
    role: 'RECEPTIONIST',
  },
  remember: true,
};

const adminSession = {
  accessToken: 'access_admin',
  refreshToken: 'refresh_admin',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: { userId: 'a1', email: 'admin@example.com', role: 'ADMIN' },
  remember: true,
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/dang-nhap');
  vi.stubGlobal('scrollTo', vi.fn());
});

describe('AppRouter patient flow', () => {
  it('renders the login form after redirecting an anonymous booking visit', async () => {
    window.history.replaceState({}, '', '/dat-lich');
    render(<AppRouter />);

    await waitFor(() => expect(window.location.pathname).toBe('/dang-nhap'));
    expect(await screen.findByRole('heading', { name: 'Chào mừng trở lại' })).toBeTruthy();
  });

  it('redirects /tong-quan to home', async () => {
    window.localStorage.setItem(
      'an-tam-auth-session',
      JSON.stringify(patientSession),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: patientSession.user }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/tong-quan');
    render(<AppRouter />);
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });
});

describe('AppRouter login routes', () => {
  it('keeps both login paths available during an authenticated admin session', async () => {
    window.localStorage.setItem('an-tam-admin-session', JSON.stringify(adminSession));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ user: adminSession.user }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));
    window.history.replaceState({}, '', '/admin/login');
    render(<AppRouter />);

    expect(await screen.findByTestId('admin-login-view')).toBeTruthy();
    expect(window.location.pathname).toBe('/admin/login');

    act(() => navigate('/dang-nhap'));
    expect(await screen.findByTestId('login-view')).toBeTruthy();
    expect(window.location.pathname).toBe('/dang-nhap');

    act(() => navigate('/login'));
    expect(await screen.findByTestId('login-view')).toBeTruthy();
    expect(window.location.pathname).toBe('/login');
  });
});

describe('AppRouter receptionist isolation flow', () => {
  it('redirects patient home (/) to /workspace/receptionist/overview when logged in as receptionist', async () => {
    window.localStorage.setItem(
      'an-tam-auth-session',
      JSON.stringify(receptionistSession),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: receptionistSession.user }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/');
    render(<AppRouter />);
    await waitFor(() =>
      expect(window.location.pathname).toBe('/workspace/receptionist/overview'),
    );
  });

  it('redirects patient service catalog (/dich-vu) to /workspace/receptionist/overview when logged in as receptionist', async () => {
    window.localStorage.setItem(
      'an-tam-auth-session',
      JSON.stringify(receptionistSession),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: receptionistSession.user }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/dich-vu');
    render(<AppRouter />);
    await waitFor(() =>
      expect(window.location.pathname).toBe('/workspace/receptionist/overview'),
    );
  });

  it('redirects alias /receptionist to /workspace/receptionist/overview', async () => {
    window.localStorage.setItem(
      'an-tam-auth-session',
      JSON.stringify(receptionistSession),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: receptionistSession.user }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/receptionist');
    render(<AppRouter />);
    await waitFor(() =>
      expect(window.location.pathname).toBe('/workspace/receptionist/overview'),
    );
  });
});
