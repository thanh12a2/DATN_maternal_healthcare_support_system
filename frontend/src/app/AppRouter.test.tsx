import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppRouter } from './AppRouter';

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
