import { useEffect, useState } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { AppLink, navigate, usePathname } from '../../../app/navigation';
import { ApiError } from '../../../services/api';

const STORAGE_KEY = 'an-tam-sidebar-collapsed';
export type Role = 'PATIENT' | 'DOCTOR' | 'RECEPTIONIST' | 'NURSE' | 'CLINIC_MANAGER' | 'ADMIN';
type IconName = 'home' | 'profile' | 'calendar-plus' | 'calendar' | 'queue' | 'bell' | 'exit' | 'users' | 'clipboard' | 'search' | 'check-in' | 'stethoscope' | 'clock' | 'notes' | 'report' | 'settings';
type NavItem = { href: string; label: string; icon: IconName };

function MenuGlyph() { return <span className="patient-hamburger" aria-hidden="true"><span /><span /><span /></span>; }
function PatientIcon({ name }: { name: IconName }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'home') return <svg {...common}><path d="m4 10 8-6 8 6v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z" /><path d="M9 21v-7h6v7" /></svg>;
  if (name === 'profile') return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>;
  if (name === 'calendar-plus') return <svg {...common}><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M12 14v5M9.5 16.5h5" /></svg>;
  if (name === 'calendar') return <svg {...common}><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="3" /><path d="m8 15 2 2 5-5" /></svg>;
  if (name === 'queue') return <svg {...common}><path d="M4 7h16M4 12h11M4 17h7" /><circle cx="18" cy="17" r="2" /></svg>;
  if (name === 'bell') return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
  if (name === 'users') return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M17 14a5 5 0 0 1 4 6" /></svg>;
  if (name === 'clipboard' || name === 'notes') return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5" /></svg>;
  if (name === 'search') return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>;
  if (name === 'check-in') return <svg {...common}><path d="M4 12h11M11 8l4 4-4 4M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /></svg>;
  if (name === 'stethoscope') return <svg {...common}><path d="M6 3v5a6 6 0 0 0 12 0V3M4 3h4M16 3h4M18 14a3 3 0 1 0 3 3v-1" /></svg>;
  if (name === 'clock') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === 'report') return <svg {...common}><path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" /></svg>;
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.6v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6v-2.6h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h2.6v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v2.6h-.2a1.7 1.7 0 0 0-1.5 1Z" /></svg>;
  return <svg {...common}><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" /></svg>;
}

const patientNavItems: NavItem[] = [
  { href: '/tong-quan', label: 'Tổng quan', icon: 'home' },
  { href: '/ho-so/hoan-thien', label: 'Hồ sơ', icon: 'profile' },
  { href: '/dich-vu', label: 'Dịch vụ khám', icon: 'calendar-plus' },
  { href: '/lich-hen', label: 'Lịch hẹn', icon: 'calendar' },
  { href: '/hang-doi', label: 'Hàng đợi khám', icon: 'queue' },
  { href: '/thong-bao-hoa-don', label: 'Thông báo & hóa đơn', icon: 'bell' },
];
const workspaceNav: Record<Exclude<Role, 'PATIENT'>, NavItem[]> = {
  DOCTOR: [{ label: 'Tổng quan', icon: 'home', href: 'overview' }, { label: 'Lịch khám', icon: 'calendar', href: 'appointments' }, { label: 'Bệnh nhân phân công', icon: 'users', href: 'patients' }, { label: 'Hồ sơ khám', icon: 'clipboard', href: 'encounters' }, { label: 'Lịch làm việc', icon: 'clock', href: 'schedule' }, { label: 'Tư vấn', icon: 'stethoscope', href: 'consultations' }, { label: 'Hồ sơ cá nhân', icon: 'profile', href: 'profile' }],
  RECEPTIONIST: [
    { label: 'Lịch hẹn & Tiếp nhận', icon: 'calendar', href: 'appointments' },
    { label: 'Hàng đợi phòng khám', icon: 'queue', href: 'queue' },
    { label: 'Tra cứu bệnh nhân', icon: 'search', href: 'patients' },
    { label: 'Viện phí & Hóa đơn', icon: 'clipboard', href: 'billing' },
    { label: 'Tổng quan ca trực', icon: 'home', href: 'overview' },
  ],
  NURSE: [{ label: 'Tổng quan', icon: 'home', href: 'overview' }, { label: 'Bệnh nhân hôm nay', icon: 'users', href: 'today' }, { label: 'Hàng đợi', icon: 'queue', href: 'queue' }, { label: 'Encounter phân công', icon: 'clipboard', href: 'encounters' }, { label: 'Sinh hiệu', icon: 'stethoscope', href: 'vitals' }, { label: 'Ghi chú điều dưỡng', icon: 'notes', href: 'notes' }],
  CLINIC_MANAGER: [{ label: 'Tổng quan', icon: 'home', href: 'overview' }, { label: 'Nhân sự vận hành', icon: 'users', href: 'staff' }, { label: 'Bác sĩ & lịch làm việc', icon: 'stethoscope', href: 'doctors' }, { label: 'Lễ tân', icon: 'clipboard', href: 'receptionists' }, { label: 'Dịch vụ & giá', icon: 'settings', href: 'services' }, { label: 'Điều phối lịch hẹn', icon: 'calendar', href: 'appointments' }, { label: 'Báo cáo', icon: 'report', href: 'reports' }],
  ADMIN: [
    { label: 'Dashboard', icon: 'home', href: 'overview' },
    { label: 'Người dùng', icon: 'users', href: 'users' },
    { label: 'Bác sĩ', icon: 'stethoscope', href: 'doctors' },
    { label: 'Chuyên khoa', icon: 'clipboard', href: 'specialties' },
    { label: 'Bệnh nhân', icon: 'search', href: 'patients' },
    { label: 'Dịch vụ & giá', icon: 'clipboard', href: 'services' },
    { label: 'Nhật ký & Kiểm toán', icon: 'notes', href: 'audit-log' },
    { label: 'Giám sát & Sao lưu', icon: 'settings', href: 'system-health' },
  ],
};
function isActive(path: string, href: string) { if (href === '/ho-so/hoan-thien') return path === href || path === '/ho-so'; return path === href || path.startsWith(`${href}/`); }

