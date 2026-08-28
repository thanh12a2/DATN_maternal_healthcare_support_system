import { useState } from 'react';
import { hasValidationErrors, type RegisterFormValues, validateRegister } from '../../schemas/auth';
import type { ValidationResult } from '../../schemas/auth';
import { register } from '../../services/auth';
import { FormField } from './FormField';
import { PasswordField } from './PasswordField';
import { MailIcon, ShieldIcon } from './icons';

interface RegisterFormProps {
  onSwitchMode: () => void;
}

const initialValues: RegisterFormValues = {
  email: '',
  password: '',
};

type RegisterResultMap = Partial<Record<keyof RegisterFormValues, ValidationResult>>;

export function RegisterForm({ onSwitchMode }: RegisterFormProps) {
  const [values, setValues] = useState(initialValues);
  const [results, setResults] = useState<RegisterResultMap>({});
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField<K extends keyof RegisterFormValues>(field: K, value: RegisterFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validateField(field: keyof ReturnType<typeof validateRegister>) {
    const nextResults = validateRegister(values);
    setResults((current) => ({ ...current, [field]: nextResults[field] }));
    return nextResults[field].valid;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextResults = validateRegister(values);
    setResults(nextResults);
    setAlert(null);

    if (hasValidationErrors(nextResults)) {
      setAlert({ type: 'error', message: 'Vui lòng kiểm tra lại email và mật khẩu.' });
      return;
    }

    setSubmitting(true);
    try {
      await register(values);
      setAlert({ type: 'success', message: 'Tạo tài khoản bệnh nhân thành công. Bạn có thể đăng nhập ngay.' });
    } catch (error) {
      setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Tạo tài khoản thất bại.' });
    } finally {
      setSubmitting(false);
    }
  }

  const fieldState = (field: keyof RegisterFormValues) => results[field] ? (results[field]?.valid ? 'success' : 'error') : 'idle';

  return (
    <div className="form-view active" data-testid="register-view">
      <header className="auth-header">
        <span className="mode-indicator">Tài khoản bệnh nhân</span>
        <h2>Tạo tài khoản</h2>
        <p>Đăng ký tài khoản bệnh nhân bằng email và mật khẩu.</p>
      </header>

      {alert && <div className={`form-alert show ${alert.type}`} role="status">{alert.message}</div>}

      <form noValidate onSubmit={handleSubmit}>
        <div className="form-grid">
          <FormField id="email" label="Email" full icon={<MailIcon />} message={results.email?.message} state={fieldState('email')}>
            <input className="input" id="email" name="email" type="email" autoComplete="email" placeholder="patient@example.com" value={values.email} aria-invalid={results.email?.valid === false} onChange={(event) => setField('email', event.target.value)} onBlur={() => validateField('email')} />
          </FormField>

          <PasswordField label="Mật khẩu" name="password" value={values.password} autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" full message={results.password?.message} state={fieldState('password')} onChange={(value) => setField('password', value)} onBlur={() => validateField('password')} />
        </div>

        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}</button>
      </form>

      <p className="switch-copy">Đã có tài khoản? <button className="text-link mode-switch" type="button" onClick={onSwitchMode}>Đăng nhập</button></p>
      <div className="security-badge"><ShieldIcon />Tài khoản đăng ký công khai luôn có vai trò bệnh nhân</div>
    </div>
  );
}
