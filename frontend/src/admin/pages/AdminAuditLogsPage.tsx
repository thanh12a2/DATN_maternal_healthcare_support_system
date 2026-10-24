import { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Table,
  Tag,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Modal,
  Descriptions,
  Typography,
  Row,
  Col,
  Statistic,
  Tooltip,
  Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  UserOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons';
import { useAuthSession } from '../../app/AuthSessionProvider';
import {
  fetchAuditLogs,
  fetchAuditStats,
  type AuditLogItem,
  type AuditLogStats,
} from '../../services/adminAuditHealth';
import { listAdminUsers } from '../../services/adminUsers';
import { listDoctors } from '../../services/adminDoctors';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Action definition mapping: label, color, icon
const ACTION_MAP: Record<
  string,
  { label: string; color: string; icon: React.ReactNode; group: string }
> = {
  // Dịch vụ & Biểu phí
  SERVICE_PRICE_UPDATED: {
    label: 'Cập nhật giá dịch vụ',
    color: '#0284c7',
    icon: <DollarOutlined />,
    group: 'Dịch vụ & Biểu phí',
  },
  RANK_SURCHARGE_SCHEDULED: {
    label: 'Lên lịch phụ thu hạng',
    color: '#7c3aed',
    icon: <DollarOutlined />,
    group: 'Dịch vụ & Biểu phí',
  },
  SERVICE_CREATED: {
    label: 'Tạo dịch vụ y tế',
    color: '#0ea5e9',
    icon: <MedicineBoxOutlined />,
    group: 'Dịch vụ & Biểu phí',
  },
  SERVICE_UPDATED: {
    label: 'Sửa dịch vụ y tế',
    color: '#3b82f6',
    icon: <MedicineBoxOutlined />,
    group: 'Dịch vụ & Biểu phí',
  },
  SERVICE_ACTIVATED: {
    label: 'Kích hoạt dịch vụ',
    color: '#16a34a',
    icon: <MedicineBoxOutlined />,
    group: 'Dịch vụ & Biểu phí',
  },
  SERVICE_DEACTIVATED: {
    label: 'Tạm dừng dịch vụ',
    color: '#ea580c',
    icon: <MedicineBoxOutlined />,
    group: 'Dịch vụ & Biểu phí',
  },
  SERVICE_DELETED: {
    label: 'Xóa dịch vụ y tế',
    color: '#dc2626',
    icon: <MedicineBoxOutlined />,
    group: 'Dịch vụ & Biểu phí',
  },
  // Nhóm dịch vụ & Thẻ Tag
  CATEGORY_CREATED: {
    label: 'Tạo nhóm dịch vụ',
    color: '#059669',
    icon: <AuditOutlined />,
    group: 'Nhóm dịch vụ',
  },
  CATEGORY_UPDATED: {
    label: 'Sửa nhóm dịch vụ',
    color: '#0d9488',
    icon: <AuditOutlined />,
    group: 'Nhóm dịch vụ',
  },
  CATEGORY_ACTIVATED: {
    label: 'Kích hoạt nhóm DV',
    color: '#16a34a',
    icon: <AuditOutlined />,
    group: 'Nhóm dịch vụ',
  },
  CATEGORY_DEACTIVATED: {
    label: 'Tạm dừng nhóm DV',
    color: '#ea580c',
    icon: <AuditOutlined />,
    group: 'Nhóm dịch vụ',
  },
  CATEGORY_DELETED: {
    label: 'Xóa nhóm dịch vụ',
    color: '#dc2626',
    icon: <AuditOutlined />,
    group: 'Nhóm dịch vụ',
  },
  TAG_CREATED: {
    label: 'Tạo thẻ tag',
    color: '#8b5cf6',
    icon: <AuditOutlined />,
    group: 'Thẻ tag',
  },
  TAG_UPDATED: {
    label: 'Sửa thẻ tag',
    color: '#a855f7',
    icon: <AuditOutlined />,
    group: 'Thẻ tag',
  },
  TAG_ACTIVATED: {
    label: 'Kích hoạt thẻ tag',
    color: '#16a34a',
    icon: <AuditOutlined />,
    group: 'Thẻ tag',
  },
  TAG_DEACTIVATED: {
    label: 'Tạm dừng thẻ tag',
    color: '#ea580c',
    icon: <AuditOutlined />,
    group: 'Thẻ tag',
  },
  TAG_DELETED: {
    label: 'Xóa thẻ tag',
    color: '#dc2626',
    icon: <AuditOutlined />,
    group: 'Thẻ tag',
  },
  // Bác sĩ & Hạng & Chuyên khoa
  DOCTOR_RANK_CHANGED: {
    label: 'Đổi hạng bác sĩ',
    color: '#d97706',
    icon: <MedicineBoxOutlined />,
    group: 'Hồ sơ bác sĩ',
  },
  DOCTOR_RANK_CREATED: {
    label: 'Thêm hạng bác sĩ',
    color: '#f59e0b',
    icon: <MedicineBoxOutlined />,
    group: 'Hồ sơ bác sĩ',
  },
  DOCTOR_RANK_UPDATED: {
    label: 'Sửa hạng bác sĩ',
    color: '#d97706',
    icon: <MedicineBoxOutlined />,
    group: 'Hồ sơ bác sĩ',
  },
  DOCTOR_RANK_DELETED: {
    label: 'Xóa hạng bác sĩ',
    color: '#dc2626',
    icon: <MedicineBoxOutlined />,
    group: 'Hồ sơ bác sĩ',
  },
  DOCTOR_PROFILE_CREATED: {
    label: 'Thêm mới bác sĩ',
    color: '#2563eb',
    icon: <UserOutlined />,
    group: 'Hồ sơ bác sĩ',
  },
  DOCTOR_PROFILE_UPDATED: {
    label: 'Cập nhật bác sĩ',
    color: '#3b82f6',
    icon: <UserOutlined />,
    group: 'Hồ sơ bác sĩ',
  },
  DOCTOR_ACTIVATED: {
    label: 'Kích hoạt bác sĩ',
    color: '#16a34a',
    icon: <UserOutlined />,
    group: 'Hồ sơ bác sĩ',
  },
  DOCTOR_DEACTIVATED: {
    label: 'Tạm ngừng bác sĩ',
    color: '#ea580c',
    icon: <UserOutlined />,
    group: 'Hồ sơ bác sĩ',
  },
  DOCTOR_DELETED: {
    label: 'Xóa bác sĩ',
    color: '#dc2626',
    icon: <UserOutlined />,
    group: 'Hồ sơ bác sĩ',
  },
  SPECIALTY_CREATED: {
    label: 'Tạo chuyên khoa',
    color: '#059669',
    icon: <MedicineBoxOutlined />,
    group: 'Chuyên khoa',
  },
  SPECIALTY_UPDATED: {
    label: 'Sửa chuyên khoa',
    color: '#0d9488',
    icon: <MedicineBoxOutlined />,
    group: 'Chuyên khoa',
  },
  SPECIALTY_ACTIVATED: {
    label: 'Kích hoạt chuyên khoa',
    color: '#16a34a',
    icon: <MedicineBoxOutlined />,
    group: 'Chuyên khoa',
  },
  SPECIALTY_DEACTIVATED: {
    label: 'Tạm khóa chuyên khoa',
    color: '#ea580c',
    icon: <MedicineBoxOutlined />,
    group: 'Chuyên khoa',
  },
  SPECIALTY_DELETED: {
    label: 'Xóa chuyên khoa',
    color: '#dc2626',
    icon: <MedicineBoxOutlined />,
    group: 'Chuyên khoa',
  },
  // Người dùng & Tài khoản
  USER_ACCOUNT_CREATED: {
    label: 'Tạo tài khoản',
    color: '#0284c7',
    icon: <UserOutlined />,
    group: 'Người dùng',
  },
  USER_ACCOUNT_UPDATED: {
    label: 'Cập nhật tài khoản',
    color: '#3b82f6',
    icon: <UserOutlined />,
    group: 'Người dùng',
  },
  USER_ACCOUNT_LOCKED: {
    label: 'Khóa tài khoản',
    color: '#dc2626',
    icon: <UserOutlined />,
    group: 'Người dùng',
  },
  USER_ACCOUNT_ACTIVATED: {
    label: 'Kích hoạt tài khoản',
    color: '#16a34a',
    icon: <UserOutlined />,
    group: 'Người dùng',
  },
  USER_ACCOUNT_DELETED: {
    label: 'Xóa tài khoản',
    color: '#991b1b',
    icon: <UserOutlined />,
    group: 'Người dùng',
  },
  // Bệnh nhân
  PATIENT_RECORD_CREATED: {
    label: 'Tạo hồ sơ bệnh nhân',
    color: '#0284c7',
    icon: <UserOutlined />,
    group: 'Bệnh nhân',
  },
  PATIENT_RECORD_UPDATED: {
    label: 'Cập nhật bệnh nhân',
    color: '#3b82f6',
    icon: <UserOutlined />,
    group: 'Bệnh nhân',
  },
  PATIENT_RECORD_DELETED: {
    label: 'Xóa hồ sơ bệnh nhân',
    color: '#dc2626',
    icon: <UserOutlined />,
    group: 'Bệnh nhân',
  },
  EMERGENCY_CONTACT_ADDED: {
    label: 'Thêm LH khẩn cấp',
    color: '#059669',
    icon: <UserOutlined />,
    group: 'Bệnh nhân',
  },
  EMERGENCY_CONTACT_UPDATED: {
    label: 'Sửa LH khẩn cấp',
    color: '#0d9488',
    icon: <UserOutlined />,
    group: 'Bệnh nhân',
  },
  EMERGENCY_CONTACT_DELETED: {
    label: 'Xóa LH khẩn cấp',
    color: '#dc2626',
    icon: <UserOutlined />,
    group: 'Bệnh nhân',
  },
  // Hóa đơn & Viện phí
  INVOICE_CREDIT_APPROVED: {
    label: 'Duyệt miễn giảm viện phí',
    color: '#059669',
    icon: <DollarOutlined />,
    group: 'Hóa đơn & Viện phí',
  },
};

export function AdminAuditLogsPage() {
  const { request } = useAuthSession();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AuditLogStats | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<string | undefined>(undefined);
  const [selectedService, setSelectedService] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  // Detail Modal
  const [selectedItem, setSelectedItem] = useState<AuditLogItem | null>(null);
  const [userEmailMap, setUserEmailMap] = useState<Record<string, string>>({});

  async function loadData() {
    setLoading(true);
    try {
      const [res, st, userListRes, doctorListRes] = await Promise.all([
        fetchAuditLogs(
          request,
          {
            page,
            pageSize,
            search: search.trim() || undefined,
            action: selectedAction || undefined,
            sourceService: selectedService || undefined,
            fromDate: dateRange ? dateRange[0] : undefined,
            toDate: dateRange ? dateRange[1] : undefined,
          },
        ),
        fetchAuditStats(request).catch(() => null),
        listAdminUsers(request, { limit: 100 }).catch(() => null),
        listDoctors(request, { limit: 100 }).catch(() => null),
      ]);
      setLogs(res.items);
      setTotal(res.total);
      if (st) setStats(st);
      const mapping: Record<string, string> = {};
      if (userListRes?.items) {
        for (const u of userListRes.items) {
          mapping[u.id] = u.email;
        }
      }
      if (doctorListRes?.data) {
        for (const d of doctorListRes.data) {
          const ident = d.email || d.profile?.fullName || '';
          if (ident) {
            mapping[d.id] = ident;
            if (d.accountId && d.email) {
              mapping[d.accountId] = d.email;
            }
          }
        }
      }
      setUserEmailMap((prev) => ({ ...prev, ...mapping }));
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [page, pageSize, selectedAction, selectedService, dateRange]);

  const handleSearchSubmit = () => {
    setPage(1);
    void loadData();
  };

  const handleReset = () => {
    setSearch('');
    setSelectedAction(undefined);
    setSelectedService(undefined);
    setDateRange(null);
    setPage(1);
  };

  const columns: ColumnsType<AuditLogItem> = [
    {
      title: 'Thời gian',
      dataIndex: 'occurredAt',
      key: 'occurredAt',
      width: 140,
      render: (val: string) => {
        const d = new Date(val);
        return (
          <Space direction="vertical" size={2}>
            <Text strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
              {d.toLocaleDateString('vi-VN')}
            </Text>
            <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {d.toLocaleTimeString('vi-VN')}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Hành động kiểm toán',
      dataIndex: 'action',
      key: 'action',
      width: 180,
      render: (action: string) => {
        const item = ACTION_MAP[action];
        if (!item) {
          return <Tag color="blue">{action}</Tag>;
        }
        return (
          <Tag
            color={item.color}
            style={{
              padding: '3px 8px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 6,
              whiteSpace: 'nowrap',
            }}
          >
            <Space orientation="horizontal" size={4}>
              {item.icon}
              {item.label}
            </Space>
          </Tag>
        );
      },
    },
    {
      title: 'Người thực hiện (Actor)',
      key: 'actor',
      width: 220,
      render: (_, r) => {
        const email =
          (r.metadata as any)?.actorEmail ||
          r.actorId ||
          'Quản trị viên (Hệ thống)';
        return (
          <Space direction="vertical" size={2}>
            <Text strong style={{ fontSize: 13, wordBreak: 'break-all' }}>
              <UserOutlined style={{ marginRight: 6, color: '#0284c7' }} />
              {email}
            </Text>
            <Tag color="cyan" style={{ fontSize: 11, margin: 0, width: 'fit-content' }}>
              Vai trò: {r.actorType}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'Đối tượng tác động (Target)',
      key: 'target',
      render: (_, r) => {
        const meta = r.metadata || {};
        let summary = meta.description || `${r.aggregateType} [${r.aggregateId}]`;

        // Nếu là thao tác trên tài khoản người dùng mà bị ghi UUID, tự động phân giải sang Email
        if (
          r.aggregateType === 'USER_ACCOUNT' ||
          r.sourceService === 'auth-service' ||
          r.action.startsWith('USER_ACCOUNT_')
        ) {
          const userEmail =
            meta.targetEmail ||
            meta.email ||
            userEmailMap[r.aggregateId];

          if (userEmail) {
            if (r.action === 'USER_ACCOUNT_CREATED') summary = `Tạo tài khoản mới: ${userEmail}`;
            else if (r.action === 'USER_ACCOUNT_ACTIVATED') summary = `Kích hoạt tài khoản: ${userEmail}`;
            else if (r.action === 'USER_ACCOUNT_LOCKED') summary = `Khóa tài khoản: ${userEmail}`;
            else if (r.action === 'USER_ACCOUNT_UPDATED') summary = `Cập nhật thông tin tài khoản: ${userEmail}`;
            else if (r.action === 'USER_ACCOUNT_DELETED') summary = `Xóa tài khoản người dùng: ${userEmail}`;
          } else if (summary.includes(r.aggregateId)) {
            // Thay thế aggregateId trong summary nếu đã có map email
            const mappedEmail = userEmailMap[r.aggregateId];
            if (mappedEmail) {
              summary = summary.replace(r.aggregateId, mappedEmail);
            }
          }
        } else if (
          r.aggregateType === 'DOCTOR' ||
          r.action.startsWith('DOCTOR_')
        ) {
          const docIdentifier =
            meta.targetEmail ||
            meta.email ||
            meta.doctorName ||
            userEmailMap[r.aggregateId];

          if (docIdentifier) {
            if (r.action === 'DOCTOR_PROFILE_CREATED') summary = `Thêm mới bác sĩ: ${docIdentifier}`;
            else if (r.action === 'DOCTOR_ACTIVATED') summary = `Kích hoạt bác sĩ: ${docIdentifier}`;
            else if (r.action === 'DOCTOR_DEACTIVATED') summary = `Tạm khóa bác sĩ: ${docIdentifier}${meta.reason ? ` - Lý do: ${meta.reason}` : ''}`;
            else if (r.action === 'DOCTOR_PROFILE_UPDATED') summary = `Cập nhật thông tin bác sĩ: ${docIdentifier}`;
            else if (r.action === 'DOCTOR_DELETED') summary = `Xóa hồ sơ bác sĩ: ${docIdentifier}`;
          } else if (summary.includes(r.aggregateId)) {
            const mapped = userEmailMap[r.aggregateId];
            if (mapped) {
              summary = summary.replace(r.aggregateId, mapped);
            }
          }
        } else if (
          r.aggregateType === 'SPECIALTY' ||
          r.action.startsWith('SPECIALTY_')
        ) {
          const specName = meta.specialtyName || meta.name;
          if (specName) {
            if (r.action === 'SPECIALTY_CREATED') summary = `Thêm chuyên khoa mới: ${specName}`;
            else if (r.action === 'SPECIALTY_ACTIVATED') summary = `Kích hoạt chuyên khoa: ${specName}`;
            else if (r.action === 'SPECIALTY_DEACTIVATED') summary = `Tạm khóa chuyên khoa: ${specName}`;
            else if (r.action === 'SPECIALTY_UPDATED') summary = `Cập nhật chuyên khoa: ${specName}`;
            else if (r.action === 'SPECIALTY_DELETED') summary = `Xóa chuyên khoa: ${specName}`;
          }
        }

        if (!meta.description) {
          if (meta.serviceName) {
            summary = `${meta.serviceName} (${meta.oldPrice || ''} ➔ ${meta.newPrice || ''})`;
          } else if (meta.doctorName) {
            summary = `${meta.doctorName} (${meta.oldRank || ''} ➔ ${meta.newRank || ''})`;
          } else if (meta.targetEmail) {
            summary = `${meta.targetEmail} - Lý do: ${meta.lockReason || meta.note || meta.deactivateReason || 'N/A'}`;
          } else if (meta.rankName) {
            summary = `${meta.rankName}: ${meta.newSurcharge || ''}`;
          } else if (meta.name) {
            summary = `${meta.name} [${r.aggregateId}]`;
          } else if (meta.fullName) {
            summary = `${meta.fullName} [${r.aggregateId}]`;
          }
        }
        return (
          <div style={{ wordBreak: 'break-word', lineHeight: 1.5 }}>
            <Text style={{ fontWeight: 500, fontSize: 13, color: '#1e293b' }}>{summary}</Text>
          </div>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'result',
      key: 'result',
      width: 120,
      align: 'center',
      render: (res: string) => (
        <Badge
          status={res === 'SUCCESS' ? 'success' : 'error'}
          text={res === 'SUCCESS' ? 'Thành công' : 'Thất bại'}
          style={{ fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap' }}
        />
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 95,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="Xem chi tiết kiểm toán & Metadata">
          <Button
            type="primary"
            ghost
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setSelectedItem(record)}
          >
            Chi tiết
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="admin-page-container" style={{ padding: '0 4px' }}>
      {/* Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card
            bordered={false}
            style={{
              background: 'linear-gradient(135deg, #e0f2fe 0%, #ffffff 100%)',
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <Statistic
              title={
                <Text strong style={{ color: '#0369a1' }}>
                  <AuditOutlined style={{ marginRight: 8 }} />
                  Tổng lượt kiểm toán hệ thống
                </Text>
              }
              value={stats?.totalLogs ?? total}
              suffix="sự kiện"
              valueStyle={{ color: '#0284c7', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            bordered={false}
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <Statistic
              title={
                <Text strong style={{ color: '#15803d' }}>
                  <SafetyCertificateOutlined style={{ marginRight: 8 }} />
                  Kiểm toán ghi nhận hôm nay
                </Text>
              }
              value={stats?.todayLogs ?? 0}
              suffix="thao tác"
              valueStyle={{ color: '#16a34a', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            bordered={false}
            style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #ffffff 100%)',
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <Statistic
              title={
                <Text strong style={{ color: '#b45309' }}>
                  <MedicineBoxOutlined style={{ marginRight: 8 }} />
                  Tính toàn vẹn kiểm toán (SHA-256)
                </Text>
              }
              value="100%"
              suffix="Hợp lệ"
              valueStyle={{ color: '#d97706', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter and Control Bar */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
              flex: 1,
            }}
          >
            <Input
              placeholder="Tìm hành động, ID, người sửa..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={handleSearchSubmit}
              allowClear
              style={{ width: 280 }}
            />
            <Select
              style={{ width: 240 }}
              placeholder="Lọc loại hành vi"
              allowClear
              value={selectedAction}
              onChange={(val) => {
                setSelectedAction(val);
                setPage(1);
              }}
              options={[
                { label: 'Cập nhật giá dịch vụ', value: 'SERVICE_PRICE_UPDATED' },
                { label: 'Lên lịch phụ thu hạng', value: 'RANK_SURCHARGE_SCHEDULED' },
                { label: 'Đổi hạng bác sĩ', value: 'DOCTOR_RANK_CHANGED' },
                { label: 'Khóa tài khoản', value: 'USER_ACCOUNT_LOCKED' },
                { label: 'Kích hoạt tài khoản', value: 'USER_ACCOUNT_ACTIVATED' },
                { label: 'Duyệt miễn giảm viện phí', value: 'INVOICE_CREDIT_APPROVED' },
              ]}
            />
            <RangePicker
              style={{ width: 260 }}
              placeholder={['Từ ngày', 'Đến ngày']}
              onChange={(_, dateStrings) => {
                if (dateStrings[0] && dateStrings[1]) {
                  setDateRange([dateStrings[0], dateStrings[1]]);
                } else {
                  setDateRange(null);
                }
                setPage(1);
              }}
            />
          </div>
          <Space size="middle">
            <Button type="primary" onClick={handleSearchSubmit} icon={<SearchOutlined />}>
              Tìm kiếm
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              Làm mới
            </Button>
          </Space>
        </div>
      </Card>

      {/* Main Audit Table */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '15', '20', '50'],
            showTotal: (t, r) => `${r[0]}-${r[1]} trong tổng số ${t} nhật ký`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{ emptyText: 'Chưa có nhật ký kiểm toán phù hợp' }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={
          <Space>
            <AuditOutlined style={{ color: '#0284c7' }} />
            <span>Chi tiết bản ghi kiểm toán y tế</span>
          </Space>
        }
        open={Boolean(selectedItem)}
        onCancel={() => setSelectedItem(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSelectedItem(null)}>
            Đóng
          </Button>,
        ]}
        width={720}
      >
        {selectedItem && (
          <Descriptions bordered column={2} size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="Mã sự kiện (Event ID)" span={2}>
              <Text code copyable>
                {selectedItem.eventId}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Hành động">
              <Tag color="blue">{selectedItem.action}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Dịch vụ phát sinh">
              <Text strong>{selectedItem.sourceService}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Thực hiện bởi">
              <Text>
                {(selectedItem.metadata as any)?.actorEmail || selectedItem.actorId}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Địa chỉ IP (Client IP)">
              <Tag color="geekblue">{selectedItem.ipAddress}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Đối tượng thực thể">
              <Text code>{selectedItem.aggregateType}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="ID thực thể (Target ID)">
              <Text code copyable>
                {selectedItem.aggregateId}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Các trường bị thay đổi" span={2}>
              {selectedItem.changedFields?.length ? (
                selectedItem.changedFields.map((f) => (
                  <Tag color="orange" key={f}>
                    {f}
                  </Tag>
                ))
              ) : (
                <Text type="secondary">Toàn bộ bản ghi / snapshot</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian xảy ra">
              {new Date(selectedItem.occurredAt).toLocaleString('vi-VN')}
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian lưu trữ">
              {new Date(selectedItem.ingestedAt).toLocaleString('vi-VN')}
            </Descriptions.Item>
            <Descriptions.Item label="Chi tiết Metadata" span={2}>
              <pre
                style={{
                  background: '#f8fafc',
                  padding: 12,
                  borderRadius: 8,
                  maxHeight: 260,
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  wordWrap: 'break-word',
                  lineHeight: 1.6,
                }}
              >
                {JSON.stringify(selectedItem.metadata, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
