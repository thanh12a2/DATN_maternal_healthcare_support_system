import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Skeleton } from 'antd';
import { ArrowRightOutlined, BarChartOutlined, CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined, DollarOutlined, MedicineBoxOutlined, ProfileOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { AppLink } from '../../../app/navigation';
import { ApiError } from '../../../services/api';
import { getReportOverview } from '../../../services/operations';
import { RESOURCES } from '../resources';
import { formatMoneyMinor, humanizeKey } from '../format';

interface Metric { key: string; label: string; value: string; hint: string }
type Tone = 'blue' | 'green' | 'amber' | 'violet';

const SHORTCUTS: Array<{ href: string; label: string }> = [
  { href: 'users', label: 'Quản lý người dùng' }, { href: 'appointments', label: 'Lịch hẹn' }, { href: 'billing', label: 'Hóa đơn' }, { href: 'doctors', label: 'Bác sĩ' },
  { href: 'services', label: 'Dịch vụ & giá' }, { href: 'patients', label: 'Tra cứu bệnh nhân' }, { href: 'encounters', label: 'Hồ sơ khám' },
  { href: 'reports', label: 'Báo cáo' },
];

function metricVisual(key: string): { icon: ReactNode; tone: Tone } {
  if (/complete/i.test(key)) return { icon: <CheckCircleOutlined />, tone: 'green' };
  if (/cancel/i.test(key)) return { icon: <CloseCircleOutlined />, tone: 'amber' };
  if (/amount|revenue|collected/i.test(key)) return { icon: <DollarOutlined />, tone: 'violet' };
  if (/doctor/i.test(key)) return { icon: <MedicineBoxOutlined />, tone: 'blue' };
  if (/service/i.test(key)) return { icon: <ProfileOutlined />, tone: 'green' };
  if (/appointment/i.test(key)) return { icon: <CalendarOutlined />, tone: 'blue' };
  return { icon: <BarChartOutlined />, tone: 'blue' };
}

function StatGrid({ items }: { items: Metric[] }) {
  return (
    <div className="admin-stat-grid" style={{ ['--cols' as string]: Math.min(items.length, 4) }}>
      {items.map((item) => {
        const { icon, tone } = metricVisual(item.key);
        return (
          <article className="admin-stat-card" key={item.key}>
            <span className={`admin-stat-icon tone-${tone}`} aria-hidden="true">{icon}</span>
            <div className="admin-stat-body">
              <span className="admin-stat-label">{item.label}</span>
              <strong className="admin-stat-value">{item.value}</strong>
              <span className="admin-stat-hint">{item.hint}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function DashboardPage() {
  const { request } = useAuthSession();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [counts, setCounts] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [report, doctors, services, appointments] = await Promise.allSettled([
      getReportOverview(request),
      RESOURCES.doctors.load(request),
      RESOURCES.services.load(request),
      RESOURCES.appointments.load(request),
    ]);
    if (report.status === 'fulfilled') {
      setMetrics(Object.entries(report.value ?? {})
        .filter(([, value]) => typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))))
        .map(([key, value]) => ({
          key,
          label: humanizeKey(key),
          value: /amount|revenue|collected/i.test(key) ? formatMoneyMinor(Number(value)) : String(value),
          hint: 'Reporting Service',
        })));
    } else if (!(report.reason instanceof ApiError && report.reason.statusCode === 404)) {
      setError(report.reason instanceof Error ? report.reason.message : 'Không thể tải báo cáo tổng quan.');
    }
    const count = (key: string, label: string, result: PromiseSettledResult<unknown[]>, hint: string): Metric[] => (result.status === 'fulfilled' ? [{ key, label, value: String(result.value.length), hint }] : []);
    setCounts([
      ...count('doctors', 'Bác sĩ', doctors, 'Doctor Service'),
      ...count('services', 'Dịch vụ khám', services, 'Service Catalog'),
      ...count('appointments', 'Lịch hẹn gần đây', appointments, 'Appointment Service'),
    ]);
    setLoading(false);
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="admin-dashboard">
      {error && <Alert type="warning" showIcon title="Báo cáo tổng quan chưa khả dụng" description={error} style={{ marginBottom: 16 }} />}
      {loading ? <Skeleton active paragraph={{ rows: 3 }} /> : (
        <>
          {metrics.length > 0 && <><h2 className="admin-block-title"><TeamOutlined /> Số liệu vận hành</h2><StatGrid items={metrics} /></>}
          {counts.length > 0 && <><h2 className="admin-block-title"><ProfileOutlined /> Danh mục hệ thống</h2><StatGrid items={counts} /></>}
          {!metrics.length && !counts.length && <Alert type="info" showIcon title="Chưa có số liệu để hiển thị" />}
        </>
      )}
      <section className="admin-panel" aria-labelledby="admin-shortcuts-title">
        <h2 className="admin-panel-title" id="admin-shortcuts-title">Truy cập nhanh</h2>
        <div className="admin-shortcuts">
          {SHORTCUTS.map((item) => <AppLink key={item.href} className="admin-shortcut" href={`/workspace/admin/${item.href}`}><span>{item.label}</span><ArrowRightOutlined /></AppLink>)}
        </div>
      </section>
    </div>
  );
}
