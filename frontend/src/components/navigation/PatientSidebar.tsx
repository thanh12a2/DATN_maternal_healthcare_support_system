import { useEffect, useState } from 'react';
import { AppLink } from '../../app/navigation';

const STORAGE_KEY = 'an-tam-sidebar-collapsed';
function MenuGlyph() { return <span className="patient-hamburger" aria-hidden="true"><span /><span /><span /></span>; }
function HomeIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m4 10 8-6 8 6v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z"/><path d="M9 21v-7h6v7"/></svg>; }
function ExitIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></svg>; }

export function PatientSidebar({ onLogout }: { onLogout: () => void }) {
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(STORAGE_KEY) === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);

  return <div className={`patient-nav-shell ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
    <button className="patient-menu-toggle patient-mobile-menu" type="button" aria-label={mobileOpen ? 'Đóng thanh điều hướng' : 'Mở thanh điều hướng'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)}><MenuGlyph /></button>
    <aside className="patient-sidebar" aria-label="Điều hướng chính">
      <div className="patient-sidebar-head">
        <button className="patient-menu-toggle" type="button" aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'} aria-expanded={!collapsed} onClick={() => { if (window.matchMedia?.('(max-width: 820px)').matches) setMobileOpen(false); else setCollapsed((v) => !v); }}><MenuGlyph /></button>
        <div className="patient-sidebar-brand"><strong>An Tâm Medical</strong><span>Patient portal</span></div>
      </div>
      <nav className="patient-sidebar-nav">
        <p className="patient-nav-label">Không gian của bạn</p>
        <AppLink className="patient-nav-item" href="/tong-quan" aria-current="page" onClick={() => setMobileOpen(false)}><span className="patient-nav-icon"><HomeIcon /></span><span className="patient-nav-text">Tổng quan</span></AppLink>
      </nav>
      <button className="patient-logout" type="button" onClick={onLogout}><span className="patient-nav-icon"><ExitIcon /></span><span className="patient-nav-text">Đăng xuất</span></button>
    </aside>
    <button className="patient-sidebar-scrim" type="button" aria-label="Đóng thanh điều hướng" onClick={() => setMobileOpen(false)} />
  </div>;
}
