import { useState } from 'react';
import { hasValidationErrors, type RegisterFormValues, validateRegister } from '../../schemas/auth';
import type { ValidationResult } from '../../schemas/auth';
import { login, register as registerRequest } from '../../services/auth';
import { FormField } from './FormField';
import { PasswordField } from './PasswordField';
import { MailIcon, ShieldIcon } from './icons';

interface Props {
  onSwitchMode: () => void;
  onSubmit?: (values: RegisterFormValues) => Promise<void>;
}

type RegisterField = keyof RegisterFormValues;
type ResultMap = Partial<Record<RegisterField, ValidationResult>>;
const initialValues: RegisterFormValues = { email: '', password: '' };

export function RegisterForm({ onSwitchMode, onSubmit }: Props) {
  const [values, setValues] = useState(initialValues);
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [results, setResults] = useState<ResultMap>({});
  const [touched, setTouched] = useState<Partial<Record<RegisterField, boolean>>>({});
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setField(field: RegisterField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (submitted) {
      const next = validateRegister({ ...values, [field]: value });
      setResults((current) => ({ ...current, [field]: next[field] }));
    }
  }

  function validateField(field: RegisterField) {
    if (!submitted) return;
    const next = validateRegister(values);
    setResults((current) => ({ ...current, [field]: next[field] }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextResults = validateRegister(values);
    const confirmationInvalid = !confirm || confirm !== values.password;
    setSubmitted(true);
    setTouched({ email: true, password: true });
    setConfirmTouched(true);
    setResults(nextResults);
    setAlert(null);
    if (hasValidationErrors(nextResults) || confirmationInvalid || !accepted) {
      setAlert({
        type: 'error',
        message: confirmationInvalid ? 'Mật khẩu xác nhận chưa khớp.' : !accepted ? 'Vui lòng đồng ý điều khoản sử dụng.' : 'Vui lòng kiểm tra lại email và mật khẩu.',
      });
      return;
    }

    setSubmitting(true);
    try {
      if (onSubmit) await onSubmit(values);
      else {
        await registerRequest(values);
        const response = await login(values);
        window.localStorage.setItem('accessToken', response.accessToken);
        window.localStorage.setItem('refreshToken', response.refreshToken);
        setAlert({ type: 'success', message: 'Tạo tài khoản bệnh nhân thành công.' });
      }
    } catch (error) {
      setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Tạo tài khoản thất bại.' });
    } finally {
      setSubmitting(false);
    }
  }

  const visible = (_field: RegisterField) => submitted;
  const fieldState = (field: RegisterField) => visible(field) && results[field]
    ? (results[field]!.valid ? 'success' : 'error')
    : 'idle';
  const confirmVisible = submitted;
  const confirmError = !confirm ? 'Vui lòng nhập lại mật khẩu.' : 'Mật khẩu chưa khớp.';

  return (
    <div className="form-view active" data-testid="register-view">
      <header className="auth-header">
        <span className="mode-indicator">Tài khoản bệnh nhân</span>
        <h2>Tạo tài khoản</h2>
        <p>Đăng ký tài khoản bằng email. Thông tin bệnh nhân sẽ được hoàn thiện sau khi đăng nhập.</p>
      </header>
      {alert && <div className={`form-alert show ${alert.type}`} role="status">{alert.message}</div>}
      <form noValidate onSubmit={handleSubmit}>
        <div className="form-grid">
          <FormField id="email" label="Email" full icon={<MailIcon />} message={visible('email') ? results.email?.message : undefined} state={fieldState('email')}>
            <input className="input" id="email" name="email" type="email" autoComplete="email" placeholder="email@domain.vn" value={values.email} aria-invalid={visible('email') && results.email?.valid === false} onChange={(event) => setField('email', event.target.value)} onBlur={() => validateField('email')} />
          </FormField>
          <PasswordField label="Mật khẩu" name="password" value={values.password} autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" message={visible('password') ? results.password?.message : undefined} state={fieldState('password')} onChange={(value) => setField('password', value)} onBlur={() => validateField('password')} />
          <PasswordField label="Xác nhận mật khẩu" name="confirmPassword" value={confirm} autoComplete="new-password" placeholder="Nhập lại mật khẩu" message={confirmVisible && confirm !== values.password ? confirmError : undefined} state={confirmVisible ? (confirm && confirm === values.password ? 'success' : 'error') : 'idle'} onChange={(value) => { setConfirmTouched(true); setConfirm(value); }} onBlur={() => setConfirmTouched(true)} />
        </div>
        <label className="check-label terms"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật.</span></label>
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}</button>
      </form>
      <p className="switch-copy">Đã có tài khoản? <button className="text-link mode-switch" type="button" onClick={onSwitchMode}>Đăng nhập</button></p>
      <div className="security-badge"><ShieldIcon />Thông tin của bạn được mã hóa và bảo mật</div>
    </div>
  );
}
