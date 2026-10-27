import { navigate } from '../../../app/navigation';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { PatientSidebar } from '../../../shared/components/navigation/PatientSidebar';
import '../../../styles/patient-home.css';
import '../../../styles/patient-portal.css';

export function PatientNotificationsBillingPage() {
  const auth = useAuthSession();
  async function logout() {
    await auth.signOut();
    navigate('/dang-nhap', { replace: true });
  }

  return <div className="patient-home-shell patient-desktop-portal">
    <PatientSidebar onLogout={() => void logout()} />
    <main className="patient-main-view">
      <section className="patient-portal-page">
        <div className="patient-page-heading">
          <span>Thông báo & hóa đơn</span>
          <h1>Cập nhật và chi phí khám</h1>
          <p>Các thông tin hiển thị tuân theo quyền truy cập mà backend cấp cho tài khoản.</p>
        </div>
        <div className="tabs-grid">
          <article className="portal-card portal-empty compact">
            <div>
              <div className="portal-empty-icon" aria-hidden="true">i</div>
              <h2>Thông báo chưa khả dụng</h2>
              <p>Notification Service hiện chưa expose REST API dành cho Patient Portal.</p>
            </div>
          </article>
          <article className="portal-card portal-empty compact">
            <div>
              <div className="portal-empty-icon" aria-hidden="true">₫</div>
              <h2>Hóa đơn dành cho staff</h2>
              <p>Billing Service hiện chỉ cho phép Receptionist và Admin tra cứu hóa đơn. Patient Portal sẽ không gọi API khi chưa được backend cấp quyền.</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>;
}
