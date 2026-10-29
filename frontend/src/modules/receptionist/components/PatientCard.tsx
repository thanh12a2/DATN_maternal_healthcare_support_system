import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CreditCardOutlined,
  EditOutlined,
  EnvironmentOutlined,
  IdcardOutlined,
  MedicineBoxOutlined,
  PhoneOutlined,
  PrinterOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Segmented,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import type { Requester } from '../../../services/catalog';
import {
  amountTotalOf,
  paymentStatusOf,
  payAndCheckInAppointment,
  refreshAppointment,
  type DeskAppointment,
  type DeskCatalog,
  type DeskPatient,
  type PatientMap,
} from '../../../services/receptionDesk';
import {
  age,
  channelText,
  money,
  payMeta,
  sourceMeta,
  statusMeta,
  time,
} from '../utils/appointmentMeta';
import { EditPatientModal } from './EditPatientModal';
import { RescheduleModal } from './RescheduleModal';

interface Props {
  patient: DeskPatient;
  patients: PatientMap;
  appointments: DeskAppointment[];
  catalog?: DeskCatalog | null;
  request?: Requester;
  busy?: boolean;
  onOpen?: (a: DeskAppointment) => void;
  onCheckIn: (a: DeskAppointment) => void;
  onCancel?: (a: DeskAppointment) => void;
  onCollect?: (a: DeskAppointment) => void;
  onPrint?: (what: string) => void;
  onPatientUpdated?: (updated: DeskPatient) => void;
  onAppointmentUpdated?: (updated: DeskAppointment) => void;
}

