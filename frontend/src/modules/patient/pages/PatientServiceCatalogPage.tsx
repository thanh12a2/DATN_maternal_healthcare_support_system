import { PatientPortalLayout } from '../components/PatientPortalLayout';

/**
 * Trang Danh mục dịch vụ & Gói thai sản (Đang chuẩn bị thiết kế lại)
 */
export function PatientServiceCatalogPage() {
  return (
    <PatientPortalLayout eyebrow="Danh mục y khoa" title="Dịch vụ & Bảng giá">
      <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
        <h2 style={{ fontSize: '20px', color: '#183153', marginBottom: '8px' }}>
          Dịch vụ & Gói khám thai sản
        </h2>
        <p style={{ fontSize: '15px', margin: 0 }}>
          Trang danh mục dịch vụ đang được chuẩn bị thiết kế mới.
        </p>
      </div>
    </PatientPortalLayout>
  );
}
