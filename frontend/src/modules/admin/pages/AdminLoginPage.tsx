import React, { useRef, useState } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate } from '../../../app/navigation';
import { BackgroundShapes } from '../../../shared/components/auth/BackgroundShapes';
import { FormField } from '../../../shared/components/auth/FormField';
import { PasswordField } from '../../../shared/components/auth/PasswordField';
import { MailIcon, ShieldIcon } from '../../../shared/components/auth/icons';
import { hasValidationErrors, type LoginFormValues, validateLogin } from '../../../schemas/auth';
import type { ValidationResult } from '../../../schemas/auth';
import type { AuthUser } from '../../../services/auth';

type LoginField = keyof LoginFormValues;
type ResultMap = Partial<Record<LoginField, ValidationResult>>;
const initialValues: LoginFormValues = { email: '', password: '' };

export function AdminLoginPage() {
  const auth = useAuthSession();
  const [values, setValues] = useState<LoginFormValues>(initialValues);
  const [results, setResults] = useState<ResultMap>({});
  const [submitted, setSubmitted] = useState(false);
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

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
    setResults(nextResults);
    setAlert(null);
    if (hasValidationErrors(nextResults)) {
      setAlert({ type: 'error', message: 'Vui lòng kiểm tra lại email và mật khẩu.' });
      return;
    }

    setSubmitting(true);
    try {
      const user: AuthUser = await auth.signIn(values, remember);
      if (user.role === 'ADMIN') {
        navigate('/workspace/admin/overview', { replace: true });
      } else if (user.role === 'PATIENT') {
        await auth.signOut();
        setAlert({
          type: 'error',
          message: 'Tài khoản này là tài khoản Bệnh nhân. Vui lòng sử dụng Cổng Bệnh Nhân (Port 3000) để đăng nhập.',
        });
      } else {
        // Staff roles (DOCTOR, RECEPTIONIST, NURSE)
        navigate(`/workspace/${user.role.toLowerCase()}/overview`, { replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập không thành công. Vui lòng thử lại.';
      setAlert({ type: 'error', message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  const visible = (_field: LoginField) => submitted;
  const fieldState = (field: LoginField) =>
    visible(field) && results[field]
      ? results[field]!.valid
        ? 'success'
        : 'error'
      : 'idle';

  return (
    <main className="auth-page" data-mode="login">
      <BackgroundShapes />
      <section className="form-panel" aria-live="polite">
        <div className="auth-card" data-mode="login" ref={cardRef}>
          <div className="form-view active" data-testid="admin-login-view">
            <header className="auth-header">
              <span className="mode-indicator">Cổng thông tin Quản trị viên</span>
              <h2>Chào mừng trở lại</h2>
              <p>Đăng nhập Cổng Quản Trị Hệ Thống bằng email và mật khẩu quản trị viên.</p>
            </header>

            {alert && (
              <div className={`form-alert show ${alert.type}`} role="status">
                {alert.message}
              </div>
            )}

            <form noValidate onSubmit={handleSubmit}>
              <div className="form-grid">
                <FormField
                  id="admin-login-email"
                  label="Email"
                  full
                  icon={<MailIcon />}
                  message={visible('email') ? results.email?.message : undefined}
                  state={fieldState('email')}
                >
                  <input
                    className="input"
                    id="admin-login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="admin@test.local"
                    value={values.email}
                    aria-invalid={visible('email') && results.email?.valid === false}
                    onChange={(event) => setField('email', event.target.value)}
                    onBlur={() => validateField('email')}
                  />
                </FormField>

                <PasswordField
                  label="Mật khẩu"
                  name="password"
                  value={values.password}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  full
                  message={visible('password') ? results.password?.message : undefined}
                  state={fieldState('password')}
                  onChange={(value) => setField('password', value)}
                  onBlur={() => validateField('password')}
                />
              </div>

              <div className="form-options">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
                <span
                  className="text-link"
                  aria-disabled="true"
                  title="Liên hệ ban quản trị kỹ thuật để cấp lại mật khẩu"
                >
                  Quên mật khẩu?
                </span>
              </div>

              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </button>
            </form>

            <div className="security-badge">
              <ShieldIcon />
              Thông tin của bạn được mã hóa và bảo mật
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default AdminLoginPage;
