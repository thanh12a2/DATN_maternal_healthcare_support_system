import { Button, Divider, Space, Table, Tag, Typography } from 'antd';
import type { DeskAppointment } from '../../../services/receptionDesk';
import { paymentStatusOf } from '../../../services/receptionDesk';
import { dateTime, money, payMeta } from '../utils/appointmentMeta';

interface Props { appointment: DeskAppointment; busy?: boolean; onCollect: (a: DeskAppointment) => void; onPrint: () => void }

export function InvoiceSection({ appointment: a, busy, onCollect, onPrint }: Props) {
  const inv = a.invoice;
  if (!inv) return <Typography.Text type="secondary">Lịch hẹn này chưa có hóa đơn. Tạm tính: {money(a.estimatedTotal)}</Typography.Text>;
  const st = paymentStatusOf(a);
  const row = (label: string, value: string, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: strong ? 700 : 400 }}><span>{label}</span><span>{value}</span></div>
  );
  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap><Typography.Text strong>Hóa đơn {inv.number}</Typography.Text><Tag color={payMeta[st].color}>{payMeta[st].label}</Tag></Space>
      <Table size="small" rowKey={(l) => l.name + l.amount} pagination={false} dataSource={inv.lines} columns={[
        { title: 'Dịch vụ', dataIndex: 'name' },
        { title: 'SL', dataIndex: 'qty', width: 50, align: 'center' },
        { title: 'Đơn giá', dataIndex: 'unitPrice', align: 'right', render: (v: number) => money(v) },
        { title: 'Thành tiền', dataIndex: 'amount', align: 'right', render: (v: number) => money(v) },
      ]} />
      <div style={{ maxWidth: 340, marginLeft: 'auto', marginTop: 12 }}>
        {row('Tổng tiền', money(inv.total), true)}
        {row('Đã thanh toán', money(inv.paid))}
        <Divider style={{ margin: '6px 0' }} />
        {row('Còn lại', money(inv.balance), true)}
      </div>
      <Divider titlePlacement="start" plain>Lịch sử thanh toán</Divider>
      <Table size="small" rowKey={(p) => `${p.at}${p.amount}`} pagination={false} dataSource={inv.payments} locale={{ emptyText: 'Chưa có giao dịch' }} columns={[
        { title: 'Thời điểm', dataIndex: 'at', render: (v?: string) => dateTime(v) },
        { title: 'Hình thức', dataIndex: 'method' },
        { title: 'Số tiền', dataIndex: 'amount', align: 'right', render: (v: number) => money(v) },
      ]} />
      <Space style={{ marginTop: 16 }}>
        <Button type="primary" loading={busy} disabled={inv.balance <= 0 || a.status === 'CANCELLED'} onClick={() => onCollect(a)}>Thu tiền mặt {inv.balance > 0 ? money(inv.balance) : ''}</Button>
        <Button onClick={onPrint}>In hóa đơn</Button>
      </Space>
    </div>
  );
}

