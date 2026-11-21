import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { EmailVerificationPage, EmailVerificationPanel } from './EmailVerification';

const session = vi.hoisted(() => ({ status: 'anonymous', request: vi.fn() }));
vi.mock('../../../app/AuthSessionProvider', () => ({ useAuthSession: () => session }));

afterEach(() => { cleanup(); sessionStorage.clear(); vi.clearAllMocks(); });

it('returns to verification in the same tab after signing in and sends the saved token', async () => {
  const token = 'a'.repeat(43);
  window.history.replaceState({}, '', `/xac-minh-email?token=${token}`);
  session.status = 'anonymous';
  const first = render(<EmailVerificationPage />);
  expect(screen.getByRole('link', { name: 'đăng nhập' }).getAttribute('href')).toBe('/dang-nhap?redirect=%2Fxac-minh-email');
  expect(window.location.search).toBe('');
  first.unmount();

  window.history.replaceState({}, '', '/xac-minh-email');
  session.status = 'authenticated';
  session.request.mockResolvedValue({ verified: true });
  render(<EmailVerificationPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Xác minh địa chỉ email' }));
  await waitFor(() => expect(session.request).toHaveBeenCalledWith('/auth/email-verification/confirm', { method: 'POST', body: JSON.stringify({ token }) }));
  expect(await screen.findByText('Email của bạn đã được xác minh.')).toBeTruthy();
  expect(sessionStorage.getItem('email-verification-token')).toBeNull();
});

it('shows the email and sends a verification link when unverified', async () => {
  session.request.mockResolvedValueOnce({ email: 'patient@example.test', verified: false }).mockResolvedValueOnce({ sent: true });
  render(<EmailVerificationPanel />);
  expect(await screen.findByText('patient@example.test')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Xác minh email' }));
  expect(await screen.findByText('Đã gửi liên kết xác minh. Vui lòng kiểm tra hộp thư.')).toBeTruthy();
  expect(session.request).toHaveBeenCalledWith('/auth/email-verification/request', { method: 'POST' });
});

it('shows the verified badge and no send button for a verified email', async () => {
  session.request.mockResolvedValueOnce({ email: 'patient@example.test', verified: true });
  render(<EmailVerificationPanel />);
  expect(await screen.findByText('Đã xác minh')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Xác minh email' })).toBeNull();
});
