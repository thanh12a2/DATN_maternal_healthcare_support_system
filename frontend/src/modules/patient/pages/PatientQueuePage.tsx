import { PatientPortalLayout } from '../components/PatientPortalLayout';

/**
 * Trang Hàng đợi khám trực tuyến (Đang chuẩn bị thiết kế lại)
 */
export function PatientQueuePage() {
  return (
    <PatientPortalLayout eyebrow="Tiện ích trực tuyến" title="Hàng đợi khám Live">
      <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
        <h2 style={{ fontSize: '20px', color: '#183153', marginBottom: '8px' }}>
          Hàng đợi khám trực tuyến
        </h2>
        <p style={{ fontSize: '15px', margin: 0 }}>
          Trang hàng đợi khám đang được chuẩn bị thiết kế mới.
        </p>
      </div>
    </PatientPortalLayout>
  );
}
