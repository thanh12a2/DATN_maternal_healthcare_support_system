import { QrcodeOutlined } from '@ant-design/icons';
import { Button, Divider, Space, Table, Tag, Typography } from 'antd';
import type {
  DeskAppointment,
  DeskInvoice,
} from '../../../services/receptionDesk';
import { dateTime, money, payMeta } from '../utils/appointmentMeta';

interface Props {
  appointment: DeskAppointment;
  busy?: boolean;
  onCollect: (appointment: DeskAppointment, invoice: DeskInvoice) => void;
  onPayVnpay: (appointment: DeskAppointment, invoice: DeskInvoice) => void;
  onPrint: () => void;
}

export function InvoiceSection({
  appointment,
  busy,
  onCollect,
  onPayVnpay,
  onPrint,
}: Props) {
  const invoices = appointment.invoices?.length
    ? appointment.invoices
    : appointment.invoice
      ? [appointment.invoice]
      : [];

  if (!invoices.length) {
    return (
      <Typography.Text type="secondary">
        Lịch hẹn này chưa có hóa đơn. Tạm tính:{' '}
        {money(appointment.estimatedTotal)}
      </Typography.Text>
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {invoices.map((invoice) => {
        const paymentState =
          invoice.balance <= 0
            ? 'PAID'
            : invoice.paid > 0
              ? 'PARTIAL'
              : 'UNPAID';
        return (
          <div
            key={invoice.id}
            style={{
              border: '1px solid #e8edf2',
              borderRadius: 10,
              padding: 14,
            }}
          >
            <Space style={{ marginBottom: 12 }} wrap>
              <Typography.Text strong>
                {invoice.type === 'SUPPLEMENTARY'
                  ? 'Hóa đơn phát sinh'
                  : 'Hóa đơn ban đầu'}{' '}
                {invoice.number}
              </Typography.Text>
              <Tag color={payMeta[paymentState].color}>
                {payMeta[paymentState].label}
              </Tag>
            </Space>
            <Table
              size="small"
              rowKey={(line) => line.name + line.amount}
              pagination={false}
              dataSource={invoice.lines}
              columns={[
                { title: 'Dịch vụ', dataIndex: 'name' },
                { title: 'SL', dataIndex: 'qty', width: 50, align: 'center' },
                {
                  title: 'Đơn giá',
                  dataIndex: 'unitPrice',
                  align: 'right',
                  render: (value: number) => money(value),
                },
                {
                  title: 'Thành tiền',
                  dataIndex: 'amount',
                  align: 'right',
                  render: (value: number) => money(value),
                },
              ]}
            />
            <div style={{ maxWidth: 340, marginLeft: 'auto', marginTop: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  fontWeight: 700,
                }}
              >
                <span>Tổng tiền</span>
                <span>{money(invoice.total)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                }}
              >
                <span>Đã thanh toán</span>
                <span>{money(invoice.paid)}</span>
              </div>
              <Divider style={{ margin: '6px 0' }} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  fontWeight: 700,
                }}
              >
                <span>Còn lại</span>
                <span>{money(invoice.balance)}</span>
              </div>
            </div>
            <Divider titlePlacement="start" plain>
              Lịch sử thanh toán
            </Divider>
            <Table
              size="small"
              rowKey={(payment) => `${payment.at}${payment.amount}`}
              pagination={false}
              dataSource={invoice.payments}
              locale={{ emptyText: 'Chưa có giao dịch' }}
              columns={[
                {
                  title: 'Thời điểm',
                  dataIndex: 'at',
                  render: (value?: string) => dateTime(value),
                },
                { title: 'Hình thức', dataIndex: 'method' },
                {
                  title: 'Số tiền',
                  dataIndex: 'amount',
                  align: 'right',
                  render: (value: number) => money(value),
                },
              ]}
            />
            <Space style={{ marginTop: 16 }} wrap>
              <Button
                type="primary"
                loading={busy}
                disabled={
                  invoice.balance <= 0 || appointment.status === 'CANCELLED'
                }
                onClick={() => onCollect(appointment, invoice)}
              >
                Thu tiền mặt {invoice.balance > 0 ? money(invoice.balance) : ''}
              </Button>
              <Button
                icon={<QrcodeOutlined />}
                loading={busy}
                disabled={
                  invoice.balance <= 0 || appointment.status === 'CANCELLED'
                }
                onClick={() => onPayVnpay(appointment, invoice)}
              >
                Thanh toán VNPay / QR{' '}
                {invoice.balance > 0 ? money(invoice.balance) : ''}
              </Button>
              <Button onClick={onPrint}>In hóa đơn</Button>
            </Space>
          </div>
        );
      })}
    </Space>
  );
}
