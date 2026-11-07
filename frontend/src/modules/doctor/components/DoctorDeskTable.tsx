import { useState } from 'react';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  MedicineBoxOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Empty, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Appointment } from '../../../services/appointment';

const { Text } = Typography;

export interface DoctorDeskRow extends Appointment {
  ticketCode?: string;
  patientName?: string;
  patientPhone?: string;
}

export interface DoctorDeskTableProps {
  rows: DoctorDeskRow[];
  loading?: boolean;
  onOpenClinical: (appointment: DoctorDeskRow) => void;
}

export function DoctorDeskTable({
  rows,
  loading,
  onOpenClinical,
}: DoctorDeskTableProps) {
  const formatTime = (start?: string, end?: string) => {
    if (!start) return '—';
    try {
      const s = new Date(start).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const e = end
        ? new Date(end).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      return e ? `${s} - ${e}` : s;
    } catch {
      return start;
    }
  };

  const columns: ColumnsType<DoctorDeskRow> = [
    {
      title: 'STT',
      dataIndex: 'ticketCode',
      key: 'ticketCode',
      width: 110,
      render: (val, record) => {
        const isServing = record.status === 'IN_CLINICAL_CARE';
        return (
          <span className={`queue-stt-badge ${isServing ? 'is-serving' : ''}`}>
            {val || '—'}
          </span>
        );
      },
    },
    {
      title: 'Mã lịch hẹn',
      dataIndex: 'appointmentCode',
      key: 'appointmentCode',
      width: 170,
      render: (code, record) => (
        <a
          onClick={() => onOpenClinical(record)}
          style={{ fontWeight: 700, color: '#0B5CAD', cursor: 'pointer' }}
        >
          {code}
        </a>
      ),
    },
    {
      title: 'Thời gian khám',
      key: 'time',
      width: 140,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>
            {formatTime(record.startAt, record.endAt)}
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.startAt
              ? new Date(record.startAt).toLocaleDateString('vi-VN')
              : ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Bệnh nhân',
      key: 'patient',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#e0f2fe',
              color: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            <UserOutlined />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
              {record.patientName || 'Nguyễn Minh Anh'}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.patientPhone || '0901000001'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Dịch vụ y tế',
      key: 'service',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>
            {record.pricing?.serviceName || 'Khám thai định kỳ chuẩn y khoa'}
          </div>
          <Tag color="cyan" style={{ fontSize: 11, marginTop: 2 }}>
            {record.roomName ||
              record.roomCode ||
              'Phòng khám Sản Phụ khoa 201'}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      render: (status) => {
        if (status === 'IN_CLINICAL_CARE') {
          return (
            <Tag color="green" style={{ fontWeight: 700, padding: '3px 8px' }}>
              🩺 Đang khám bệnh
            </Tag>
          );
        }
        if (status === 'CHECKED_IN') {
          return (
            <Tag color="blue" style={{ fontWeight: 600, padding: '3px 8px' }}>
              ⏳ Đã check-in / Chờ gọi
            </Tag>
          );
        }
        if (status === 'COMPLETED') {
          return (
            <Tag color="default" style={{ padding: '3px 8px' }}>
              ✓ Đã hoàn tất
            </Tag>
          );
        }
        return <Tag>{status}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 160,
      render: (_, record) => {
        const isInCare = record.status === 'IN_CLINICAL_CARE';
        return (
          <Button
            type={isInCare ? 'primary' : 'default'}
            icon={<MedicineBoxOutlined />}
            style={
              isInCare
                ? {
                    background: '#0B5CAD',
                    borderColor: '#0B5CAD',
                    fontWeight: 600,
                  }
                : { color: '#0B5CAD', borderColor: '#bfdbfe', fontWeight: 600 }
            }
            onClick={() => onOpenClinical(record)}
          >
            {isInCare ? 'Tiếp tục khám' : 'Vào khám'}
          </Button>
        );
      },
    },
  ];

  return (
    <Table<DoctorDeskRow>
      rowKey="id"
      columns={columns}
      dataSource={rows}
      loading={loading}
      pagination={{ pageSize: 10, showSizeChanger: false }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không có bệnh nhân nào trong hàng đợi của bộ lọc hiện tại"
          />
        ),
      }}
    />
  );
}
