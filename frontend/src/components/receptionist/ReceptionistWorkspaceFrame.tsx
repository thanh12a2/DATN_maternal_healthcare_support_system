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

export function ReceptionistWorkspaceFrame({ section, children }: { section: string; children: ReactNode }) {
  return <section className="receptionist-app">
    <nav className="workspace-nav" aria-label="Các màn hình Receptionist">
      {tabs.map(([key, label]) => <button key={key} className={'workspace-nav-button ' + (section === key ? 'active' : '')} type="button" onClick={() => navigate('/workspace/receptionist/' + key)}>{label}</button>)}
    </nav>
    <div className="workspace-view">{children}</div>
  </section>;
}
