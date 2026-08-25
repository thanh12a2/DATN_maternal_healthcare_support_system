import { useState } from 'react';
import { hasValidationErrors, type LoginFormValues, validateLogin } from '../../schemas/auth';
import type { ValidationResult } from '../../schemas/auth';
import { login } from '../../services/auth';
import { FormField } from './FormField';
import { PasswordField } from './PasswordField';
import { ShieldIcon, UserIcon } from './icons';

interface LoginFormProps {
  onSwitchMode: () => void;
}

const initialValues: LoginFormValues = { identity: '', password: '', remember: false };
const emptyResults = { identity: undefined, password: undefined } satisfies Record<string, ValidationResult | undefined>;

export function LoginForm({ onSwitchMode }: LoginFormProps) {
  const [values, setValues] = useState(initialValues);
  const [results, setResults] = useState(emptyResults);
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof LoginFormValues>(field: K, value: LoginFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validateField(field: 'identity' | 'password') {
    const nextResults = validateLogin(values);
    setResults((current) => ({ ...current, [field]: nextResults[field] }));
    return nextResults[field].valid;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextResults = validateLogin(values);
    setResults(nextResults);
    setAlert(null);

    if (hasValidationErrors(nextResults)) {
      setAlert({ type: 'error', message: 'Vui lòng kiểm tra lại các thông tin được đánh dấu.' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await login(values);
      window.localStorage.setItem('accessToken', response.accessToken);
      window.localStorage.setItem('refreshToken', response.refreshToken);
      setAlert({ type: 'success', message: 'Đăng nhập thành công. Đang mở hồ sơ sức khỏe của bạn…' });
    } catch (error) {
      setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Đăng nhập thất bại.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="form-view active" data-testid="login-view">
      <header className="auth-header">
        <span className="mode-indicator">Cổng thông tin bệnh nhân</span>
        <h2>Chào mừng trở lại</h2>
        <p>Đăng nhập để quản lý lịch khám và hồ sơ sức khỏe của bạn.</p>
      </header>

      {alert && <div className={`form-alert show ${alert.type}`} role="status">{alert.message}</div>}

      <form noValidate onSubmit={handleSubmit}>
        <div className="form-grid">
          <FormField id="login-identity" label="Số điện thoại hoặc Email" full icon={<UserIcon />} message={results.identity?.message} state={results.identity ? (results.identity.valid ? 'success' : 'error') : 'idle'}>
            <input className="input" id="login-identity" name="identity" autoComplete="username" placeholder="090 123 4567 hoặc email@domain.vn" value={values.identity} aria-invalid={results.identity?.valid === false} onChange={(event) => setField('identity', event.target.value)} onBlur={() => validateField('identity')} />
          </FormField>

          <PasswordField label="Mật khẩu" name="password" value={values.password} autoComplete="current-password" placeholder="Nhập mật khẩu" full message={results.password?.message} state={results.password ? (results.password.valid ? 'success' : 'error') : 'idle'} onChange={(value) => setField('password', value)} onBlur={() => validateField('password')} />
        </div>

        <div className="form-options">
          <label className="check-label"><input type="checkbox" checked={values.remember} onChange={(event) => setField('remember', event.target.checked)} /> <span>Ghi nhớ đăng nhập</span></label>
          <button className="text-link" type="button" onClick={() => setAlert({ type: 'success', message: 'Nhập email hoặc số điện thoại, chúng tôi sẽ gửi hướng dẫn khôi phục.' })}>Quên mật khẩu?</button>
        </div>

        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>

      <div className="divider"><span>Hoặc tiếp tục với</span></div>
      <div className="social-grid" aria-label="Tùy chọn đăng nhập mạng xã hội">
        <button className="social-button" type="button"><span className="social-mark">G</span>Google</button>
        <button className="social-button" type="button"><span className="social-mark">A</span>Apple</button>
      </div>
      <p className="switch-copy">Chưa có tài khoản? <button className="text-link mode-switch" type="button" onClick={onSwitchMode}>Đăng ký ngay</button></p>
      <div className="security-badge"><ShieldIcon />Thông tin của bạn được mã hóa và bảo mật</div>
    </div>
  );
}
