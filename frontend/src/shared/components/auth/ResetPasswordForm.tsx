import { useState } from 'react';
import { validatePassword } from '../../../schemas/auth';
import { resetPassword } from '../../../services/auth';
import { ApiError } from '../../../services/api';
import { PasswordField } from './PasswordField';

export function ResetPasswordForm({ onLogin, onRequestNew }: { onLogin: () => void; onRequestNew: () => void }) {
  const token = new URLSearchParams(window.location.search).get('token')?.trim() ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const passwordCheck = validatePassword(password);
  const confirmValid = confirm.length > 0 && confirm === password;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setError('');
    if (!token || !passwordCheck.valid || !confirmValid) return;
    setBusy(true);
    try {
      await resetPassword(token, password);
      window.history.replaceState(window.history.state, '', window.location.pathname);
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof ApiError && reason.statusCode === 400
        ? 'Liên kết đã hết hạn hoặc không hợp lệ. Hãy yêu cầu liên kết mới.'
        : 'Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại sau.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="form-view active recovery-view" data-testid="reset-password-view">
    <header className="auth-header">
      <span className="mode-indicator">Khôi phục tài khoản</span>
      <h2>Đặt lại mật khẩu</h2>
      <p>Chọn mật khẩu mới cho tài khoản của bạn.</p>
    </header>
    {success ? <div className="form-alert success" role="status">Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.</div>
      : !token ? <div className="form-alert error" role="alert">Liên kết đặt lại mật khẩu không hợp lệ. Hãy yêu cầu liên kết mới.</div>
      : <form noValidate onSubmit={submit}>
        {error && <div className="form-alert error" role="alert">{error}</div>}
        <div className="form-grid">
          <PasswordField label="Mật khẩu mới" name="newPassword" value={password} autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự" full onChange={setPassword}
            message={submitted && !passwordCheck.valid ? passwordCheck.message : undefined}
            state={submitted && !passwordCheck.valid ? 'error' : 'idle'} />
          <PasswordField label="Xác nhận mật khẩu mới" name="confirmPassword" value={confirm} autoComplete="new-password"
            placeholder="Nhập lại mật khẩu mới" full onChange={setConfirm}
            message={submitted && !confirmValid ? 'Mật khẩu xác nhận chưa khớp.' : undefined}
            state={submitted && !confirmValid ? 'error' : 'idle'} />
        </div>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Đang cập nhật…' : 'Đặt lại mật khẩu'}</button>
      </form>}
    <p className="switch-copy">
      {success ? <button className="text-link mode-switch" type="button" onClick={onLogin}>Đến trang đăng nhập</button>
        : <button className="text-link mode-switch" type="button" onClick={onRequestNew}>Yêu cầu liên kết mới</button>}
    </p>
  </div>;
}
