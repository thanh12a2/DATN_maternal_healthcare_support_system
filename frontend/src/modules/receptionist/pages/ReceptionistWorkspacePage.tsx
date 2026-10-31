import { useEffect, useState } from 'react';
import { PatientSidebar } from '../../../shared/components/navigation/PatientSidebar';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate, usePathname } from '../../../app/navigation';
import { ApiError } from '../../../services/api';
import { getMyReceptionist } from '../../../services/operations';
import { ReceptionistAdmissionWorkspace } from '../components/ReceptionistAdmissionWorkspace';
import { ReceptionistQueueWorkspace } from '../components/ReceptionistQueueWorkspace';
import { ReceptionistBillingWorkspace } from '../components/ReceptionistBillingWorkspace';
import { ReceptionistWorkspaceFrame } from '../components/ReceptionistWorkspaceFrame';
import { ReceptionistAppointmentsWorkspace } from '../components/ReceptionistAppointmentsWorkspace';
import '../../../styles/patient-home.css';
import '../../../styles/patient-portal.css';
import '../../../styles/receptionist-content.css';
import '../../../styles/receptionist-fixes.css';

type WorkspaceState = 'loading' | 'ready' | 'error' | 'unavailable';
type Summary = { label: string; value: string; detail: string };

function ReceptionistOverview({ summaries, state, error }: { summaries: Summary[]; state: WorkspaceState; error: string }) {
  if (state === 'loading') return <div className="receptionist-loading-lines"><i /><i /><i /></div>;
  if (state === 'error') return <section className="receptionist-empty" role="alert"><strong>Không thể tải tổng quan</strong><p>{error}</p></section>;
  if (!summaries.length) return <section className="receptionist-empty"><strong>Chưa có dữ liệu vận hành</strong><p>Hãy bắt đầu từ Tiếp nhận để tìm bệnh nhân và lịch hẹn.</p></section>;
  return (
    <>
      <section className="receptionist-overview-grid">
        {summaries.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>
      <section className="receptionist-next-actions">
        <span className="receptionist-kicker">Việc cần làm</span>
        <h2>Bắt đầu tiếp nhận bệnh nhân</h2>
        <p>Tìm bệnh nhân theo họ tên, số điện thoại hoặc CCCD; sau đó chọn lịch hẹn để mở case.</p>
        <div>
          <button type="button" onClick={() => navigate('/workspace/receptionist/patients')}>Tra cứu bệnh nhân</button>
          <button type="button" onClick={() => navigate('/workspace/receptionist/reception')}>Mở tiếp nhận</button>
        </div>
      </section>
    </>
  );
}

function apiMessage(error: unknown) {
  if (error instanceof ApiError && error.statusCode === 403) return 'Tài khoản không có quyền xem dữ liệu này.';
  if (error instanceof ApiError && error.statusCode === 404) return 'API chưa có dữ liệu cho khu vực này.';
  return error instanceof Error ? error.message : 'Không thể tải dữ liệu workspace.';
}

export function ReceptionistWorkspacePage() {
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
        const profile = await getMyReceptionist(auth.request);
        if (active) {
          setSummaries([
            { label: 'Hồ sơ tài khoản', value: profile ? 'Đã kết nối' : 'Trống', detail: 'Receptionist Service' },
            { label: 'Tiếp nhận', value: 'Sẵn sàng', detail: 'Mở case khi có appointment hợp lệ' },
            { label: 'Check-in', value: 'Theo quyền', detail: 'Business flow do backend quyết định' },
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

  const receptionistContent = section === 'appointments'
    ? <ReceptionistAppointmentsWorkspace request={auth.request} />
    : section === 'queue'
    ? <ReceptionistQueueWorkspace request={auth.request} />
    : section === 'billing'
    ? <ReceptionistBillingWorkspace request={auth.request} />
    : ['patients', 'reception', 'check-in'].includes(section)
    ? <ReceptionistAdmissionWorkspace section={section} request={auth.request} />
    : <ReceptionistOverview summaries={summaries} state={state} error={error} />;

  return (
    <div className="patient-home-shell patient-desktop-portal receptionist-portal">
      <PatientSidebar onLogout={() => void auth.signOut().then(() => navigate('/dang-nhap', { replace: true }))} />
      <main className="patient-main-view receptionist-main">
        <ReceptionistWorkspaceFrame section={section}>{receptionistContent}</ReceptionistWorkspaceFrame>
      </main>
    </div>
  );
}
