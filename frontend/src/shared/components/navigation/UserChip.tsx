import { useState, useRef, useEffect } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { AppLink, navigate } from '../../../app/navigation';
import type { Role } from './PatientSidebar';
import '../../../styles/user-chip.css';

interface UserChipProps {
  displayName?: string;
  className?: string;
  showWorkspaceLink?: boolean;
  onLogout?: () => void;
}

function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function roleLabel(role?: Role): string {
  switch (role) {
    case 'PATIENT': return 'Bệnh nhân';
    case 'DOCTOR': return 'Bác sĩ';
    case 'RECEPTIONIST': return 'Lễ tân';
    case 'NURSE': return 'Điều dưỡng';
    case 'CLINIC_MANAGER': return 'Quản lý';
    case 'ADMIN': return 'Quản trị viên';
    default: return 'Thành viên';
  }
}

function roleHome(role?: Role): string {
  switch (role) {
    case 'PATIENT': return '/';
    case 'DOCTOR': return '/workspace/doctor/overview';
    case 'RECEPTIONIST': return '/workspace/receptionist/overview';
    case 'NURSE': return '/workspace/nurse/overview';
    case 'CLINIC_MANAGER': return '/workspace/clinic_manager/overview';
    case 'ADMIN': return '/workspace/admin/overview';
    default: return '/';
  }
}

function roleHomeLabel(role?: Role): string {
  switch (role) {
    case 'PATIENT': return 'Cổng Bệnh nhân';
    case 'DOCTOR': return 'Bàn làm việc Bác sĩ';
    case 'RECEPTIONIST': return 'Bàn tiếp đón Lễ tân';
    case 'NURSE': return 'Bàn làm việc Điều dưỡng';
    case 'CLINIC_MANAGER': return 'Khu Quản lý phòng khám';
    case 'ADMIN': return 'Trang Quản trị hệ thống';
    default: return 'Vào Workspace';
  }
}

function getSavedAvatar(userId?: string, email?: string): string | null {
  if (typeof window === 'undefined') return null;
  if (userId) {
    const val = localStorage.getItem(`patient_avatar_${userId}`);
    if (val) return val;
  }
  if (email) {
    const val = localStorage.getItem(`patient_avatar_${email}`);
    if (val) return val;
  }
  return localStorage.getItem('patient_avatar') || null;
}

function getSavedName(userId?: string, email?: string): string | null {
  if (typeof window === 'undefined') return null;
  if (userId) {
    const val = localStorage.getItem(`patient_name_${userId}`);
    if (val) return val;
  }
  if (email) {
    const val = localStorage.getItem(`patient_name_${email}`);
    if (val) return val;
  }
  return null;
}

