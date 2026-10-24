import { useEffect, useState } from 'react';
import { Mascot } from 'page-mascot';
import { useAuthSession } from '../app/AuthSessionProvider';
import { AppLink, navigate } from '../app/navigation';
import { PatientSidebar } from '../components/navigation/PatientSidebar';
import { ApiError } from '../services/api';
import type { PatientProfile } from '../services/patient';
import '../styles/patient-home.css';
import '../styles/patient-portal.css';

interface Envelope<T> { data: T; }

type QuickCard = { title: string; value: string; copy: string; href: string; tone: 'info' | 'warning' | 'success' };

const quickCards: QuickCard[] = [
  { title: 'Lịch hẹn sắp tới', value: 'Chưa có lịch hẹn', copy: 'Khi đặt lịch thành công, thông tin khám sẽ hiển thị tại đây.', href: '/dat-lich', tone: 'info' },
  { title: 'Hàng đợi khám', value: 'Chưa check-in', copy: 'Bạn sẽ nhận số thứ tự sau khi hoàn tất tiếp nhận tại quầy.', href: '/hang-doi', tone: 'warning' },
  { title: 'Thông báo', value: 'Không có mới', copy: 'Các nhắc lịch và cập nhật quan trọng sẽ được gom tại đây.', href: '/thong-bao-hoa-don', tone: 'success' },
  { title: 'Hóa đơn', value: 'Chưa phát sinh', copy: 'Hóa đơn và hướng dẫn thanh toán sẽ hiển thị khi có dữ liệu.', href: '/thong-bao-hoa-don', tone: 'info' },
];

function PointIcon({ type }: { type: 'person' | 'contact' | 'health' }) {
  if (type === 'person') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>;
  if (type === 'contact') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16v14H4z"/><path d="m5 7 7 5 7-5"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14"/></svg>;
}

export function PatientHomePage() {
  const auth = useAuthSession();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const canRenderMascot = typeof window.matchMedia === 'function';

  useEffect(() => {
    let active = true;
    auth.request<Envelope<PatientProfile>>('/api/patients/me')
      .then((response) => { if (active) { setProfile(response.data); setState('ready'); } })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.statusCode === 404) { setProfile(null); setState('ready'); }
        else { setError(reason instanceof Error ? reason.message : 'Không thể tải hồ sơ.'); setState('error'); }
      });
    return () => { active = false; };
  }, [auth.request]);

  const displayName = profile?.fullName || auth.user?.email.split('@')[0] || 'Tài khoản mới';
  const initials = profile?.fullName ? profile.fullName.split(/s+/).slice(-2).map((p) => p[0]).join('').toUpperCase() : 'BN';
  async function logout() { await auth.signOut(); navigate('/dang-nhap', { replace: true }); }

  return <div className="patient-home-shell patient-desktop-portal">
    <PatientSidebar onLogout={() => void logout()} />
    <main className="patient-main-view" id="main-content">
      <header className="patient-topbar"><div><span>Chào mừng, quay trở lại</span><strong>Tổng quan</strong></div><div className="patient-account-chip"><span className="patient-avatar">{initials}</span><span>{displayName}</span></div></header>
      <section className="patient-home-section patient-dashboard-section">
        {state === 'loading' && <article className="patient-profile-card patient-status-card" aria-live="polite"><div className="patient-profile-content"><span className="patient-status-label is-loading">Đang kiểm tra hồ sơ</span><h1>Đang chuẩn bị không gian của bạn</h1><p className="patient-profile-lead">Vui lòng chờ trong giây lát…</p></div></article>}
        {state === 'error' && <article className="patient-profile-card patient-status-card" role="alert"><div className="patient-profile-content"><span className="patient-status-label">Không thể tải hồ sơ</span><h1>Đã có lỗi xảy ra</h1><p className="patient-profile-lead">{error}</p><button className="patient-secondary-action" onClick={() => window.location.reload()}>Thử lại</button></div></article>}
        {state === 'ready' && <>
          <article className={`patient-profile-card patient-dashboard-hero ${profile ? 'is-complete' : ''}`}>
            <div className="patient-profile-content">
              <span className="patient-status-label">{profile ? 'Hồ sơ đã hoàn tất' : 'Hồ sơ chưa hoàn tất'}</span>
              <h1>{profile ? 'Không gian chăm sóc của bạn đã sẵn sàng' : 'Hoàn thiện hồ sơ bệnh nhân'}</h1>
              <p className="patient-profile-lead">{profile ? 'Theo dõi lịch hẹn, hàng đợi và các cập nhật quan trọng trong cùng một nơi.' : 'Bổ sung thông tin hành chính để bắt đầu đặt lịch và sử dụng cổng bệnh nhân.'}</p>
              <ul className="patient-profile-points" aria-label={profile ? 'Thông tin trong hồ sơ' : 'Thông tin cần hoàn thiện'}>
                <li><span><PointIcon type="person" /></span>Thông tin định danh cá nhân</li>
                <li><span><PointIcon type="contact" /></span>Địa chỉ và liên hệ khẩn cấp</li>
                <li><span><PointIcon type="health" /></span>Thông tin sức khỏe cơ bản <small>đang được phát triển</small></li>
              </ul>
              <div className="patient-dashboard-actions"><AppLink className="patient-primary-action" href={profile ? '/dat-lich' : '/ho-so/hoan-thien'}>{profile ? 'Đặt lịch khám' : 'Hoàn thiện hồ sơ'}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5" /></svg></AppLink>{profile && <AppLink className="patient-secondary-link" href="/ho-so/hoan-thien">Xem và cập nhật hồ sơ</AppLink>}</div>
            </div>
          </article>
          <div className="patient-dashboard-grid" aria-label="Tổng quan nhanh">{quickCards.map((card) => <AppLink key={card.title} className={`patient-dashboard-card tone-${card.tone}`} href={card.href}><span>{card.title}</span><strong>{card.value}</strong><p>{card.copy}</p></AppLink>)}</div>
        </>}
      </section>
    </main>

    {canRenderMascot && (
      <div
        className="patient-chatbot-launcher"
        aria-label="Trợ lý ảo chăm sóc sức khỏe"
      >
        <span className="patient-chatbot-mascot" aria-hidden="true">
          <Mascot
            directions="/mascots/crt-directions.webp"
            reactions="/mascots/crt-reactions.webp"
            size={74}
            label="Trợ lý ảo"
          />
        </span>
        <span className="patient-chatbot-copy">
          <strong>Trợ lý ảo</strong>
          <small>Hỏi đáp nhanh</small>
        </span>
      </div>
    )}
  </div>;
}
