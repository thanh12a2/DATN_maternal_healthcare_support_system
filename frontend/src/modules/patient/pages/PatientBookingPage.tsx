import { PatientPortalLayout } from '../components/PatientPortalLayout';

/**
 * Trang Đặt lịch khám trực tuyến (Đang chuẩn bị thiết kế lại)
 */
export function PatientBookingPage() {
  return (
    <PatientPortalLayout eyebrow="Đặt hẹn trực tuyến" title="Đặt lịch khám bệnh">
      <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
        <h2 style={{ fontSize: '20px', color: '#183153', marginBottom: '8px' }}>
          Đặt lịch khám trực tuyến
        </h2>
        <p style={{ fontSize: '15px', margin: 0 }}>
          Trang đặt lịch khám đang được chuẩn bị thiết kế mới.
        </p>
      </div>
    </PatientPortalLayout>
  );
}
