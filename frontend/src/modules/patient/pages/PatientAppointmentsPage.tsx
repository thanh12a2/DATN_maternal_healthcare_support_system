import { PatientPortalLayout } from '../components/PatientPortalLayout';

/**
 * Trang Chi tiết phiếu hẹn khám (Đang chuẩn bị thiết kế lại)
 */
export function AppointmentDetailPage({ appointmentId }: { appointmentId: string }) {
  return (
    <PatientPortalLayout eyebrow="Lịch hẹn khám" title="Chi tiết phiếu hẹn">
      <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
        <h2 style={{ fontSize: '20px', color: '#183153', marginBottom: '8px' }}>
          Chi tiết phiếu hẹn khám
        </h2>
        <p style={{ fontSize: '15px', margin: 0 }}>
          Phiếu hẹn khám ({appointmentId}) đang được chuẩn bị thiết kế mới.
        </p>
      </div>
    </PatientPortalLayout>
  );
}

/**
 * Trang Danh sách lịch hẹn của tôi (Đang chuẩn bị thiết kế lại)
 */
export function PatientAppointmentsPage() {
  return (
    <PatientPortalLayout eyebrow="Hồ sơ bệnh nhân" title="Lịch hẹn của tôi">
      <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
        <h2 style={{ fontSize: '20px', color: '#183153', marginBottom: '8px' }}>
          Lịch hẹn khám của tôi
        </h2>
        <p style={{ fontSize: '15px', margin: 0 }}>
          Trang danh sách lịch hẹn đang được chuẩn bị thiết kế mới.
        </p>
      </div>
    </PatientPortalLayout>
  );
}
