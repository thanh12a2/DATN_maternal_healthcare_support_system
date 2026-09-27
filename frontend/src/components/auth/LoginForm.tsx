import { useState } from 'react';
import { hasValidationErrors, type LoginFormValues, validateLogin } from '../../schemas/auth';
import type { ValidationResult } from '../../schemas/auth';
import { login } from '../../services/auth';
import { FormField } from './FormField';
import { PasswordField } from './PasswordField';
import { MailIcon, ShieldIcon } from './icons';

interface Props {
  onSwitchMode: () => void;
  onSubmit?: (values: LoginFormValues, remember: boolean) => Promise<void>;
}

type LoginField = keyof LoginFormValues;
type ResultMap = Partial<Record<LoginField, ValidationResult>>;
const initialValues: LoginFormValues = { email: '', password: '' };

export function LoginForm({ onSwitchMode, onSubmit }: Props) {
  const [values, setValues] = useState(initialValues);
  const [results, setResults] = useState<ResultMap>({});
  const [touched, setTouched] = useState<Partial<Record<LoginField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState(true);

  function setField(field: LoginField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (submitted) {
      const next = validateLogin({ ...values, [field]: value });
      setResults((current) => ({ ...current, [field]: next[field] }));
    }
  }

  function validateField(field: LoginField) {
    if (!submitted) return;
    const next = validateLogin(values);
    setResults((current) => ({ ...current, [field]: next[field] }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextResults = validateLogin(values);
    setSubmitted(true);
    setTouched({ email: true, password: true });
    setResults(nextResults);
    setAlert(null);
    if (hasValidationErrors(nextResults)) {
      setAlert({ type: 'error', message: 'Vui lòng kiểm tra lại email và mật khẩu.' });
      return;
    }

    setSubmitting(true);
    try {
      if (onSubmit) await onSubmit(values, remember);
      else {
        const response = await login(values);
        window.localStorage.setItem('accessToken', response.accessToken);
        window.localStorage.setItem('refreshToken', response.refreshToken);
        setAlert({ type: 'success', message: 'Đăng nhập thành công.' });
      }
    } catch (error) {
      setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Đăng nhập thất bại.' });
    } finally {
      setSubmitting(false);
    }
  }

  const visible = (_field: LoginField) => submitted;
  const fieldState = (field: LoginField) => visible(field) && results[field]
    ? (results[field]!.valid ? 'success' : 'error')
    : 'idle';

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
          <FormField id="login-email" label="Email" full icon={<MailIcon />} message={visible('email') ? results.email?.message : undefined} state={fieldState('email')}>
            <input className="input" id="login-email" name="email" type="email" autoComplete="email" placeholder="patient@example.com" value={values.email} aria-invalid={visible('email') && results.email?.valid === false} onChange={(event) => setField('email', event.target.value)} onBlur={() => validateField('email')} />
          </FormField>
          <PasswordField label="Mật khẩu" name="password" value={values.password} autoComplete="current-password" placeholder="Nhập mật khẩu" full message={visible('password') ? results.password?.message : undefined} state={fieldState('password')} onChange={(value) => setField('password', value)} onBlur={() => validateField('password')} />
        </div>
        <div className="form-options">
          <label className="check-label"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Ghi nhớ đăng nhập</span></label>
          <span className="text-link" aria-disabled="true" title="Backend chưa hỗ trợ khôi phục mật khẩu">Quên mật khẩu?</span>
        </div>
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
      <p className="switch-copy">Chưa có tài khoản? <button className="text-link mode-switch" type="button" onClick={onSwitchMode}>Đăng ký ngay</button></p>
      <div className="security-badge"><ShieldIcon />Thông tin của bạn được mã hóa và bảo mật</div>
    </div>
  );
}
