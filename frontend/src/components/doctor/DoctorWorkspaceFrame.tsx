import type { ReactNode } from 'react';
import { navigate } from '../../app/navigation';
import '../../styles/doctor-content.css';

const tabs = [
  ['overview', 'Tổng quan'],
  ['appointments', 'Lịch khám'],
  ['patients', 'Bệnh nhân'],
  ['encounters', 'Encounter'],
  ['schedule', 'Lịch làm việc'],
  ['consultations', 'Tư vấn'],
  ['profile', 'Hồ sơ cá nhân'],
] as const;

export function DoctorWorkspaceFrame({ section, children }: { section: string; children: ReactNode }) {
  return <section className="doctor-app">
    <nav className="doctor-nav" aria-label="Các màn hình Doctor">
      {tabs.map(([key, label]) => <button key={key} className={'doctor-nav-button ' + (section === key ? 'active' : '')} type="button" onClick={() => navigate('/workspace/doctor/' + key)}>{label}{key === 'consultations' && <span className="doctor-nav-count">01</span>}</button>)}
    </nav>
    <div className="doctor-view">{children}</div>
  </section>;
}
