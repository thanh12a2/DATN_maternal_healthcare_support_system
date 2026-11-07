import { PatientPortalLayout } from '../components/PatientPortalLayout';
import { NotificationInbox } from '../../../shared/components/notifications/NotificationInbox';

/**
 * Trang Thông báo & Hóa đơn (Đang chuẩn bị thiết kế lại)
 */
export function PatientNotificationsBillingPage() {
  return (
    <PatientPortalLayout eyebrow="Tài khoản cá nhân" title="Thông báo & Hóa đơn">
      <NotificationInbox />
    </PatientPortalLayout>
  );
}
