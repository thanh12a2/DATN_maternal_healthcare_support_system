import { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Button,
  Badge,
  Space,
  Typography,
  Tooltip,
  Alert,
  Radio,
  message,
  Table,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  HeartOutlined,
  CloudServerOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import {
  fetchSystemHealth,
  fetchBackupRecords,
  type SystemHealthOverview,
  type ServiceHealthStatus,
  type BackupRecord,
} from '../../../services/adminAuditHealth';

const { Text, Title } = Typography;

const CATEGORY_NAMES: Record<string, string> = {
  core: 'Hạ tầng Cốt lõi & Phân quyền',
  clinical: 'Khám chữa bệnh & Lâm sàng',
  operational: 'Tiếp đón & Vận hành',
  support: 'Hỗ trợ & Báo cáo',
};

const CATEGORY_COLORS: Record<string, string> = {
  core: '#0284c7',
  clinical: '#059669',
  operational: '#d97706',
  support: '#7c3aed',
};

export function AdminSystemHealthPage() {
  const { request, user } = useAuthSession();
  const [health, setHealth] = useState<SystemHealthOverview | null>(null);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  async function loadData() {
    setLoading(true);
    try {
      const [hRes, bRes] = await Promise.all([
        fetchSystemHealth(request),
        fetchBackupRecords(request).catch(() => ({ items: [], lastBackup: null })),
      ]);
      setHealth(hRes);
      setBackups(bRes.items || []);
    } catch {
      message.error('Không thể nạp dữ liệu tình trạng hệ thống');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // Tự động kiểm tra sức khỏe mỗi 30 giây
    const timer = setInterval(() => {
      void loadData();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const filteredServices = (health?.services || []).filter((s) => {
    if (categoryFilter === 'all') return true;
    return s.category === categoryFilter;
  });

  return (
    <div className="admin-page-container" style={{ padding: '0 4px' }}>
      {/* Top Banner Alert */}
      <Alert
        message={
          <Space>
            <ApiOutlined />
            <Text strong>Hạ tầng Vi mô Đa dịch vụ (17 Microservices Cluster)</Text>
            <Tag color={health?.overallStatus === 'OPERATIONAL' ? 'green' : 'orange'}>
              {health?.overallStatus === 'OPERATIONAL' ? 'Hoạt động ổn định' : 'Có cảnh báo'}
            </Tag>
          </Space>
        }
        description={`Hệ thống đang tự động giám sát trực tiếp 17/17 cụm microservices. Lần đo gần nhất: ${health?.lastCheckedAt ? new Date(health.lastCheckedAt).toLocaleTimeString('vi-VN') : 'Đang tải...'}`}
        type={health?.overallStatus === 'OPERATIONAL' ? 'success' : 'warning'}
        showIcon
        style={{ marginBottom: 20, borderRadius: 12 }}
        action={
          <Button
            type="primary"
            ghost
            icon={<ReloadOutlined spin={loading} />}
            onClick={() => void loadData()}
          >
            Làm mới ngay
          </Button>
        }
      />

      {/* KPI Statistic Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={6}>
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
                <Text strong style={{ color: '#16a34a' }}>
                  <CheckCircleOutlined style={{ marginRight: 6 }} />
                  Cụm dịch vụ hoạt động tốt
                </Text>
              }
              value={health?.healthyCount ?? 0}
              suffix={`/ ${health?.totalServices ?? 17}`}
              valueStyle={{ color: '#16a34a', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
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
                <Text strong style={{ color: '#0284c7' }}>
                  <ThunderboltOutlined style={{ marginRight: 6 }} />
                  Tỷ lệ khả dụng (Uptime)
                </Text>
              }
              value={health?.uptimePercentage ?? 100}
              suffix="%"
              valueStyle={{ color: '#0284c7', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
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
                <Text strong style={{ color: '#d97706' }}>
                  <ExclamationCircleOutlined style={{ marginRight: 6 }} />
                  Dịch vụ phản hồi chậm/suy giảm
                </Text>
              }
              value={health?.degradedCount ?? 0}
              suffix="cụm"
              valueStyle={{ color: '#d97706', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card
            bordered={false}
            style={{
              background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)',
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <Statistic
              title={
                <Text strong style={{ color: '#dc2626' }}>
                  <CloseCircleOutlined style={{ marginRight: 6 }} />
                  Cụm dịch vụ ngừng hoạt động
                </Text>
              }
              value={health?.downCount ?? 0}
              suffix="cụm"
              valueStyle={{ color: '#dc2626', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Microservices Cluster Grid */}
      <Card
        title={
          <Space>
            <ApiOutlined style={{ color: '#0284c7' }} />
            <span>Trạng thái hoạt động 17 Cụm Microservices (Live Probing)</span>
          </Space>
        }
        extra={
          <Space wrap>
            <Button
              type={categoryFilter === 'all' ? 'primary' : 'default'}
              size="small"
              onClick={() => setCategoryFilter('all')}
            >
              Tất cả (17)
            </Button>
            <Button
              type={categoryFilter === 'core' ? 'primary' : 'default'}
              size="small"
              onClick={() => setCategoryFilter('core')}
            >
              Cốt lõi (3)
            </Button>
            <Button
              type={categoryFilter === 'clinical' ? 'primary' : 'default'}
              size="small"
              onClick={() => setCategoryFilter('clinical')}
            >
              Lâm sàng (6)
            </Button>
            <Button
              type={categoryFilter === 'operational' ? 'primary' : 'default'}
              size="small"
              onClick={() => setCategoryFilter('operational')}
            >
              Vận hành (4)
            </Button>
            <Button
              type={categoryFilter === 'support' ? 'primary' : 'default'}
              size="small"
              onClick={() => setCategoryFilter('support')}
            >
              Hỗ trợ (4)
            </Button>
          </Space>
        }
        bordered={false}
        style={{ borderRadius: 12, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      >
        <Row gutter={[16, 16]}>
          {filteredServices.map((svc) => {
            const isHealthy = svc.status === 'HEALTHY';
            const isDegraded = svc.status === 'DEGRADED';
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={svc.id}>
                <Card
                  size="small"
                  hoverable
                  style={{
                    borderRadius: 10,
                    border: isHealthy
                      ? '1px solid #bbf7d0'
                      : isDegraded
                      ? '1px solid #fde68a'
                      : '1px solid #fecaca',
                    background: isHealthy ? '#f0fdf4' : isDegraded ? '#fffbeb' : '#fef2f2',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <Tag
                        color={CATEGORY_COLORS[svc.category] || 'default'}
                        style={{ fontSize: 11, borderRadius: 4, margin: 0 }}
                      >
                        {CATEGORY_NAMES[svc.category] || svc.category}
                      </Tag>
                      <Badge
                        status={isHealthy ? 'success' : isDegraded ? 'warning' : 'error'}
                        text={
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: 12,
                              color: isHealthy ? '#15803d' : isDegraded ? '#b45309' : '#b91c1c',
                            }}
                          >
                            {isHealthy ? 'Online' : isDegraded ? 'Degraded' : 'Offline'}
                          </span>
                        }
                      />
                    </div>
                    <Text strong style={{ fontSize: 14, display: 'block', minHeight: 40 }}>
                      {svc.displayName}
                    </Text>
                    <Text
                      type="secondary"
                      style={{ fontSize: 12, display: 'block', margin: '6px 0', minHeight: 36 }}
                    >
                      {svc.description}
                    </Text>
                  </div>

                  <div
                    style={{
                      borderTop: '1px dashed #e2e8f0',
                      paddingTop: 8,
                      marginTop: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Port: <Text code>{svc.port}</Text>
                      </Text>
                    </div>
                    <div>
                      <Tooltip title="Độ trễ phản hồi (Response Latency)">
                        <Tag
                          color={svc.responseTimeMs < 50 ? 'green' : 'orange'}
                          style={{ margin: 0, fontSize: 11 }}
                        >
                          <ThunderboltOutlined style={{ marginRight: 2 }} />
                          {svc.responseTimeMs}ms
                        </Tag>
                      </Tooltip>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* Quản lý sao lưu dữ liệu (Backup Manager) */}
      <Card
        title={
          <Space>
            <CloudServerOutlined style={{ color: '#0284c7' }} />
            <span>Quản lý Sao lưu Dữ liệu (Backup Manager)</span>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />}>
            Tạo bản sao lưu ngay
          </Button>
        }
        bordered={false}
        style={{ marginTop: 20 }}
      >
        <Table
          rowKey="id"
          size="small"
          dataSource={backups}
          pagination={false}
          columns={[
            {
              title: 'Mã sao lưu',
              dataIndex: 'id',
              key: 'id',
              render: (id: string) => <Text code>{id}</Text>,
            },
            {
              title: 'Mục tiêu',
              dataIndex: 'target',
              key: 'target',
            },
            {
              title: 'Dung lượng',
              dataIndex: 'sizeFormatted',
              key: 'sizeFormatted',
            },
            {
              title: 'Thời gian thực hiện',
              dataIndex: 'durationSeconds',
              key: 'durationSeconds',
              render: (s: number) => `${s}s`,
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              key: 'status',
              render: (st: string) => (
                <Tag color={st === 'COMPLETED' ? 'green' : 'orange'}>{st}</Tag>
              ),
            },
            {
              title: 'Thời điểm tạo',
              dataIndex: 'createdAt',
              key: 'createdAt',
              render: (d: string) => (d ? new Date(d).toLocaleString('vi-VN') : '—'),
            },
          ]}
        />
      </Card>
    </div>
  );
}
