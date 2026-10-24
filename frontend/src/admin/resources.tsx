import type { ReactNode } from 'react';
import type { ColumnsType } from 'antd/es/table';
import type { Requester } from '../services/catalog';
import { StatusTag } from './components/StatusTag';
import type { Row } from './components/DataTable';
import { extractList, formatDateTime, formatMoneyMinor, humanizeKey, text } from './format';

export interface ResourceConfig {
  title: string;
  description: string;
  load: (request: Requester) => Promise<Row[]>;
  columns?: ColumnsType<Row>;
  detailTitle?: (row: Row) => ReactNode;
}

const getList = (path: string) => async (request: Requester) => extractList<Row>(await request<unknown>(path));
const code = (value: unknown) => <span className="admin-code">{text(value)}</span>;
const status = (value: unknown) => <StatusTag status={value} />;
const when = (value: unknown) => formatDateTime(value);

/** Tự dựng cột từ các trường nguyên thủy khi backend chưa có contract cố định. */
export function autoColumns(rows: Row[]): ColumnsType<Row> {
  const sample = rows[0] ?? {};
  const keys = Object.keys(sample).filter((key) => ['string', 'number', 'boolean'].includes(typeof sample[key])).slice(0, 7);
  return keys.map((key) => ({
    title: humanizeKey(key),
    dataIndex: key,
    key,
    render: (value: unknown) => (/status|state/i.test(key) ? status(value) : /(At|Date)$/.test(key) ? when(value) : /id$/i.test(key) ? code(value) : text(value)),
  }));
}

