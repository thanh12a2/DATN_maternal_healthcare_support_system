import { type ReactNode } from 'react';
import { NotificationBell } from '../../../shared/components/notifications/NotificationBell';
import { UserChip } from '../../../shared/components/navigation/UserChip';
import '../../../styles/doctor-content.css';

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
        <NotificationBell />
        <UserChip displayName={displayEmail} showWorkspaceLink={false} />
      </div>
    </header>
    <div className="doctor-view">{children}</div>
  </section>;
}
