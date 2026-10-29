import { Button, Descriptions, Divider, Drawer, Grid, Popconfirm, Space, Steps, Tabs, Tag } from 'antd';
import dayjs from 'dayjs';
import { amountTotalOf, paymentStatusOf, type DeskAppointment, type DeskPatient } from '../../../services/receptionDesk';
import { InvoiceSection } from './InvoiceSection';
import { age, channelText, dateTime, money, payMeta, sourceMeta, statusMeta, time } from '../utils/appointmentMeta';

interface Props {
  appointment: DeskAppointment | null;
  patient?: DeskPatient;
  busy?: boolean;
  onClose: () => void;
  onCheckIn: (a: DeskAppointment) => void;
  onCancel: (a: DeskAppointment) => void;
  onCollect: (a: DeskAppointment) => void;
  onPrint: (what: string) => void;
}

export function AppointmentDrawer({ appointment: a, patient: p, busy, onClose, onCheckIn, onCancel, onCollect, onPrint }: Props) {
  const screens = Grid.useBreakpoint();
  const step = a ? (a.completedAt ? 3 : a.startedAt ? 2 : a.checkedInAt ? 1 : 0) : 0;
  const closed = a ? ['CANCELLED', 'NO_SHOW', 'COMPLETED', 'IN_CLINICAL_CARE'].includes(a.status) : true;
  const pay = a ? paymentStatusOf(a) : 'UNPAID';

  return (
    <Drawer
      open={!!a} onClose={onClose} width={screens.md ? 700 : '100%'} destroyOnHidden
      title={a ? <Space wrap>{a.code}<Tag color={statusMeta[a.status]?.color}>{statusMeta[a.status]?.label ?? a.status}</Tag><Tag color={sourceMeta[a.source].color}>{sourceMeta[a.source].label}</Tag></Space> : ''}
      footer={a && (
        <Space wrap>
          {a.status === 'BOOKED' && (
            <Popconfirm title="Xác nhận check-in?" okText="Check-in" cancelText="Hủy" onConfirm={() => onCheckIn(a)}>
              <Button type="primary" loading={busy}>Check-in</Button>
            </Popconfirm>
          )}
          {a.queueCode && <Button type={a.status === 'CHECKED_IN' ? 'primary' : 'default'} onClick={() => onPrint('phiếu số thứ tự')}>In phiếu số thứ tự</Button>}
          <Popconfirm title="Hủy lịch hẹn này?" okText="Hủy lịch" okButtonProps={{ danger: true }} cancelText="Không" onConfirm={() => onCancel(a)}>
            <Button danger disabled={closed}>Hủy lịch</Button>
          </Popconfirm>
        </Space>
      )}
    >
      {a && (
        <Tabs items={[
          {
            key: 'patient', label: 'Bệnh nhân',
            children: p ? (
              <Descriptions size="small" bordered column={1} items={[
                { label: 'Họ tên', children: <b>{p.fullName}</b> },
                { label: 'Mã bệnh nhân', children: p.id },
                { label: 'Ngày sinh / Tuổi', children: p.dateOfBirth ? `${dayjs(p.dateOfBirth).format('DD/MM/YYYY')} (${age(p.dateOfBirth)} tuổi)` : '—' },
                { label: 'SĐT', children: p.phone ?? '—' },
                { label: 'CCCD', children: p.nationalIdMasked ?? '—' },
                { label: 'Địa chỉ', children: p.address ?? '—' },
                { label: 'Liên hệ khẩn cấp', children: p.emergencyContacts.length ? p.emergencyContacts.map((c) => `${c.fullName}${c.relationship ? ` (${c.relationship})` : ''} – ${c.phone ?? ''}`).join('; ') : '—' },
              ]} />
            ) : 'Không có thông tin bệnh nhân',
          },
          {
            key: 'appt', label: 'Lịch hẹn',
            children: (
              <>
                <Steps size="small" current={step} status={a.status === 'CANCELLED' || a.status === 'NO_SHOW' ? 'error' : undefined} items={[
                  { title: 'Đã đặt', description: a.createdAt ? dayjs(a.createdAt).format('DD/MM HH:mm') : '' },
                  { title: 'Check-in', description: time(a.checkedInAt) },
                  { title: 'Vào khám', description: time(a.startedAt) },
                  { title: 'Hoàn tất', description: time(a.completedAt) },
                ]} />
                <Divider />
                <Descriptions size="small" bordered column={1} items={[
                  { label: 'Số thứ tự', children: a.queueCode ?? 'Chưa cấp' },
                  { label: 'Khung giờ', children: `${time(a.startAt)} – ${time(a.endAt)}, ${dayjs(a.startAt).format('DD/MM/YYYY')}` },
                  { label: 'Kênh đặt', children: channelText(a.channel) },
                  { label: 'Dịch vụ', children: a.service },
                  { label: 'Phòng khám', children: <><Tag color="blue">{a.roomCode}</Tag>{a.roomName}</> },
                  { label: 'Bác sĩ', children: a.doctorName },
                  { label: 'Chuyên khoa', children: a.specialty },
                  { label: 'Thanh toán', children: <Tag color={payMeta[pay].color}>{payMeta[pay].label}</Tag> },
                  { label: 'Tổng / Đã thu', children: `${money(amountTotalOf(a))} / ${money(a.invoice?.paid ?? 0)}` },
                  { label: 'Thời điểm tạo', children: dateTime(a.createdAt) },
                  { label: 'Cập nhật cuối', children: dateTime(a.updatedAt) },
                ]} />
              </>
            ),
          },
          { key: 'invoice', label: 'Hóa đơn & viện phí', children: <InvoiceSection appointment={a} busy={busy} onCollect={onCollect} onPrint={() => onPrint('hóa đơn')} /> },
        ]} />
      )}
    </Drawer>
  );
}

