import { PatientPortalLayout } from '../components/PatientPortalLayout';

/**
 * Trang Chi tiết dịch vụ y tế (Đang chuẩn bị thiết kế lại)
 */
export function PatientServiceDetailPage({ serviceId }: { serviceId: string }) {
  return (
    <PatientPortalLayout eyebrow="Dịch vụ y tế" title="Chi tiết dịch vụ">
      <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
        <h2 style={{ fontSize: '20px', color: '#183153', marginBottom: '8px' }}>
          Chi tiết dịch vụ y tế
        </h2>
        <p style={{ fontSize: '15px', margin: 0 }}>
          Trang chi tiết dịch vụ ({serviceId}) đang được chuẩn bị thiết kế mới.
        </p>
      </div>
    </PatientPortalLayout>
  );
}
