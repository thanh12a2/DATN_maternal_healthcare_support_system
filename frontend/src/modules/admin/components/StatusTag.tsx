import { Tag } from 'antd';
import { statusColor } from '../format';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động', INACTIVE: 'Tạm khóa', PENDING: 'Chờ xử lý', COMPLETED: 'Hoàn thành', CANCELLED: 'Đã hủy',
  CANCELED: 'Đã hủy', CONFIRMED: 'Đã xác nhận', PAID: 'Đã thanh toán', UNPAID: 'Chưa thanh toán', ISSUED: 'Đã phát hành',
  DRAFT: 'Bản nháp', IN_PROGRESS: 'Đang thực hiện', WAITING: 'Đang chờ', CALLED: 'Đã gọi', REJECTED: 'Từ chối', EXPIRED: 'Hết hạn',
  OPEN: 'Đang mở', CLOSED: 'Đã đóng', FINALIZED: 'Đã chốt', SCHEDULED: 'Đã lên lịch', NO_SHOW: 'Vắng mặt',
  BOOKED: 'Đã đặt lịch', CHECKED_IN: 'Đã check-in',
  LOCKED: 'Tạm khóa', DISABLED: 'Vô hiệu hóa', PENDING_VERIFICATION: 'Chờ xác thực',
};

export function StatusTag({ status }: { status: unknown }) {
  if (!status) return <span>—</span>;
  const raw = String(status).toUpperCase();
  // Bản nháp dùng màu tím nhẹ (purple) để phân biệt rõ ràng với xanh lá (Hoạt động) và vàng cam (Tạm khóa)
  const color = raw === 'DRAFT' ? 'purple' : statusColor(raw);
  return <Tag color={color} variant="filled">{STATUS_LABELS[raw] ?? raw}</Tag>;
}
