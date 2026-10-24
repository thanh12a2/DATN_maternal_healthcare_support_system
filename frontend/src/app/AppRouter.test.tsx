import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRouter } from './AppRouter';

const session = {
  accessToken: 'access',
  refreshToken: 'refresh',
  tokenType: 'Bearer',
  expiresIn: 900,
  user: { userId: 'u1', email: 'patient@example.com', role: 'PATIENT' },
  remember: true,
};

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/dang-nhap');
  vi.stubGlobal('scrollTo', vi.fn());
});

describe('AppRouter', () => {
  it('restores patient session and navigates to profile and back', async () => {
    window.localStorage.setItem('an-tam-auth-session', JSON.stringify(session));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: session.user }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 'PATIENT_PROFILE_NOT_FOUND', message: 'not found' },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 'PATIENT_PROFILE_NOT_FOUND', message: 'not found' },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/tong-quan');
    render(<AppRouter />);
    expect(
      await screen.findByRole('heading', {
        name: /hoàn thiện hồ sơ bệnh nhân/i,
      }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('link', { name: /hoàn thiện hồ sơ/i }),
    );
    expect(
      await screen.findByRole('heading', {
        name: /hoàn thiện thông tin bệnh nhân/i,
      }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('link', { name: /quay lại tổng quan/i }),
    );
    await waitFor(() => expect(window.location.pathname).toBe('/tong-quan'));
  });

  it('renders admin workspace when admin visits /workspace/admin/overview', async () => {
    const adminSession = {
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { userId: 'admin1', email: 'admin@test.local', role: 'ADMIN' },
      remember: true,
    };
    window.localStorage.setItem(
      'an-tam-auth-session',
      JSON.stringify(adminSession),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: adminSession.user, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/workspace/admin/overview');
    render(<AppRouter />);
    expect(await screen.findByText(/Tổng quan hệ thống/i)).toBeInTheDocument();
  });

  it('renders dedicated admin login page when visiting /admin/login', async () => {
    window.history.replaceState({}, '', '/admin/login');
    render(<AppRouter />);
    expect(await screen.findByText(/Cổng Quản Trị Hệ Thống/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Đăng nhập$/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/admin@test.local/i)).toBeInTheDocument();
  });

  it('redirects admin visiting /tong-quan to admin workspace', async () => {
    const adminSession = {
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { userId: 'admin1', email: 'admin@test.local', role: 'ADMIN' },
      remember: true,
    };
    window.localStorage.setItem('an-tam-auth-session', JSON.stringify(adminSession));
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: adminSession.user, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/tong-quan');
    render(<AppRouter />);
    await waitFor(() => expect(window.location.pathname).toBe('/workspace/admin/overview'));
  });
});
