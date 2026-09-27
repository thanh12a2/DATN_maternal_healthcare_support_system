import { AuthShell } from '../components/auth/AuthShell';
import { useAuthSession } from '../app/AuthSessionProvider';
import { navigate } from '../app/navigation';
import type { AuthMode, LoginFormValues, RegisterFormValues } from '../schemas/auth';

export function AuthPage({ mode }: { mode: AuthMode }) {
  const auth = useAuthSession();
  async function login(values: LoginFormValues, remember: boolean) {
    await auth.signIn(values, remember);
    navigate('/tong-quan', { replace: true });
  }
  async function register(values: RegisterFormValues) {
    await auth.signUp(values);
    navigate('/tong-quan', { replace: true });
  }
  return <AuthShell initialMode={mode} onModeChange={(next) => navigate(next === 'login' ? '/dang-nhap' : '/dang-ky')} onLogin={login} onRegister={register} />;
}