export const RESOURCES: Record<string, ResourceConfig> = {
  appointments: {
    title: 'Quản lý lịch hẹn',
    description: 'Toàn bộ lịch hẹn khám bệnh và điều phối bác sĩ trong hệ thống.',
    load: getList('/api/appointment/appointments?limit=100'),
    detailTitle: (row) => `Lịch hẹn ${text(row.appointmentCode ?? row.id)}`,
    columns: [
      { title: 'Mã lịch hẹn', dataIndex: 'appointmentCode', render: code },
      { title: 'Bắt đầu', dataIndex: 'startAt', render: when },
      { title: 'Kết thúc', dataIndex: 'endAt', render: when },
      { title: 'Trạng thái', dataIndex: 'status', render: status },
      { title: 'Bác sĩ', dataIndex: 'assignedDoctorId', render: code },
      { title: 'Hạng bác sĩ', dataIndex: 'assignedRankCode', render: text },
      { title: 'Tạm tính', dataIndex: 'pricing', render: (pricing: { estimatedTotalMinor?: number; currency?: string } | undefined) => formatMoneyMinor(pricing?.estimatedTotalMinor, pricing?.currency) },
    ],
  },
  queue: {
    title: 'Quản lý hàng đợi',
    description: 'Các công đoạn khám đang hoạt động và điều phối tiến trình tiếp nhận.',
    load: getList('/api/queue/stages'),
    detailTitle: (row) => `Công đoạn ${text(row.name ?? row.code ?? row.id)}`,
  },
  billing: {
    title: 'Quản lý hóa đơn',
    description: 'Hóa đơn viện phí và tình trạng thanh toán của bệnh nhân.',
    load: getList('/api/billing/invoices?limit=100'),
    detailTitle: (row) => `Hóa đơn ${text(row.invoiceNumber ?? row.id)}`,
    columns: [
      { title: 'Số hóa đơn', dataIndex: 'invoiceNumber', render: code },
      { title: 'Loại', dataIndex: 'type', render: text },
      { title: 'Trạng thái', dataIndex: 'status', render: status },
      { title: 'Tổng tiền', dataIndex: 'totalMinor', align: 'right', render: (value: number, row) => formatMoneyMinor(value, row.currency as string | undefined) },
      { title: 'Còn nợ', dataIndex: 'balanceMinor', align: 'right', render: (value: number, row) => formatMoneyMinor(value, row.currency as string | undefined) },
      { title: 'Hạn thanh toán', dataIndex: 'dueAt', render: when },
    ],
  },
  doctors: {
    title: 'Quản lý bác sĩ',
    description: 'Danh mục bác sĩ, thông tin chuyên khoa và trạng thái hoạt động.',
    load: getList('/api/doctors?limit=100'),
    detailTitle: (row) => `Bác sĩ ${text(row.fullName ?? row.name ?? row.id)}`,
  },
  services: {
    title: 'Quản lý dịch vụ & giá',
    description: 'Danh mục dịch vụ khám, bảng giá viện phí đang cấu hình.',
    load: getList('/api/catalog/services'),
    detailTitle: (row) => `Dịch vụ ${text(row.displayName ?? row.name ?? row.id)}`,
  },
  encounters: {
    title: 'Quản lý hồ sơ khám',
    description: 'Các lượt khám bệnh (encounter) và kết quả thăm khám trong hệ thống.',
    load: getList('/api/medical-records/encounters'),
    detailTitle: (row) => `Encounter ${text(row.id)}`,
    columns: [
      { title: 'Mã encounter', dataIndex: 'id', render: code },
      { title: 'Bệnh nhân', dataIndex: 'patientId', render: code },
      { title: 'Lịch hẹn', dataIndex: 'appointmentId', render: code },
      { title: 'Trạng thái', dataIndex: 'status', render: status },
      { title: 'Bắt đầu', dataIndex: 'startedAt', render: when },
    ],
  },
  'pregnancy-episodes': {
    title: 'Quản lý thai kỳ',
    description: 'Các đợt theo dõi thai kỳ và hồ sơ chăm sóc sức khỏe mẹ bầu.',
    load: getList('/api/medical-records/pregnancy-episodes'),
    detailTitle: (row) => `Thai kỳ ${text(row.id)}`,
  },
  prescriptions: {
    title: 'Quản lý đơn thuốc',
    description: 'Danh sách đơn thuốc đã kê toa, liều dùng và trạng thái phát hành.',
    load: getList('/api/prescriptions'),
    detailTitle: (row) => `Đơn thuốc ${text(row.id)}`,
    columns: [
      { title: 'Mã đơn', dataIndex: 'id', render: code },
      { title: 'Bệnh nhân', dataIndex: 'patientId', render: code },
      { title: 'Encounter', dataIndex: 'encounterId', render: code },
      { title: 'Trạng thái', dataIndex: 'status', render: status },
    ],
  },
  'treatment-plans': {
    title: 'Quản lý kế hoạch điều trị',
    description: 'Kế hoạch điều trị, phác đồ và tiến độ chăm sóc của bệnh nhân.',
    load: getList('/api/treatment-plans'),
    detailTitle: (row) => `Kế hoạch ${text(row.title ?? row.id)}`,
    columns: [
      { title: 'Tiêu đề', dataIndex: 'title', render: text },
      { title: 'Bệnh nhân', dataIndex: 'patientId', render: code },
      { title: 'Trạng thái', dataIndex: 'status', render: status },
    ],
  },
  consultations: {
    title: 'Quản lý tư vấn',
    description: 'Các phiên tư vấn khám từ xa và trao đổi y tế trực tuyến.',
    load: getList('/api/consultations'),
    detailTitle: (row) => `Tư vấn ${text(row.subject ?? row.id)}`,
    columns: [
      { title: 'Chủ đề', dataIndex: 'subject', render: text },
      { title: 'Trạng thái', dataIndex: 'status', render: status },
      { title: 'Mã', dataIndex: 'id', render: code },
    ],
  },
  receptionists: {
    title: 'Quản lý lễ tân',
    description: 'Hồ sơ nhân viên lễ tân và điều phối tiếp nhận bệnh nhân.',
    load: getList('/api/receptionists'),
    detailTitle: (row) => `Lễ tân ${text(row.fullName ?? row.id)}`,
  },
};

/** Mục chưa có HTTP API ở backend — hiển thị trạng thái thay vì dữ liệu giả. */
export const UNSUPPORTED: Record<string, { title: string; description: string; reason: string }> = {};

export const SECTION_TITLES: Record<string, string> = {
  overview: 'Tổng quan hệ thống',
  reports: 'Báo cáo & Thống kê',
  doctors: 'Quản lý bác sĩ',
  specialties: 'Quản lý chuyên khoa',
  patients: 'Quản lý bệnh nhân',
  users: 'Quản lý người dùng',
  services: 'Quản lý dịch vụ & giá',
  'audit-log': 'Nhật ký & Kiểm toán hệ thống (Audit Logs)',
  'system-health': 'Giám sát dịch vụ & Sao lưu (Health & Backup Monitor)',
  ...Object.fromEntries(Object.entries(RESOURCES).map(([key, value]) => [key, value.title])),
  ...Object.fromEntries(Object.entries(UNSUPPORTED).map(([key, value]) => [key, value.title])),
};
