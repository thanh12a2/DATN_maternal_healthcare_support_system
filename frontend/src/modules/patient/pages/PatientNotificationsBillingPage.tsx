import { PatientPortalLayout } from '../components/PatientPortalLayout';

/**
 * Trang Thông báo & Hóa đơn (Đang chuẩn bị thiết kế lại)
 */
export function PatientNotificationsBillingPage() {
  return (
    <PatientPortalLayout eyebrow="Tài khoản cá nhân" title="Thông báo & Hóa đơn">
      <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
        <h2 style={{ fontSize: '20px', color: '#183153', marginBottom: '8px' }}>
          Thông báo & Hóa đơn thanh toán
        </h2>
        <p style={{ fontSize: '15px', margin: 0 }}>
          Trang thông báo và hóa đơn đang được chuẩn bị thiết kế mới.
        </p>
      </div>
    </PatientPortalLayout>
  );
}
