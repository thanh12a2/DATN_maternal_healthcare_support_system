import type { ReactNode } from 'react';
import '../../styles/doctor-content.css';

const titles: Record<string, string> = {
  overview: 'Tổng quan',
  appointments: 'Lịch khám',
  patients: 'Bệnh nhân phân công',
  encounters: 'Hồ sơ khám',
  schedule: 'Lịch làm việc',
  consultations: 'Tư vấn',
  profile: 'Hồ sơ cá nhân',
};

function initials(value?: string) {
  return (value ?? 'BS').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'BS';
}

export function DoctorWorkspaceFrame({ section, email, children }: { section: string; email?: string; children: ReactNode }) {
  const displayEmail = email ?? 'Tài khoản bác sĩ';
  return <section className="doctor-app">
    <header className="doctor-topbar">
      <div><span>Doctor workspace</span><strong>{titles[section] ?? 'Tổng quan'}</strong></div>
      <div className="doctor-topbar-actions">
        <button className="doctor-notification" type="button" aria-label="Thông báo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg></button>
        <div className="doctor-user-chip"><span>{initials(displayEmail)}</span><div><strong>Bác sĩ</strong><small>{displayEmail}</small></div></div>
      </div>
    </header>
    <div className="doctor-view">{children}</div>
  </section>;
}
