import {
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  amountTotalOf,
  paymentStatusOf,
  type DeskAppointment,
  type PatientMap,
} from '../../../services/receptionDesk';
import {
  channelText,
  dateTime,
  money,
  payMeta,
  sourceMeta,
  statusMeta,
  time,
} from '../utils/appointmentMeta';

interface Props {
  data: DeskAppointment[];
  patients: PatientMap;
  loading?: boolean;
  descend?: boolean;
  hidePatientCols?: boolean;
  compact?: boolean;
  onOpen: (a: DeskAppointment) => void;
  onCheckIn?: (a: DeskAppointment) => void;
}

export function AppointmentTable({
  data,
  patients,
  loading,
  descend,
  hidePatientCols,
  compact,
  onOpen,
  onCheckIn: _onCheckIn,
}: Props) {
  const today = dayjs().format('YYYY-MM-DD');

  // Khung giờ hiển thị kèm Ngày khám ngay bên dưới
  const renderTimeAndDate = (_: unknown, a: DeskAppointment) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>
          {time(a.startAt)} – {time(a.endAt)}
        </span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {a.date ? dayjs(a.date).format('DD/MM/YYYY') : '—'}
        </span>
      </div>
    );
  };

  // 1. Chế độ COMPACT (bảng lịch hẹn trong thẻ bệnh nhân)
  const compactColumns: ColumnsType<DeskAppointment> = [
    {
      title: 'STT',
      dataIndex: 'queueCode',
      width: 65,
      align: 'center',
      render: (v?: string) =>
        v ? (
          <Tag color="blue" style={{ fontWeight: 700, fontSize: 12, margin: 0 }}>
            {v}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Mã lịch',
      dataIndex: 'code',
      width: 125,
      render: (v: string) => (
        <Typography.Text strong style={{ color: '#0B5CAD', fontSize: 13 }}>
          {v}
        </Typography.Text>
      ),
    },
    {
      title: 'Thời gian khám',
      width: 135,
      defaultSortOrder: descend ? 'descend' : 'ascend',
      sorter: (a, b) => dayjs(a.startAt).valueOf() - dayjs(b.startAt).valueOf(),
      render: renderTimeAndDate,
    },
    {
      title: 'Dịch vụ y tế',
      dataIndex: 'service',
      width: 220,
      render: (v: string) => (
        <div
          style={{
            lineHeight: 1.45,
            color: '#1f2937',
            fontWeight: 500,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
        >
          {v || '—'}
        </div>
      ),
    },
    {
      title: 'Phòng',
      dataIndex: 'roomCode',
      width: 75,
      align: 'center',
      render: (v: string) =>
        v ? (
          <Tag color="blue" style={{ margin: 0 }}>
            {v}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Bác sĩ & Chuyên khoa',
      width: 165,
      render: (_, a) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontWeight: 600, color: '#111827' }}>
            {a.doctorName || '—'}
          </span>
          {a.specialty && a.specialty !== '—' && (
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {a.specialty}
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (v: DeskAppointment['status']) => (
        <Tag
          color={statusMeta[v]?.color}
          style={{
            fontSize: 11,
            margin: 0,
            padding: '0 6px',
            lineHeight: '20px',
            borderRadius: 4,
          }}
        >
          {statusMeta[v]?.label ?? v}
        </Tag>
      ),
    },
    {
      title: 'Thanh toán',
      width: 110,
      render: (_, a) => {
        const s = paymentStatusOf(a);
        return (
          <Tag
            color={payMeta[s].color}
            style={{
              fontSize: 11,
              margin: 0,
              padding: '0 6px',
              lineHeight: '20px',
              borderRadius: 4,
            }}
          >
            {payMeta[s].label}
          </Tag>
        );
      },
    },
  ];

  // 2. Chế độ FULL (bảng danh sách lịch theo phòng - ĐÃ TINH GỌN, CHỈ GIỮ CÁC CỘT QUAN TRỌNG)
  const fullColumns: ColumnsType<DeskAppointment> = [
    {
      title: 'STT',
      dataIndex: 'queueCode',
      width: 70,
      align: 'center',
      render: (v?: string) =>
        v ? (
          <Tag color="blue" style={{ fontWeight: 700, fontSize: 12, margin: 0 }}>
            {v}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: 'Mã lịch',
      dataIndex: 'code',
      width: 130,
      render: (v: string, a: DeskAppointment) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Typography.Text strong style={{ color: '#0B5CAD', fontSize: 13, letterSpacing: '0.01em' }}>
            {v}
          </Typography.Text>
          <Tag
            color={sourceMeta[a.source]?.color}
            style={{
              width: 'fit-content',
              margin: 0,
              fontSize: 10,
              padding: '0 4px',
              lineHeight: '16px',
              borderRadius: 3,
            }}
          >
            {a.source === 'WALK_IN' ? 'Vãng lai' : 'Đặt trước'}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Thời gian khám',
      width: 135,
      defaultSortOrder: descend ? 'descend' : 'ascend',
      sorter: (a, b) => dayjs(a.startAt).valueOf() - dayjs(b.startAt).valueOf(),
      render: renderTimeAndDate,
    },
    ...(!hidePatientCols
      ? [
          {
            title: 'Bệnh nhân',
            width: 175,
            render: (_: unknown, a: DeskAppointment) => {
              const p = patients[a.patientId];
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>
                    {p?.fullName ?? a.patientId}
                  </span>
                  <span style={{ fontSize: 12, color: '#475569' }}>
                    {p?.phone ?? ''}
                  </span>
                </div>
              );
            },
          },
        ]
      : []),
    {
      title: 'Dịch vụ y tế',
      dataIndex: 'service',
      width: 240,
      render: (v: string) => (
        <div
          style={{
            lineHeight: 1.45,
            color: '#1f2937',
            fontWeight: 500,
            fontSize: 13,
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
        >
          {v || '—'}
        </div>
      ),
    },
    {
      title: 'Phòng & Bác sĩ',
      width: 185,
      render: (_, a) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {a.roomCode ? (
              <Tag
                color="blue"
                style={{
                  margin: 0,
                  fontWeight: 700,
                  fontSize: 11,
                  padding: '0 5px',
                  lineHeight: '18px',
                  borderRadius: 3,
                }}
              >
                {a.roomCode}
              </Tag>
            ) : null}
            <span style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>
              {a.doctorName || '—'}
            </span>
          </div>
          {a.specialty && a.specialty !== '—' && (
            <span style={{ fontSize: 12, color: '#64748B' }}>
              {a.specialty}
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 120,
      filters: Object.entries(statusMeta).map(([value, m]) => ({
        text: m.label,
        value,
      })),
      onFilter: (v, a) => a.status === v,
      render: (v: DeskAppointment['status']) => (
        <Tag
          color={statusMeta[v]?.color}
          style={{
            fontSize: 11,
            margin: 0,
            padding: '0 6px',
            lineHeight: '20px',
            borderRadius: 4,
            fontWeight: 500,
          }}
        >
          {statusMeta[v]?.label ?? v}
        </Tag>
      ),
    },
    {
      title: 'Thanh toán',
      width: 120,
      render: (_, a) => {
        const s = paymentStatusOf(a);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Tag
              color={payMeta[s].color}
              style={{
                width: 'fit-content',
                margin: 0,
                fontSize: 11,
                padding: '0 6px',
                lineHeight: '18px',
                borderRadius: 3,
                fontWeight: 500,
              }}
            >
              {payMeta[s].label}
            </Tag>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>
              {money(amountTotalOf(a))}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <Table<DeskAppointment>
      size="large"
      rowKey="id"
      loading={loading}
      columns={compact ? compactColumns : fullColumns}
      dataSource={data}
      sticky
      tableLayout="fixed"
      scroll={{ x: compact ? 900 : 1100 }}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (t) => `${t} lịch`,
      }}
      onRow={(a) => ({
        onClick: () => onOpen(a),
        style: {
          cursor: 'pointer',
          background: a.date === today && descend ? '#F3F9FF' : undefined,
        },
      })}
      locale={{ emptyText: 'Không có lịch nào' }}
    />
  );
}
