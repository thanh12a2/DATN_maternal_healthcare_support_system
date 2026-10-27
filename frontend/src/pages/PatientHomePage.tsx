import { useEffect, useState } from 'react';
import { Mascot } from 'page-mascot';
import { useAuthSession } from '../app/AuthSessionProvider';
import { AppLink } from '../app/navigation';
import { PatientPortalLayout } from '../components/layout/PatientPortalLayout';
import { LoadingPlaceholder } from '../components/ui/LoadingPlaceholder';
import { ApiError } from '../services/api';
import type { PatientProfile } from '../services/patient';
import '../styles/patient-overview.css';

interface Envelope<T> { data: T; }
type OverviewIcon = 'profile' | 'calendar' | 'queue' | 'invoice';

function StatusIcon({ type }: { type: OverviewIcon }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true };
  if (type === 'profile') return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>;
  if (type === 'calendar') return <svg {...common}><path d="M7 2v4M17 2v4M4 9h16"/><rect x="4" y="5" width="16" height="16" rx="2"/></svg>;
  if (type === 'queue') return <svg {...common}><path d="M4 7h16M4 12h12M4 17h8"/></svg>;
  return <svg {...common}><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 8h6M9 12h6"/></svg>;
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

  const displayName = profile?.fullName || auth.user?.email.split('@')[0] || 'Bệnh nhân';
  const progressValue = profile ? 100 : 0;

  return <>
    <PatientPortalLayout eyebrow="Chào mừng, quay trở lại" title="Tổng quan" displayName={displayName} contentClassName="patient-overview-content" profileComplete={state === 'loading' ? null : Boolean(profile)}>
      <LoadingPlaceholder visible={state === 'loading'} label="Đang chuẩn bị không gian của bạn" />
      {state === 'error' && <div className="patient-overview-error" role="alert"><strong>Không thể tải hồ sơ</strong><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Thử lại</button></div>}
      {state === 'ready' && <div className="patient-screen-grid">
        <div className="patient-screen-stack">
          <article className="patient-overview-hero">
            <span className="patient-overview-eyebrow">Patient Portal</span>
            <h1>{profile ? 'Chăm sóc hành trình khám của bạn rõ ràng hơn.' : 'Hoàn thiện hồ sơ bệnh nhân'}</h1>
            <p>{profile ? 'Theo dõi lịch hẹn, hàng đợi và nhận hướng dẫn từ phòng khám trong một không gian nhẹ nhàng, dễ quét.' : 'Bổ sung thông tin hành chính để bắt đầu đặt lịch và sử dụng cổng bệnh nhân.'}</p>
            <div className="patient-overview-actions">
              <AppLink className="patient-overview-primary" href={profile ? '/dat-lich' : '/ho-so/hoan-thien'}>{profile ? 'Đặt lịch khám' : 'Hoàn thiện hồ sơ'}</AppLink>
              {profile && <AppLink className="patient-overview-secondary" href="/ho-so/hoan-thien">Xem và cập nhật hồ sơ</AppLink>}
            </div>
          </article>
          <div className="patient-overview-status-grid">
            <article className="patient-overview-status"><span className="patient-overview-status-icon"><StatusIcon type="profile" /></span><div><span className={`patient-overview-badge ${profile ? 'success' : 'warning'}`}>{profile ? 'Đã hoàn tất' : 'Cần hoàn thiện'}</span><h3>Hồ sơ hành chính</h3><p>{profile ? 'Thông tin cơ bản đã sẵn sàng để sử dụng.' : 'Hoàn thiện thông tin để bắt đầu đặt lịch.'}</p></div></article>
            <AppLink className="patient-overview-status" href="/lich-hen"><span className="patient-overview-status-icon"><StatusIcon type="calendar" /></span><div><span className="patient-overview-badge neutral">Theo dõi</span><h3>Lịch hẹn sắp tới</h3><p>Thông tin lịch khám xuất hiện sau khi đặt lịch thành công.</p></div></AppLink>
            <AppLink className="patient-overview-status" href="/hang-doi"><span className="patient-overview-status-icon"><StatusIcon type="queue" /></span><div><span className="patient-overview-badge neutral">Chưa check-in</span><h3>Hàng đợi hiện tại</h3><p>Bạn sẽ nhận số thứ tự tại quầy lễ tân khi đến khám.</p></div></AppLink>
            <AppLink className="patient-overview-status" href="/thong-bao-hoa-don"><span className="patient-overview-status-icon"><StatusIcon type="invoice" /></span><div><span className="patient-overview-badge success">Ổn định</span><h3>Hóa đơn cần chú ý</h3><p>Chưa có khoản thanh toán cần xử lý.</p></div></AppLink>
          </div>
        </div>
        <aside className="patient-screen-stack">
          <section className="patient-overview-progress"><span>Tiến độ hồ sơ</span><h3>{progressValue}% hoàn tất</h3><div><i style={{ width: String(progressValue) + '%' }} /></div><p>Tiến độ dựa trên hồ sơ hành chính hiện có của tài khoản.</p></section>
          <section className="patient-overview-state"><strong>Không có thông báo mới</strong><p>Các nhắc hẹn và cập nhật từ phòng khám sẽ được hiển thị tại đây.</p></section>
          <section className="patient-overview-state unavailable"><strong>Tư vấn đang phát triển</strong><p>Tính năng nhắn tin sẽ xuất hiện khi phòng khám kích hoạt.</p></section>
        </aside>
      </div>}
    </PatientPortalLayout>
    {canRenderMascot && <div className="patient-chatbot-launcher" aria-label="Trợ lý ảo chăm sóc sức khỏe"><span className="patient-chatbot-mascot" aria-hidden="true"><Mascot directions="/mascots/crt-directions.webp" reactions="/mascots/crt-reactions.webp" size={74} label="Trợ lý ảo" /></span><span className="patient-chatbot-copy"><strong>Trợ lý ảo</strong><small>Hỏi đáp nhanh</small></span></div>}
  </>;
}
