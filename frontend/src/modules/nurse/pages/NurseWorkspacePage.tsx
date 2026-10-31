import { useEffect, useState } from 'react';
import { PatientSidebar } from '../../../shared/components/navigation/PatientSidebar';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate, usePathname } from '../../../app/navigation';
import { ApiError } from '../../../services/api';
import { listEncounters, listPrescriptions, listTreatmentPlans } from '../../../services/clinical';
import '../../../styles/patient-home.css';
import '../../../styles/patient-portal.css';

type WorkspaceState = 'loading' | 'ready' | 'error' | 'unavailable';
type Summary = { label: string; value: string; detail: string };

function apiMessage(error: unknown) {
  if (error instanceof ApiError && error.statusCode === 403) return 'Tài khoản không có quyền xem dữ liệu này.';
  if (error instanceof ApiError && error.statusCode === 404) return 'API chưa có dữ liệu cho khu vực này.';
  return error instanceof Error ? error.message : 'Không thể tải dữ liệu workspace.';
}

export function NurseWorkspacePage() {
  const auth = useAuthSession();
  const pathname = usePathname();
  const section = pathname.split('/').filter(Boolean).at(-1) || 'overview';
  const [state, setState] = useState<WorkspaceState>('loading');
  const [error, setError] = useState('');
  const [summaries, setSummaries] = useState<Summary[]>([]);

  useEffect(() => {
    let active = true;
    setState('loading');
    setError('');
    setSummaries([]);
    const load = async () => {
      try {
        const [encounters, prescriptions, plans] = await Promise.all([
          listEncounters(auth.request),
          listPrescriptions(auth.request),
          listTreatmentPlans(auth.request),
        ]);
        if (active) {
          setSummaries([
            { label: 'Encounter được phân công', value: String(encounters.length), detail: 'Không tự suy diễn quyền clinical' },
            { label: 'Đơn thuốc liên quan', value: String(prescriptions.length), detail: 'Dữ liệu do backend trả về' },
            { label: 'Kế hoạch điều trị', value: String(plans.length), detail: 'Theo assignment/permission' },
          ]);
          setState('ready');
        }
      } catch (reason) {
        if (!active) return;
        if (reason instanceof ApiError && [404, 501].includes(reason.statusCode)) setState('unavailable');
        else { setError(apiMessage(reason)); setState('error'); }
      }
    };
    void load();
    return () => { active = false; };
  }, [auth.request, section]);

  async function logout() {
    await auth.signOut();
    navigate('/dang-nhap', { replace: true });
  }

  return (
    <div className="patient-home-shell patient-desktop-portal">
      <PatientSidebar onLogout={() => void logout()} />
      <main className="patient-main-view" id="main-content">
        <header className="patient-topbar">
          <div>
            <span>Điều dưỡng workspace</span>
            <strong>{section === 'overview' ? 'Tổng quan' : section}</strong>
          </div>
          <div className="patient-account-chip">
            <span>{auth.user?.email}</span>
          </div>
        </header>
        <section className="patient-home-section patient-dashboard-section">
          <div className="patient-page-heading">
            <span>Không gian điều dưỡng</span>
            <h1>{section === 'overview' ? 'Tổng quan' : section}</h1>
            <p>Theo dõi công việc điều dưỡng và encounter được phân công.</p>
          </div>
          {state === 'loading' && (
            <article className="portal-card" role="status">
              <h2>Đang tải dữ liệu</h2>
              <p>Đang kiểm tra dữ liệu từ các service được cấp quyền…</p>
            </article>
          )}
          {state === 'error' && (
            <article className="portal-card" role="alert">
              <h2>Không thể tải workspace</h2>
              <p>{error}</p>
              <button className="patient-primary-action" type="button" onClick={() => window.location.reload()}>
                Thử lại
              </button>
            </article>
          )}
          {state === 'unavailable' && (
            <article className="portal-card portal-empty">
              <div>
                <div className="portal-empty-icon" aria-hidden="true">!</div>
                <h2>Tính năng chưa khả dụng</h2>
                <p>Backend chưa expose dữ liệu cho khu vực này hoặc tài khoản chưa được provision.</p>
              </div>
            </article>
          )}
          {state === 'ready' && (
            <>
              <div className="patient-dashboard-grid" aria-label="Tóm tắt workspace">
                {summaries.map((item) => (
                  <article className="patient-dashboard-card" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
              <article className="portal-card" style={{ marginTop: 20 }}>
                <span className="portal-badge">Trạng thái hệ thống</span>
                <h2 style={{ marginTop: 12 }}>Đã kết nối API</h2>
                <p className="portal-note">Các thao tác thay đổi dữ liệu clinical chỉ được thực hiện khi backend trả về permission và state hợp lệ.</p>
              </article>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