interface PatientSidebarProps {
  onLogout: () => void;
  profileComplete?: boolean | null;
}

export function PatientSidebar({ onLogout, profileComplete: profileCompleteProp }: PatientSidebarProps) {
  const pathname = usePathname();
  const auth = useAuthSession();
  const role = auth.user?.role as Role | undefined;
  const storageKey = role === 'ADMIN' ? 'an-tam-admin-sidebar-collapsed' : STORAGE_KEY;
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem(storageKey) === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(profileCompleteProp ?? (role !== 'PATIENT' ? true : null));
  const profileRequiredPaths = new Set(['/dat-lich', '/lich-hen', '/hang-doi']);

  useEffect(() => {
    if (profileCompleteProp !== undefined) {
      setProfileComplete(profileCompleteProp);
      return;
    }
    if (role !== 'PATIENT') return;
    let active = true;
    auth.request('/api/patients/me')
      .then(() => { if (active) setProfileComplete(true); })
      .catch((reason) => { if (active && reason instanceof ApiError && reason.statusCode === 404) setProfileComplete(false); else if (active) setProfileComplete(true); });
    return () => { active = false; };
  }, [auth.request, profileCompleteProp, role]);
  useEffect(() => { try { window.localStorage.setItem(storageKey, String(collapsed)); } catch { /* ignore */ } }, [collapsed, storageKey]);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, []);

  const items = role && role !== 'PATIENT' ? workspaceNav[role]?.map((item) => ({ ...item, href: `/workspace/${role.toLowerCase()}/${item.href}` })) ?? patientNavItems : patientNavItems;
  return (
    <div className={`patient-nav-shell ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
      <button className="patient-menu-toggle patient-mobile-menu" type="button" aria-label={mobileOpen ? 'Đóng thanh điều hướng' : 'Mở thanh điều hướng'} aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)}><MenuGlyph /></button>
      <aside className="patient-sidebar" aria-label="Điều hướng chính">
        <div className="patient-sidebar-head"><button className="patient-menu-toggle" type="button" aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'} aria-expanded={!collapsed} onClick={() => { if (window.matchMedia?.('(max-width: 820px)').matches) setMobileOpen(false); else setCollapsed((v) => !v); }}><MenuGlyph /></button><div className="patient-sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><img src="/brand/logo-symbol-cropped.png" alt="Tâm An" style={{ width: 28, height: 28, objectFit: 'contain' }} /><div><strong>Tâm An Hospital</strong><span>{role === 'ADMIN' ? 'Admin portal' : role === 'CLINIC_MANAGER' ? 'Clinic manager portal' : 'Patient portal'}</span></div></div></div>
        <nav className="patient-sidebar-nav"><p className="patient-nav-label">{role === 'ADMIN' ? 'Quản trị hệ thống' : role === 'CLINIC_MANAGER' ? 'Điều hành phòng khám' : 'Không gian của bạn'}</p>
          {items.map((item) => {
            const locked = role === 'PATIENT' && profileComplete === false && profileRequiredPaths.has(item.href);
            if (locked) return <button key={item.href} className="patient-nav-item patient-nav-item-locked" type="button" title="Hãy hoàn thiện hồ sơ trước" aria-disabled="true" onClick={() => navigate('/ho-so/hoan-thien')}><span className="patient-nav-icon"><PatientIcon name={item.icon} /></span><span className="patient-nav-text">{item.label}<small className="patient-nav-lock-label">Cần hồ sơ</small></span></button>;
            return <AppLink key={item.href} className="patient-nav-item" href={item.href} aria-current={isActive(pathname, item.href) ? 'page' : undefined} onClick={() => setMobileOpen(false)}><span className="patient-nav-icon"><PatientIcon name={item.icon} /></span><span className="patient-nav-text">{item.label}</span></AppLink>;
          })}
        </nav>
        <button className="patient-logout" type="button" onClick={onLogout}><span className="patient-nav-icon"><PatientIcon name="exit" /></span><span className="patient-nav-text">Đăng xuất</span></button>
      </aside>
      <button className="patient-sidebar-scrim" type="button" aria-label="Đóng thanh điều hướng" onClick={() => setMobileOpen(false)} />
    </div>
  );
}
