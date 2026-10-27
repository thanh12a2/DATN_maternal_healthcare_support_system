import { useCallback, useState } from 'react';
import { Alert, DatePicker } from 'antd';
import { BarChartOutlined, CalendarOutlined, DollarOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { getAppointmentReport, getRevenueReport } from '../../../services/operations';
import { DataTable, type Row } from '../components/DataTable';
import { useApiList } from '../hooks/useApiList';
import { autoColumns } from '../resources';
import { formatMoneyMinor, humanizeKey } from '../format';

type Range = [Dayjs, Dayjs];

export function ReportsPage() {
  const { request } = useAuthSession();
  const [range, setRange] = useState<Range>([dayjs().subtract(30, 'day'), dayjs()]);
  const query = `fromDate=${range[0].format('YYYY-MM-DD')}&toDate=${range[1].format('YYYY-MM-DD')}`;

  const loadAppointments = useCallback(async () => {
    const report = await getAppointmentReport(request, query);
    return (Array.isArray(report?.rows) ? report.rows : []) as Row[];
  }, [request, query]);
  const loadRevenue = useCallback(async () => {
    const report = await getRevenueReport(request, query);
    return { rows: (Array.isArray(report?.rows) ? report.rows : []) as Row[], total: report?.totalCollectedAmount, currency: (report?.currency as string | undefined) ?? 'VND' };
  }, [request, query]);

  const appointments = useApiList<Row>(loadAppointments, [loadAppointments]);
  const [revenueTotal, setRevenueTotal] = useState<{ total: unknown; currency: string }>({ total: undefined, currency: 'VND' });
  const revenue = useApiList<Row>(useCallback(async () => {
    const result = await loadRevenue();
    setRevenueTotal({ total: result.total, currency: result.currency });
    return result.rows;
  }, [loadRevenue]), [loadRevenue]);

  const totalCollected = Number(revenueTotal.total);

  return (
    <div className="admin-reports">
      <div className="admin-filter-card">
        <label htmlFor="admin-report-range" className="admin-filter-label">Khoảng thời gian</label>
        <DatePicker.RangePicker id="admin-report-range" value={range} format="DD/MM/YYYY" allowClear={false} onChange={(value) => { if (value?.[0] && value[1]) setRange([value[0], value[1]]); }} />
      </div>
      <div className="admin-stat-grid" style={{ ['--cols' as string]: 3 }}>
        <article className="admin-stat-card"><span className="admin-stat-icon tone-green" aria-hidden="true"><DollarOutlined /></span><div className="admin-stat-body"><span className="admin-stat-label">Tổng thu trong kỳ</span><strong className="admin-stat-value">{Number.isFinite(totalCollected) ? formatMoneyMinor(totalCollected, revenueTotal.currency) : '—'}</strong></div></article>
        <article className="admin-stat-card"><span className="admin-stat-icon tone-blue" aria-hidden="true"><CalendarOutlined /></span><div className="admin-stat-body"><span className="admin-stat-label">Ngày có lịch hẹn</span><strong className="admin-stat-value">{appointments.items.length}</strong></div></article>
        <article className="admin-stat-card"><span className="admin-stat-icon tone-amber" aria-hidden="true"><BarChartOutlined /></span><div className="admin-stat-body"><span className="admin-stat-label">Ngày có doanh thu</span><strong className="admin-stat-value">{revenue.items.length}</strong></div></article>
      </div>
      <h2 className="admin-section-title">Lịch hẹn theo ngày</h2>
      <DataTable<Row> rows={appointments.items} state={appointments.state} error={appointments.error} onReload={appointments.reload} columns={autoColumns(appointments.items).map((column) => ({ ...column, title: typeof column.title === 'string' ? humanizeKey(column.title) : column.title }))} />
      <h2 className="admin-section-title">Doanh thu theo ngày</h2>
      <DataTable<Row> rows={revenue.items} state={revenue.state} error={revenue.error} onReload={revenue.reload} columns={autoColumns(revenue.items)} />
      {revenue.state === 'ready' && !revenue.items.length && <Alert type="info" showIcon title="Chưa có số liệu doanh thu trong khoảng đã chọn" style={{ marginTop: 12 }} />}
    </div>
  );
}
