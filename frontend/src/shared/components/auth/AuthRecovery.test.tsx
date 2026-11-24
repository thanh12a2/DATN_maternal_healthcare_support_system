import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthShell } from './AuthShell';

beforeEach(() => {
  window.history.replaceState({}, '', '/dang-nhap');
  vi.unstubAllGlobals();
});

describe('password recovery', () => {
  it('opens the forgot-password form and sends a normalized email to Auth Service', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'accepted' }), {
      status: 202, headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AuthShell />);

    await user.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }));
    await user.type(screen.getByLabelText('Email'), ' Test@Example.com ');
    await user.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/forgot-password'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'test@example.com' }) }));
    expect(screen.getByRole('status').textContent).toContain('Nếu email thuộc một tài khoản hợp lệ');
  });

  it('uses the email-link token, resets the password, and removes the token from the URL', async () => {
    window.history.replaceState({}, '', '/reset-password?token=qa-reset-token');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AuthShell initialMode="reset" />);

    await user.type(screen.getByLabelText('Mật khẩu mới'), 'NewPassword123!');
    await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'NewPassword123!');
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/reset-password'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'qa-reset-token', newPassword: 'NewPassword123!' }) }));
    expect(await screen.findByText(/Mật khẩu đã được cập nhật/)).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('rejects a missing reset token before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthShell initialMode="reset" />);
    expect(screen.getByRole('alert').textContent).toContain('Liên kết đặt lại mật khẩu không hợp lệ');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
