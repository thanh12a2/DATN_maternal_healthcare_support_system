import { useEffect, useRef, useState } from 'react';
import type {
  AuthMode,
  LoginFormValues,
  RegisterFormValues,
} from '../../../schemas/auth';
import { BackgroundShapes } from './BackgroundShapes';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { ResetPasswordForm } from './ResetPasswordForm';
import { ShieldIcon } from './icons';
import '../../../styles/auth.css';

interface Props {
  initialMode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
  onLogin?: (values: LoginFormValues, remember: boolean) => Promise<void>;
  onRegister?: (values: RegisterFormValues) => Promise<void>;
}

export function AuthShell({
  initialMode = 'login',
  onModeChange,
  onLogin,
  onRegister,
}: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMode(initialMode), [initialMode]);

  function change(next: AuthMode) {
    setMode(next);
    onModeChange?.(next);
  }

  return (
    <main className="auth-page" data-mode={mode}>
      <BackgroundShapes />
      <section className="form-panel" aria-live="polite">
        <div className="auth-card-wrap">
          <div className="auth-card" data-mode={mode} ref={cardRef}>
            {mode === 'login' ? (
              <LoginForm
                onSwitchMode={() => change('register')}
                onForgotPassword={() => change('forgot')}
                onSubmit={onLogin}
              />
            ) : mode === 'register' ? (
              <RegisterForm
                onSwitchMode={() => change('login')}
                onSubmit={onRegister}
              />
            ) : mode === 'forgot' ? (
              <ForgotPasswordForm onBack={() => change('login')} />
            ) : (
              <ResetPasswordForm onLogin={() => change('login')} onRequestNew={() => change('forgot')} />
            )}
          </div>

          <footer
            className="auth-external-footer"
            aria-label="Thông tin bảo mật và hỗ trợ"
          >
            <div className="security-badge-external">
              <ShieldIcon />
              <span>
                Thông tin cá nhân & hồ sơ thai kỳ được mã hóa và bảo mật
              </span>
            </div>
            <div className="auth-hotline-external">
              <span>Cần hỗ trợ? Hotline: </span>
              <a href="tel:19006868" className="hotline-link">
                1900 6868
              </a>
              <span className="help-hours"> (24/7)</span>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