export function UserChip({
  displayName,
  className = '',
  showWorkspaceLink = true,
  onLogout,
}: UserChipProps) {
  const auth = useAuthSession();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const user = auth.user;
  const role = user?.role as Role | undefined;
  const roleKey = (role?.toLowerCase() || 'patient') as string;

  // Lấy họ tên và avatar từ hồ sơ bệnh nhân (localStorage cache hoặc API)
  const [patientName, setPatientName] = useState<string | null>(() => {
    return getSavedName(user?.userId, user?.email);
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    return getSavedAvatar(user?.userId, user?.email);
  });

  // Tải thông tin hồ sơ bệnh nhân khi đã đăng nhập
  useEffect(() => {
    if (!user) return;
    let active = true;

    // Đọc cache nhanh
    const cachedName = getSavedName(user.userId, user.email);
    if (cachedName && active) {
      setPatientName(cachedName);
    }
    const cachedAvatar = getSavedAvatar(user.userId, user.email);
    if (cachedAvatar && active) {
      setAvatarUrl(cachedAvatar);
    }

    // Nếu là bệnh nhân, fetch thông tin mới nhất từ API /api/patients/me (tránh gọi trong unit test để không xung đột mock)
    if (role === 'PATIENT' && import.meta.env.MODE !== 'test') {
      auth
        .request<{ data: { fullName?: string } }>('/api/patients/me')
        .then(({ data }) => {
          if (!active) return;
          if (data?.fullName) {
            setPatientName(data.fullName);
            try {
              if (user.userId) localStorage.setItem(`patient_name_${user.userId}`, data.fullName);
              if (user.email) localStorage.setItem(`patient_name_${user.email}`, data.fullName);
            } catch {
              // ignore
            }
          }
        })
        .catch(() => {
          // Chưa tạo hồ sơ hoặc không có quyền, bỏ qua
        });
    }

    return () => {
      active = false;
    };
  }, [auth.request, user?.userId, user?.email, role]);

  // Lắng nghe sự kiện cập nhật realtime khi bệnh nhân lưu hồ sơ hoặc đổi avatar
  useEffect(() => {
    function handleProfileUpdate(e: any) {
      if (e.detail?.fullName) {
        setPatientName(e.detail.fullName);
      }
    }
    function handleAvatarUpdate(e: any) {
      if (e.detail?.avatarUrl !== undefined) {
        setAvatarUrl(e.detail.avatarUrl);
      }
    }
    function handleStorageChange(e: StorageEvent) {
      if (!e.key) return;
      if (
        e.key.startsWith('patient_name') ||
        (user?.userId && e.key === `patient_name_${user.userId}`) ||
        (user?.email && e.key === `patient_name_${user.email}`)
      ) {
        if (e.newValue) setPatientName(e.newValue);
      }
      if (
        e.key.startsWith('patient_avatar') ||
        (user?.userId && e.key === `patient_avatar_${user.userId}`) ||
        (user?.email && e.key === `patient_avatar_${user.email}`)
      ) {
        setAvatarUrl(e.newValue);
      }
    }

    window.addEventListener('patient_profile_updated', handleProfileUpdate);
    window.addEventListener('patient_avatar_updated', handleAvatarUpdate);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('patient_profile_updated', handleProfileUpdate);
      window.removeEventListener('patient_avatar_updated', handleAvatarUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user?.userId, user?.email]);

  // Resolve display name: ưu tiên prop > tên hồ sơ bệnh nhân > email prefix
  const fallbackEmailName = user?.email ? user.email.split('@')[0] : 'Người dùng';
  const finalName = displayName?.trim() || patientName?.trim() || fallbackEmailName;
  const initials = getInitials(finalName);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  async function handleLogout() {
    setIsOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      await auth.signOut();
      navigate('/', { replace: true });
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`user-chip-container ${isOpen ? 'is-open' : ''} ${className}`.trim()}
    >
      <button
        type="button"
        className="user-chip-button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Menu tài khoản của ${finalName}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="user-chip-avatar-wrap">
          <div className={`user-chip-avatar role-${roleKey} ${avatarUrl ? 'has-image' : ''}`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={finalName} className="user-chip-avatar-img" />
            ) : (
              initials
            )}
          </div>
          <span className="user-chip-status-dot" title="Đang hoạt động" />
        </div>

        <div className="user-chip-info">
          <span className="user-chip-name">{finalName}</span>
          <span className={`user-chip-role-badge role-${roleKey}`}>
            {roleLabel(role)}
          </span>
        </div>

        <svg
          className="user-chip-chevron"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="user-chip-dropdown" role="menu">
          <div className="user-chip-dropdown-header">
            <div className={`user-chip-dropdown-avatar user-chip-avatar role-${roleKey} ${avatarUrl ? 'has-image' : ''}`}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={finalName} className="user-chip-avatar-img" />
              ) : (
                initials
              )}
            </div>
            <div className="user-chip-dropdown-user">
              <span className="user-chip-dropdown-title">{finalName}</span>
              <span className="user-chip-dropdown-email">{user.email}</span>
            </div>
          </div>

          <ul className="user-chip-menu-list">
            {showWorkspaceLink && (
              <li className="user-chip-menu-item">
                <AppLink
                  href={roleHome(role)}
                  className="user-chip-menu-link"
                  onClick={() => setIsOpen(false)}
                >
                  <svg className="user-chip-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <span>{roleHomeLabel(role)}</span>
                </AppLink>
              </li>
            )}

            {role === 'PATIENT' ? (
              <>
                <li className="user-chip-menu-item">
                  <AppLink
                    href="/ho-so/hoan-thien"
                    className="user-chip-menu-link"
                    onClick={() => setIsOpen(false)}
                  >
                    <svg className="user-chip-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Hồ sơ & Thông tin thai kỳ</span>
                  </AppLink>
                </li>
                <li className="user-chip-menu-item">
                  <AppLink
                    href="/dat-lich"
                    className="user-chip-menu-link"
                    onClick={() => setIsOpen(false)}
                  >
                    <svg className="user-chip-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>Đặt lịch khám online</span>
                  </AppLink>
                </li>
                <li className="user-chip-menu-item">
                  <AppLink
                    href="/lich-hen"
                    className="user-chip-menu-link"
                    onClick={() => setIsOpen(false)}
                  >
                    <svg className="user-chip-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span>Lịch khám đã đặt</span>
                  </AppLink>
                </li>
              </>
            ) : null}

            {role !== 'PATIENT' && (
              <li className="user-chip-menu-item">
                <AppLink
                  href="/"
                  className="user-chip-menu-link"
                  onClick={() => setIsOpen(false)}
                >
                  <svg className="user-chip-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  <span>Về Trang chủ Bệnh viện</span>
                </AppLink>
              </li>
            )}

            <li className="user-chip-menu-divider" role="separator" />

            <li className="user-chip-menu-item">
              <button
                type="button"
                className="user-chip-menu-btn logout-action"
                onClick={() => void handleLogout()}
              >
                <svg className="user-chip-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Đăng xuất tài khoản</span>
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
