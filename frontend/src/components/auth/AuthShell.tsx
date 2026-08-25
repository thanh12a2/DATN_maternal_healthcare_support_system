import { useEffect, useRef, useState } from 'react';
import type { AuthMode } from '../../schemas/auth';
import { BackgroundShapes } from './BackgroundShapes';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function AuthShell() {
  const [mode, setMode] = useState<AuthMode>('login');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.scrollTo({ top: 0 });
    window.setTimeout(() => {
      const firstInput = cardRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>('input, select');
      firstInput?.focus();
    }, 160);
  }, [mode]);

  return (
    <main className="auth-page" data-mode={mode}>
      <BackgroundShapes />
      <section className="form-panel" aria-live="polite">
        <div className="auth-card" data-mode={mode} ref={cardRef}>
          {mode === 'login' ? (
            <LoginForm onSwitchMode={() => setMode('register')} />
          ) : (
            <RegisterForm onSwitchMode={() => setMode('login')} />
          )}
        </div>
      </section>
    </main>
  );
}