export function PatientCard({
  patient: p,
  appointments,
  catalog,
  request: propRequest,
  busy,
  onCheckIn,
  onCancel,
  onCollect,
  onPrint,
  onPatientUpdated,
  onAppointmentUpdated,
}: Props) {
  const auth = useAuthSession();
  const request = propRequest || auth.request;

  const [currentPatient, setCurrentPatient] = useState<DeskPatient>(p);
  const [editPatientOpen, setEditPatientOpen] = useState(false);
  const [reschedulingApp, setReschedulingApp] = useState<DeskAppointment | null>(null);
  const [paymentModalApp, setPaymentModalApp] = useState<DeskAppointment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [payingAndCheckingIn, setPayingAndCheckingIn] = useState<boolean>(false);
  const [printTicketApp, setPrintTicketApp] = useState<DeskAppointment | null>(null);

  const handleConfirmPayAndCheckIn = async () => {
    if (!paymentModalApp) return;
    setPayingAndCheckingIn(true);
    try {
      const res = await payAndCheckInAppointment(
        request,
        paymentModalApp,
        paymentRef.trim() || undefined
      );
      if (res.success) {
        message.success('Đã thu viện phí và check-in tiếp đón thành công!');
        if (catalog) {
          const refreshed = await refreshAppointment(request, catalog, paymentModalApp);
          onAppointmentUpdated?.(refreshed);
          setPrintTicketApp(refreshed);
        }
        setPaymentModalApp(null);
      }
    } catch (err: any) {
      console.error('Lỗi thu tiền và check-in:', err);
      message.error(err?.message || 'Có lỗi xảy ra khi thu tiền và check-in.');
    } finally {
      setPayingAndCheckingIn(false);
    }
  };

  useEffect(() => {
    setCurrentPatient(p);
  }, [p]);

  const todayStr = dayjs().format('YYYY-MM-DD');

  // Bộ lọc thời gian: 'TODAY' | 'ALL' | 'CUSTOM' (Mặc định: 'TODAY')
  const [timeFilter, setTimeFilter] = useState<'TODAY' | 'ALL' | 'CUSTOM'>('TODAY');
  const [customDate, setCustomDate] = useState<Dayjs>(dayjs());

  const todayApps = useMemo(
    () => appointments.filter((a) => a.date === todayStr),
    [appointments, todayStr]
  );

  const filteredAppointments = useMemo(() => {
    if (timeFilter === 'TODAY') {
      return appointments.filter((a) => a.date === todayStr);
    }
    if (timeFilter === 'CUSTOM') {
      const selected = customDate.format('YYYY-MM-DD');
      return appointments.filter((a) => a.date === selected);
    }
    return appointments;
  }, [appointments, timeFilter, todayStr, customDate]);

  // Sắp xếp: Lịch hôm nay luôn ở trên đầu, sau đó sắp xếp theo thời gian mới nhất
  const sortedAppointments = useMemo(() => {
    return [...filteredAppointments].sort((a, b) => {
      const isTodayA = a.date === todayStr ? 1 : 0;
      const isTodayB = b.date === todayStr ? 1 : 0;
      if (isTodayA !== isTodayB) return isTodayB - isTodayA;
      return dayjs(b.startAt).valueOf() - dayjs(a.startAt).valueOf();
    });
  }, [filteredAppointments, todayStr]);

  const emergency = currentPatient.emergencyContacts?.[0];
  const emergencyDisplay = emergency
    ? `${emergency.fullName}${emergency.relationship ? ` (${emergency.relationship})` : ''}${
        emergency.phone ? ` - ${emergency.phone}` : ''
      }`
    : '—';

  const nationalIdDisplay = currentPatient.nationalId || currentPatient.nationalIdMasked || '—';

  return (
    <Card
      style={{
        borderRadius: 12,
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
        border: '1px solid #e5e7eb',
        background: '#ffffff',
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{currentPatient.fullName}</span>
          {todayApps.length > 0 ? (
            <Tag color="processing" style={{ fontWeight: 600, fontSize: 12, padding: '2px 8px' }}>
              {todayApps.length} lịch hôm nay
            </Tag>
          ) : (
            <Tag color="default">0 lịch hôm nay</Tag>
          )}
        </div>
      }
      extra={
        <Space size={8} wrap>
          <Segmented
            value={timeFilter}
            onChange={(val) => setTimeFilter(val as 'TODAY' | 'ALL' | 'CUSTOM')}
            options={[
              { label: `Hôm nay (${todayApps.length})`, value: 'TODAY' },
              { label: `Tất cả (${appointments.length})`, value: 'ALL' },
              { label: 'Chọn ngày', value: 'CUSTOM' },
            ]}
          />
          {timeFilter === 'CUSTOM' && (
            <DatePicker
              value={customDate}
              format="DD/MM/YYYY"
              allowClear={false}
              onChange={(d) => d && setCustomDate(d)}
              style={{ width: 140 }}
            />
          )}
        </Space>
      }
    >
      {/* KHỐI 1: HỒ SƠ HÀNH CHÍNH BỆNH NHÂN */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          Thông tin hành chính bệnh nhân
        </span>
        <Button
          icon={<EditOutlined />}
          size="small"
          onClick={() => setEditPatientOpen(true)}
          style={{
            borderRadius: 6,
            borderColor: '#0B5CAD',
            color: '#0B5CAD',
            fontWeight: 600,
            fontSize: 12,
          }}
        >
          Chỉnh sửa thông tin
        </Button>
      </div>

      <Descriptions
        size="small"
        column={{ xs: 1, sm: 2, md: 3, xl: 3 }}
        bordered
        style={{ marginBottom: 20, borderRadius: 8, overflow: 'hidden' }}
        items={[
          {
            label: (
              <span>
                <CalendarOutlined style={{ marginRight: 6, color: '#0B5CAD' }} />
                Ngày sinh
              </span>
            ),
            children: currentPatient.dateOfBirth
              ? `${dayjs(currentPatient.dateOfBirth).format('DD/MM/YYYY')} (${age(currentPatient.dateOfBirth)} tuổi)`
              : '—',
          },
          {
            label: (
              <span>
                <PhoneOutlined style={{ marginRight: 6, color: '#0B5CAD' }} />
                Số điện thoại
              </span>
            ),
            children: (
              <span style={{ color: '#0F172A', fontWeight: 400 }}>
                {currentPatient.phone || '—'}
              </span>
            ),
          },
          {
            label: (
              <span>
                <IdcardOutlined style={{ marginRight: 6, color: '#0B5CAD' }} />
                CCCD / Định danh
              </span>
            ),
            children: (
              <span style={{ color: '#0F172A', fontWeight: 400 }}>
                {nationalIdDisplay}
              </span>
            ),
          },
          {
            label: (
              <span>
                <EnvironmentOutlined style={{ marginRight: 6, color: '#0B5CAD' }} />
                Địa chỉ
              </span>
            ),
            children: currentPatient.address || '—',
          },
          {
            label: (
              <span>
                <UserOutlined style={{ marginRight: 6, color: '#0B5CAD' }} />
                Liên hệ khẩn cấp
              </span>
            ),
            children: emergencyDisplay,
            span: 2,
          },
        ]}
      />

      {/* KHỐI 2: DANH SÁCH LỊCH HẸN VÀ VIỆN PHÍ */}
      {sortedAppointments.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: '#6b7280', fontSize: 14 }}>
              {timeFilter === 'TODAY'
                ? 'Bệnh nhân không có lịch hẹn nào trong ngày hôm nay'
                : `Không có lịch hẹn trong ngày ${
                    timeFilter === 'CUSTOM' ? customDate.format('DD/MM/YYYY') : ''
                  }`}
            </span>
          }
          style={{ padding: '36px 0', background: '#f9fafb', borderRadius: 8 }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sortedAppointments.map((a, index) => {
            const isToday = a.date === todayStr;
            const isUpcoming = dayjs(a.date).isAfter(dayjs());
            const appStep = a.completedAt ? 3 : a.startedAt ? 2 : a.checkedInAt ? 1 : 0;
            const payStatus = paymentStatusOf(a);

            return (
              <div
                key={a.id}
                style={{
                  background: '#ffffff',
                  border: isToday ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: isToday
                    ? '0 4px 14px rgba(11, 92, 173, 0.07)'
                    : '0 1px 3px rgba(0, 0, 0, 0.02)',
                }}
              >
                {/* Header dải lịch hẹn */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    paddingBottom: 12,
                    marginBottom: 16,
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: '#0B5CAD' }}>
                      {a.code}
                    </span>

                    {isToday ? (
                      <Tag
                        color="processing"
                        style={{
                          fontWeight: 600,
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 4,
                          margin: 0,
                        }}
                      >
                        Lịch khám hôm nay
                      </Tag>
                    ) : isUpcoming ? (
                      <Tag
                        color="purple"
                        style={{
                          fontWeight: 600,
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 4,
                          margin: 0,
                        }}
                      >
                        Lịch hẹn sắp tới
                      </Tag>
                    ) : (
                      <Tag
                        color="default"
                        style={{
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 4,
                          margin: 0,
                        }}
                      >
                        Lịch khám trước đó
                      </Tag>
                    )}

                    {a.queueCode && (
                      <Tag
                        color="blue"
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 4,
                          margin: 0,
                        }}
                      >
                        STT: {a.queueCode}
                      </Tag>
                    )}
                  </div>

                  <Space size={8} wrap>
                    <Tag
                      color={statusMeta[a.status]?.color}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '2px 8px',
                        margin: 0,
                      }}
                    >
                      {statusMeta[a.status]?.label ?? a.status}
                    </Tag>
                    <Tag color={sourceMeta[a.source].color} style={{ margin: 0 }}>
                      {sourceMeta[a.source].label}
                    </Tag>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      ({channelText(a.channel)})
                    </span>
                  </Space>
                </div>

                {/* Bố cục 2 cột: Cột trái (Thông tin khám) & Cột phải (Hóa đơn) */}
                <Row gutter={[16, 16]}>
                  {/* CỘT TRÁI: CHI TIẾT LỊCH HẸN & TIẾN TRÌNH */}
                  <Col xs={24} lg={13}>
                    <div
                      style={{
                        height: '100%',
                        background: '#ffffff',
                        border: '1px solid #f1f5f9',
                        borderRadius: 8,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        {/* Tiến trình khám */}
                        <div
                          style={{
                            background: '#f8fafc',
                            padding: '10px 14px',
                            borderRadius: 6,
                            marginBottom: 14,
                          }}
                        >
                          <Steps
                            size="small"
                            current={appStep}
                            status={
                              a.status === 'CANCELLED' || a.status === 'NO_SHOW'
                                ? 'error'
                                : undefined
                            }
                            items={[
                              {
                                title: 'Đã đặt',
                                description: a.createdAt
                                  ? dayjs(a.createdAt).format('HH:mm DD/MM')
                                  : '',
                              },
                              {
                                title: 'Check-in',
                                description: time(a.checkedInAt),
                              },
                              {
                                title: 'Vào khám',
                                description: time(a.startedAt),
                              },
                              {
                                title: 'Hoàn tất',
                                description: time(a.completedAt),
                              },
                            ]}
                          />
                        </div>

                        {/* Chi tiết nội dung khám */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 12,
                            marginBottom: 14,
                          }}
                        >
                          <div
                            style={{
                              gridColumn: '1 / -1',
                              background: '#f0f7ff',
                              padding: '10px 12px',
                              borderRadius: 6,
                              borderLeft: '4px solid #0B5CAD',
                            }}
                          >
                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                              DỊCH VỤ ĐĂNG KÝ KHÁM
                            </div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: '#0f172a',
                                marginTop: 2,
                              }}
                            >
                              {a.service}
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: 12, color: '#64748b' }}>Thời gian khám:</span>
                            <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                              <CalendarOutlined style={{ color: '#0B5CAD', marginRight: 4 }} />
                              {time(a.startAt)} – {time(a.endAt)} (
                              {a.date ? dayjs(a.date).format('DD/MM/YYYY') : '—'})
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              Phòng khám tiếp nhận:
                            </span>
                            <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                              <Tag color="blue" style={{ fontWeight: 700, margin: 0, marginRight: 6 }}>
                                {a.roomCode}
                              </Tag>
                              {a.roomName || 'Phòng khám Sản Phụ khoa'}
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: 12, color: '#64748b' }}>Bác sĩ đảm nhiệm:</span>
                            <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                              <MedicineBoxOutlined style={{ color: '#0B5CAD', marginRight: 4 }} />
                              {a.doctorName || '—'}
                            </div>
                          </div>

                          <div>
                            <span style={{ fontSize: 12, color: '#64748b' }}>Chuyên khoa:</span>
                            <div style={{ fontWeight: 600, color: '#1e293b', marginTop: 2 }}>
                              {a.specialty || 'Sản Phụ khoa'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Nút hành động của lịch hẹn (Đã bỏ nút Chi tiết đầy đủ) */}
                      <div>
                        <Divider style={{ margin: '10px 0' }} />
                        <Space size={8} wrap>
                          {a.status === 'BOOKED' && (
                            <Button
                              type="primary"
                              size="middle"
                              icon={<CheckCircleOutlined />}
                              loading={busy || payingAndCheckingIn}
                              onClick={() => {
                                const isPaid = paymentStatusOf(a) === 'PAID';
                                if (!isPaid) {
                                  setPaymentModalApp(a);
                                  setPaymentMethod('CASH');
                                  setPaymentRef('');
                                } else {
                                  onCheckIn(a);
                                }
                              }}
                              style={{
                                backgroundColor: '#0B5CAD',
                                fontWeight: 600,
                                borderRadius: 6,
                              }}
                            >
                              Check-in tiếp đón
                            </Button>
                          )}

                          {a.status === 'BOOKED' && (
                            <Button
                              icon={<CalendarOutlined />}
                              onClick={() => setReschedulingApp(a)}
                              style={{
                                borderRadius: 6,
                                borderColor: '#0B5CAD',
                                color: '#0B5CAD',
                                fontWeight: 500,
                              }}
                            >
                              Dời lịch / Đổi bác sĩ
                            </Button>
                          )}

                          {a.queueCode && (
                            <Button
                              icon={<PrinterOutlined />}
                              onClick={() => onPrint?.('phiếu số thứ tự')}
                              style={{ borderRadius: 6 }}
                            >
                              In phiếu STT ({a.queueCode})
                            </Button>
                          )}

                          {a.status === 'BOOKED' && (
                            <Popconfirm
                              title="Xác nhận hủy lịch hẹn này?"
                              description="Lịch hẹn sẽ bị hủy bỏ trên toàn hệ thống."
                              okText="Hủy lịch"
                              okButtonProps={{ danger: true }}
                              cancelText="Không"
                              onConfirm={() => onCancel?.(a)}
                            >
                              <Button danger icon={<CloseCircleOutlined />} style={{ borderRadius: 6 }}>
                                Hủy lịch
                              </Button>
                            </Popconfirm>
                          )}
                        </Space>
                      </div>
                    </div>
                  </Col>

                  {/* CỘT PHẢI: HÓA ĐƠN & VIỆN PHÍ */}
                  <Col xs={24} lg={11}>
                    <div
                      style={{
                        height: '100%',
                        background: '#fcfdfd',
                        border: '1px solid #f1f5f9',
                        borderRadius: 8,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        {/* Header Hóa đơn */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginBottom: 10,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                              Hóa đơn & Viện phí
                            </span>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                              ({a.invoice?.number || (a.code ? `INV-${a.code}` : 'Dự thảo viện phí')})
                            </span>
                          </div>
                          <Tag
                            color={payMeta[payStatus].color}
                            style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px' }}
                          >
                            {payMeta[payStatus].label}
                          </Tag>
                        </div>

                        {/* Nội dung danh sách khoản thu (Luôn hiển thị bảng chi tiết đầy đủ, không dùng hộp cảnh báo màu vàng) */}
                        {(() => {
                          const lines =
                            a.invoice?.lines && a.invoice.lines.length > 0
                              ? a.invoice.lines
                              : [
                                  {
                                    name: a.service || 'Khám chuyên khoa',
                                    qty: 1,
                                    unitPrice: a.estimatedTotal || 0,
                                    amount: a.estimatedTotal || 0,
                                  },
                                ];
                          const total = a.invoice?.total ?? a.estimatedTotal ?? 0;
                          const paid = a.invoice?.paid ?? (payStatus === 'PAID' ? total : 0);
                          const balance = a.invoice?.balance ?? (total - paid);
                          const payments = a.invoice?.payments || [];

                          return (
                            <>
                              <Table
                                size="small"
                                pagination={false}
                                dataSource={lines}
                                rowKey={(l, idx) => `${l.name}-${idx}`}
                                columns={[
                                  {
                                    title: 'Khoản thu / Dịch vụ',
                                    dataIndex: 'name',
                                    render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
                                  },
                                  {
                                    title: 'SL',
                                    dataIndex: 'qty',
                                    width: 45,
                                    align: 'center',
                                  },
                                  {
                                    title: 'Đơn giá',
                                    dataIndex: 'unitPrice',
                                    align: 'right',
                                    width: 90,
                                    render: (v: number) => money(v),
                                  },
                                  {
                                    title: 'Thành tiền',
                                    dataIndex: 'amount',
                                    align: 'right',
                                    width: 95,
                                    render: (v: number) => (
                                      <b style={{ color: '#0f172a' }}>{money(v)}</b>
                                    ),
                                  },
                                ]}
                              />

                              {/* Tổng kết tài chính */}
                              <div
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 6,
                                  padding: '8px 12px',
                                  marginTop: 10,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: 3,
                                  }}
                                >
                                  <span style={{ color: '#64748b', fontSize: 12 }}>Tổng viện phí:</span>
                                  <span style={{ fontWeight: 600, color: '#0f172a', fontSize: 12 }}>
                                    {money(total)}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: 3,
                                  }}
                                >
                                  <span style={{ color: '#64748b', fontSize: 12 }}>Đã thanh toán:</span>
                                  <span style={{ fontWeight: 600, color: '#16a34a', fontSize: 12 }}>
                                    {money(paid)}
                                  </span>
                                </div>

                                <Divider style={{ margin: '5px 0' }} />

                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 12 }}>
                                    Còn lại cần thu:
                                  </span>
                                  <span
                                    style={{
                                      fontWeight: 800,
                                      fontSize: 15,
                                      color: balance > 0 ? '#dc2626' : '#16a34a',
                                    }}
                                  >
                                    {money(balance)}
                                  </span>
                                </div>
                              </div>

                              {/* Lịch sử giao dịch */}
                              {payments.length > 0 && (
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: 11,
                                    color: '#64748b',
                                    background: '#f1f5f9',
                                    padding: '5px 8px',
                                    borderRadius: 4,
                                  }}
                                >
                                  <b>Lịch sử: </b>
                                  {payments.map((pm, idx) => (
                                    <span key={idx} style={{ marginRight: 6 }}>
                                      • {pm.method} ({money(pm.amount)}){' '}
                                      {pm.at ? dayjs(pm.at).format('HH:mm DD/MM') : ''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {/* Nút hành động hóa đơn */}
                      <div>
                        <Divider style={{ margin: '10px 0' }} />
                        <Space size={8} wrap>
                          {a.status === 'BOOKED' && (a.invoice ? a.invoice.balance > 0 : true) && (
                            <Button
                              type="primary"
                              icon={<CreditCardOutlined />}
                              loading={busy || payingAndCheckingIn}
                              onClick={() => {
                                setPaymentModalApp(a);
                                setPaymentMethod('CASH');
                                setPaymentRef('');
                              }}
                              style={{
                                backgroundColor: '#16a34a',
                                borderColor: '#16a34a',
                                fontWeight: 700,
                                fontSize: 13,
                                borderRadius: 6,
                                padding: '0 16px',
                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
                              }}
                            >
                              💵 Thu tiền & Check-in ngay ({money(a.invoice ? a.invoice.balance : a.estimatedTotal)})
                            </Button>
                          )}

                          {a.status === 'CHECKED_IN' && (
                            <Button
                              type="primary"
                              icon={<PrinterOutlined />}
                              onClick={() => setPrintTicketApp(a)}
                              style={{
                                backgroundColor: '#0B5CAD',
                                borderColor: '#0B5CAD',
                                borderRadius: 6,
                                fontWeight: 600,
                              }}
                            >
                              In phiếu khám & Biên lai (STT: {a.queueCode || 'Đã cấp'})
                            </Button>
                          )}

                          <Button
                            icon={<PrinterOutlined />}
                            onClick={() => {
                              if (a.status === 'CHECKED_IN' || a.queueCode) {
                                setPrintTicketApp(a);
                              } else {
                                onPrint?.('hóa đơn');
                              }
                            }}
                            style={{ borderRadius: 6 }}
                          >
                            In hóa đơn / Phiếu thu
                          </Button>
                        </Space>
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>
            );
          })}
        </div>
      )}

      {editPatientOpen && request && (
        <EditPatientModal
          open={editPatientOpen}
          patient={currentPatient}
          request={request}
          onClose={() => setEditPatientOpen(false)}
          onSuccess={(updated) => {
            setCurrentPatient(updated);
            onPatientUpdated?.(updated);
          }}
        />
      )}

      {reschedulingApp && request && (
        <RescheduleModal
          open={Boolean(reschedulingApp)}
          appointment={reschedulingApp}
          catalog={catalog ?? null}
          request={request}
          onClose={() => setReschedulingApp(null)}
          onSuccess={(updated) => {
            onAppointmentUpdated?.(updated);
            setReschedulingApp(null);
          }}
        />
      )}

      {/* MODAL 1 CHẠM: THU TIỀN VIỆN PHÍ & CHECK-IN TIẾP ĐÓN */}
      {paymentModalApp && (
        <Modal
          open={Boolean(paymentModalApp)}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CreditCardOutlined style={{ color: '#16A34A', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                  Thu tiền viện phí & Check-in tiếp đón
                </div>
                <div style={{ fontSize: 12, color: '#64748B', fontWeight: 400, marginTop: 2 }}>
                  Ghi nhận thanh toán và tự động cấp số thứ tự vào phòng khám
                </div>
              </div>
            </div>
          }
          onCancel={() => !payingAndCheckingIn && setPaymentModalApp(null)}
          footer={[
            <Button
              key="cancel"
              disabled={payingAndCheckingIn}
              onClick={() => setPaymentModalApp(null)}
              style={{ borderRadius: 6 }}
            >
              Hủy
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={payingAndCheckingIn}
              icon={<CheckCircleOutlined />}
              onClick={handleConfirmPayAndCheckIn}
              style={{
                backgroundColor: '#16A34A',
                borderColor: '#16A34A',
                fontWeight: 600,
                borderRadius: 6,
                padding: '0 18px',
              }}
            >
              Xác nhận Thu tiền & Cấp số thứ tự
            </Button>,
          ]}
          width={540}
          centered
        >
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 16,
                fontSize: 13,
                lineHeight: 1.8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Bệnh nhân:</span>
                <strong style={{ color: '#0F172A' }}>{currentPatient.fullName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Số điện thoại:</span>
                <span>{currentPatient.phone || 'Chưa có SĐT'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Dịch vụ khám:</span>
                <strong style={{ color: '#0B5CAD' }}>{paymentModalApp.service}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Phòng khám & Bác sĩ:</span>
                <span>
                  Phòng {paymentModalApp.roomCode} — {paymentModalApp.doctorName}
                </span>
              </div>
            </div>

            <div
              style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: 8,
                padding: '14px 16px',
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                Số tiền cần thu tại quầy
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#15803D', marginTop: 2 }}>
                {money(
                  paymentModalApp.invoice && paymentModalApp.invoice.balance > 0
                    ? paymentModalApp.invoice.balance
                    : paymentModalApp.estimatedTotal
                )}
              </div>
              <Tag color="success" style={{ marginTop: 4, fontWeight: 600 }}>
                Thu đúng đủ viện phí dịch vụ
              </Tag>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 8 }}>
                Hình thức thanh toán tại quầy:
              </div>
              <Radio.Group
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Radio value="CASH">
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>💵 Tiền mặt (Cash)</span>
                    <span style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}>
                      Thu tiền mặt trực tiếp tại quầy tiếp đón
                    </span>
                  </Radio>
                  <Radio value="TRANSFER">
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>📲 Quét mã VietQR tại quầy</span>
                    <span style={{ fontSize: 12, color: '#64748B', marginLeft: 8 }}>
                      Bệnh nhân quét mã QR ngân hàng tại quầy
                    </span>
                  </Radio>
                </Space>
              </Radio.Group>
            </div>

            {paymentMethod === 'TRANSFER' && (
              <div style={{ marginTop: 8 }}>
                <Input
                  placeholder="Nhập mã giao dịch / ngân hàng (không bắt buộc)"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  style={{ borderRadius: 6 }}
                />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL: PHIẾU KHÁM & BIÊN LAI THU TIỀN CÓ SỐ THỨ TỰ */}
      {printTicketApp && (
        <Modal
          open={Boolean(printTicketApp)}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PrinterOutlined style={{ color: '#0B5CAD', fontSize: 18 }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                Phiếu tiếp đón khám bệnh & Biên lai thu tiền
              </span>
            </div>
          }
          onCancel={() => setPrintTicketApp(null)}
          footer={[
            <Button key="close" onClick={() => setPrintTicketApp(null)} style={{ borderRadius: 6 }}>
              Đóng
            </Button>,
            <Button
              key="print"
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => window.print()}
              style={{ backgroundColor: '#0B5CAD', borderRadius: 6, fontWeight: 600 }}
            >
              In phiếu ngay
            </Button>,
          ]}
          width={480}
          centered
        >
          <div
            id="printable-ticket"
            style={{
              padding: '16px 18px',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              marginTop: 10,
            }}
          >
            <div
              style={{
                textAlign: 'center',
                borderBottom: '1px dashed #CBD5E1',
                paddingBottom: 10,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0B5CAD', textTransform: 'uppercase' }}>
                Bệnh viện Phụ sản & Sức khỏe Bà mẹ
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                PHIẾU TIẾP ĐÓN KHÁM BỆNH & BIÊN LAI THU VIỆN PHÍ
              </div>
            </div>

            <div
              style={{
                textAlign: 'center',
                background: '#EFF6FF',
                borderRadius: 8,
                padding: '12px 8px',
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, textTransform: 'uppercase' }}>
                SỐ THỨ TỰ KHÁM (STT)
              </div>
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 900,
                  color: '#0B5CAD',
                  letterSpacing: '1px',
                  margin: '2px 0',
                }}
              >
                {printTicketApp.queueCode || 'VIT-001'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
                Phòng khám: {printTicketApp.roomCode} — {printTicketApp.roomName || 'Phòng khám Sản Phụ khoa'}
              </div>
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.8, color: '#334155' }}>
              <div>
                <strong>Bệnh nhân:</strong> {currentPatient.fullName}
              </div>
              <div>
                <strong>Số điện thoại:</strong> {currentPatient.phone || '—'}
              </div>
              <div>
                <strong>Bác sĩ phụ trách:</strong> {printTicketApp.doctorName}
              </div>
              <div>
                <strong>Dịch vụ y tế:</strong> {printTicketApp.service}
              </div>
              <div>
                <strong>Thời gian khám:</strong> {time(printTicketApp.startAt)} – {time(printTicketApp.endAt)} (
                {printTicketApp.date ? dayjs(printTicketApp.date).format('DD/MM/YYYY') : 'Hôm nay'})
              </div>
              <div>
                <strong>Viện phí đã thu:</strong>{' '}
                <span style={{ fontWeight: 700, color: '#16A34A' }}>
                  {money(printTicketApp.invoice?.total || printTicketApp.estimatedTotal)}
                </span>{' '}
                (Đã thu đủ)
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: '1px dashed #CBD5E1',
                textAlign: 'center',
                fontSize: 11,
                color: '#64748B',
                fontStyle: 'italic',
              }}
            >
              Quý khách vui lòng ngồi chờ trước cửa phòng {printTicketApp.roomCode}, theo dõi màn hình hiển thị để được gọi số thứ tự vào khám.
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
