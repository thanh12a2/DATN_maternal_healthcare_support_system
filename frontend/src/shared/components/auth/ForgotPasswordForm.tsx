import { useState } from 'react';
import { validateEmail } from '../../../schemas/auth';
import { requestPasswordReset } from '../../../services/auth';
import { FormField } from './FormField';
import { MailIcon } from './icons';

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const validation = validateEmail(email);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setError('');
    if (!validation.valid) return;
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      setError('Không gửi được yêu cầu lúc này. Vui lòng thử lại sau.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="form-view active recovery-view" data-testid="forgot-password-view">
    <header className="auth-header">
      <span className="mode-indicator">Khôi phục tài khoản</span>
      <h2>Quên mật khẩu?</h2>
      <p>Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu.</p>
    </header>
    {sent ? <div className="form-alert success" role="status">
      Nếu email thuộc một tài khoản hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi tới hộp thư. Hãy kiểm tra cả mục thư rác.
    </div> : <form noValidate onSubmit={submit}>
      {error && <div className="form-alert error" role="alert">{error}</div>}
      <div className="form-grid">
        <FormField id="recovery-email" label="Email" full icon={<MailIcon />}
          message={submitted && !validation.valid ? validation.message : undefined}
          state={submitted && !validation.valid ? 'error' : 'idle'}>
          <input id="recovery-email" className="input" name="email" type="email" autoComplete="email"
            placeholder="email@domain.vn" value={email} aria-invalid={submitted && !validation.valid}
            onChange={event => setEmail(event.target.value)} />
        </FormField>
      </div>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}</button>
    </form>}
    <p className="switch-copy"><button className="text-link mode-switch" type="button" onClick={onBack}>Quay lại đăng nhập</button></p>
  </div>;
}
