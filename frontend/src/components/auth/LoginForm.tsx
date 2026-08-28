import { useState } from 'react';
import { hasValidationErrors, type LoginFormValues, validateLogin } from '../../schemas/auth';
import type { ValidationResult } from '../../schemas/auth';
import { login } from '../../services/auth';
import { FormField } from './FormField';
import { PasswordField } from './PasswordField';
import { MailIcon, ShieldIcon } from './icons';

interface LoginFormProps {
  onSwitchMode: () => void;
}

const initialValues: LoginFormValues = { email: '', password: '' };
type LoginResultMap = Partial<Record<'email' | 'password', ValidationResult>>;
const emptyResults: LoginResultMap = {};

export function LoginForm({ onSwitchMode }: LoginFormProps) {
  const [values, setValues] = useState(initialValues);
  const [results, setResults] = useState<LoginResultMap>(emptyResults);
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof LoginFormValues>(field: K, value: LoginFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validateField(field: 'email' | 'password') {
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
      setAlert({ type: 'error', message: 'Vui lòng kiểm tra lại email và mật khẩu.' });
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
        <p>Đăng nhập bằng email và mật khẩu đã đăng ký.</p>
      </header>

      {alert && <div className={`form-alert show ${alert.type}`} role="status">{alert.message}</div>}

      <form noValidate onSubmit={handleSubmit}>
        <div className="form-grid">
          <FormField id="login-email" label="Email" full icon={<MailIcon />} message={results.email?.message} state={results.email ? (results.email.valid ? 'success' : 'error') : 'idle'}>
            <input className="input" id="login-email" name="email" type="email" autoComplete="email" placeholder="patient@example.com" value={values.email} aria-invalid={results.email?.valid === false} onChange={(event) => setField('email', event.target.value)} onBlur={() => validateField('email')} />
          </FormField>

          <PasswordField label="Mật khẩu" name="password" value={values.password} autoComplete="current-password" placeholder="Nhập mật khẩu" full message={results.password?.message} state={results.password ? (results.password.valid ? 'success' : 'error') : 'idle'} onChange={(value) => setField('password', value)} onBlur={() => validateField('password')} />
        </div>

        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>

      <p className="switch-copy">Chưa có tài khoản? <button className="text-link mode-switch" type="button" onClick={onSwitchMode}>Đăng ký ngay</button></p>
      <div className="security-badge"><ShieldIcon />Thông tin của bạn được mã hóa và bảo mật</div>
    </div>
  );
}
