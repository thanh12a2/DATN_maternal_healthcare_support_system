import { AuthShell } from '../components/auth/AuthShell';
import { useAuthSession } from '../../app/AuthSessionProvider';
import { navigate } from '../../app/navigation';
import type { AuthMode, LoginFormValues, RegisterFormValues } from '../../schemas/auth';
import type { AuthUser } from '../../services/auth';

function homeForRole(role: string): string {
  switch (role) {
    case 'PATIENT': return '/';
    case 'DOCTOR': return '/workspace/doctor/overview';
    case 'NURSE': return '/workspace/nurse/overview';
    case 'RECEPTIONIST': return '/workspace/receptionist/overview';
    case 'CLINIC_MANAGER': return '/workspace/clinic_manager/overview';
    case 'ADMIN': return '/workspace/admin/overview';
    default: return '/dang-nhap';
  }
}

function redirectAfterAuth(user: AuthUser) {
  const searchParams = new URLSearchParams(window.location.search);
  const returnUrl = searchParams.get('returnUrl') || searchParams.get('redirect');
  if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
    if (user.role === 'PATIENT') {
      navigate(returnUrl, { replace: true });
      return;
    }
    // Đối với nhân viên y tế / lễ tân / quản trị, chỉ chấp nhận returnUrl thuộc đúng workspace của họ
    const roleWorkspacePrefix = `/workspace/${user.role.toLowerCase()}`;
    if (returnUrl.startsWith(roleWorkspacePrefix)) {
      navigate(returnUrl, { replace: true });
      return;
    }
  }
  navigate(homeForRole(user.role), { replace: true });
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const auth = useAuthSession();

  async function login(values: LoginFormValues, remember: boolean) {
    const user = await auth.signIn(values, remember);
    redirectAfterAuth(user);
  }

  async function register(values: RegisterFormValues) {
    const user = await auth.signUp(values);
    redirectAfterAuth(user);
  }

  return (
    <AuthShell
      initialMode={mode}
      onModeChange={(next) => {
        const search = window.location.search;
        navigate((next === 'login' ? '/dang-nhap' : '/dang-ky') + search);
      }}
      onLogin={login}
      onRegister={register}
    />
  );
}
