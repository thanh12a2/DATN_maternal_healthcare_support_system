import type { ReactNode } from 'react';
import { navigate } from '../../app/navigation';
import '../../styles/receptionist-content.css';

const tabs = [
  ['overview', 'Tổng quan'],
  ['patients', 'Bệnh nhân'],
  ['appointments', 'Lịch khám'],
  ['reception', 'Tiếp nhận'],
  ['check-in', 'Check-in'],
  ['queue', 'Hàng đợi'],
  ['billing', 'Hóa đơn'],
] as const;

export function ReceptionistWorkspaceFrame({ section, children, email }: { section: string; children: ReactNode; email?: string }) {
  const title = tabs.find(([key]) => key === section)?.[1] ?? 'Tổng quan';
  const initials = email?.slice(0, 2).toUpperCase() || 'LT';

  return <section className="receptionist-app">
    <header className="receptionist-topbar">
      <div className="receptionist-topbar-leading">
        <div className="receptionist-topbar-copy">
          <span>Lễ tân / Receptionist</span>
          <strong>{title}</strong>
        </div>
      </div>
      <div className="receptionist-topbar-actions">
        <span className="receptionist-desk-state"><i aria-hidden="true" />Bàn tiếp nhận 01</span>
        <button className="receptionist-notification" type="button" aria-label="Thông báo mới">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          <i aria-hidden="true" />
        </button>
        <div className="receptionist-account-chip"><span className="receptionist-avatar">{initials}</span><span>{email || 'Tài khoản lễ tân'}</span></div>
      </div>
    </header>
    <nav className="workspace-nav" aria-label="Các màn hình Receptionist">
      {tabs.map(([key, label]) => <button key={key} className={'workspace-nav-button ' + (section === key ? 'active' : '')} type="button" onClick={() => navigate('/workspace/receptionist/' + key)}>{label}</button>)}
    </nav>
    <div className="workspace-view">{children}</div>
  </section>;
}
