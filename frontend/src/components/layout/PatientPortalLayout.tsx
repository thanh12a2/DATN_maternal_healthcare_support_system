import type { ReactNode } from 'react';
import { useAuthSession } from '../../app/AuthSessionProvider';
import { AppLink, navigate } from '../../app/navigation';
import { PatientSidebar } from '../navigation/PatientSidebar';
import '../../styles/patient-layout.css';

interface PatientPortalLayoutProps {
  eyebrow: string;
  title: string;
  displayName?: string;
  children: ReactNode;
  contentClassName?: string;
  profileComplete?: boolean | null;
}

function initialsOf(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return parts.slice(-2).map((part) => part[0]).join('').toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

export function PatientPortalLayout({ eyebrow, title, displayName, children, contentClassName = '', profileComplete }: PatientPortalLayoutProps) {
  const auth = useAuthSession();
  const fallbackName = auth.user?.email.split('@')[0] || 'Bệnh nhân';
  const userName = displayName?.trim() || fallbackName;

  async function logout() {
    await auth.signOut();
    navigate('/dang-nhap', { replace: true });
  }

  return (
    <div className="patient-home-shell patient-desktop-portal">
      <PatientSidebar onLogout={() => void logout()} profileComplete={profileComplete} />
      <main className="patient-main-view patient-portal-main" id="main-content">
        <header className="patient-portal-header">
          <div className="patient-portal-header-copy"><span>{eyebrow}</span><strong>{title}</strong></div>
          <div className="patient-portal-header-actions">
            <button className="patient-notification-tab" type="button" aria-label="Mở thông báo" onClick={() => navigate('/thong-bao-hoa-don')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
              <span className="patient-notification-dot" />
            </button>
            <AppLink className="patient-user-tab" href="/ho-so/hoan-thien" aria-label={`Mở hồ sơ của ${userName}`}><span className="patient-user-avatar">{initialsOf(userName)}</span><span className="patient-user-name">{userName}</span></AppLink>
          </div>
        </header>
        <div className={`patient-portal-content ${contentClassName}`.trim()}>{children}</div>
      </main>
    </div>
  );
}
