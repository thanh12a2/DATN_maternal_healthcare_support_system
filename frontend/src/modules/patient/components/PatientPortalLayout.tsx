import type { ReactNode } from 'react';
import { PublicPortalHeader } from '../../../shared/components/portal/PublicPortalHeader';
import { PublicPortalFooter } from '../../../shared/components/portal/PublicPortalFooter';
import '../../../styles/patient-modern-portal.css';
import '../../../styles/patient-layout.css';

interface PatientPortalLayoutProps {
  eyebrow?: string;
  title?: string;
  displayName?: string;
  children: ReactNode;
  contentClassName?: string;
  profileComplete?: boolean | null;
}

export function PatientPortalLayout({
  eyebrow,
  title,
  children,
  contentClassName = '',
}: PatientPortalLayoutProps) {
  return (
    <div className="patient-modern-portal-shell">
      {/* 1. Header 2-Tier Vinmec Style */}
      <PublicPortalHeader />

      {/* 2. Main Content Container (No Sidebar) */}
      <main className="patient-modern-portal-main" id="main-content">
        <div className="portal-container">
          {(eyebrow || title) && (
            <div className="patient-page-top-header">
              {eyebrow && <span className="patient-page-eyebrow">{eyebrow}</span>}
              {title && <h1 className="patient-page-title">{title}</h1>}
            </div>
          )}
          <div className={`patient-page-content-wrapper ${contentClassName}`.trim()}>
            {children}
          </div>
        </div>
      </main>

      {/* 3. Footer */}
      <PublicPortalFooter />
    </div>
  );
}
