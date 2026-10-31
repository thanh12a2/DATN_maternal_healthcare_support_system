import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthShell } from './AuthShell';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  window.localStorage.clear();
});

describe('AuthShell', () => {
  it('switches between login and register views', async () => {
    const user = userEvent.setup();
    render(<AuthShell />);

    expect(screen.getByRole('heading', { name: /chào mừng trở lại/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /đăng ký ngay/i }));
    expect(screen.getByRole('heading', { name: /tạo tài khoản/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));
    expect(screen.getByRole('heading', { name: /chào mừng trở lại/i })).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<AuthShell />);

    const passwordInput = screen.getByLabelText('Mật khẩu');
    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /hiện mật khẩu/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /ẩn mật khẩu/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('shows field validation errors on invalid login submit', async () => {
    const user = userEvent.setup();
    render(<AuthShell />);

    await user.click(screen.getByRole('button', { name: /^đăng nhập$/i }));

    expect(screen.getByText('Vui lòng nhập email.')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu cần ít nhất 8 ký tự.')).toBeInTheDocument();
  });
});
