import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, DatePicker, Modal, Segmented, Skeleton, message } from 'antd';
import {
  ArrowRightOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  DownloadOutlined,
  EyeOutlined,
  MedicineBoxOutlined,
  ProfileOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { AppLink } from '../../../app/navigation';
import { getAppointmentReport, getOverviewPdf, getReportOverview, getRevenueReport } from '../../../services/operations';
import { ApiError } from '../../../services/api';
import { RESOURCES } from '../resources';
import { formatMoneyMinor } from '../format';
import { dashboardPeriodRange, type DashboardPeriod } from '../dashboardPeriod';
import { buildDashboardAnalytics, type DailyReportRow } from '../dashboardAnalytics';
import { DashboardCharts } from './DashboardCharts';

type MetricKey =
  | 'totalAppointments'
  | 'completedAppointments'
  | 'cancelledAppointments'
  | 'totalCollectedAmount';
type Tone = 'blue' | 'green' | 'amber' | 'violet';

const METRICS: Array<{
  key: MetricKey;
  label: string;
  icon: ReactNode;
  tone: Tone;
}> = [
  { key: 'totalAppointments', label: 'Lịch được đặt', icon: <CalendarOutlined />, tone: 'blue' },
  { key: 'completedAppointments', label: 'Đã hoàn thành', icon: <CheckCircleOutlined />, tone: 'green' },
  { key: 'cancelledAppointments', label: 'Đã hủy', icon: <CloseCircleOutlined />, tone: 'amber' },
  { key: 'totalCollectedAmount', label: 'Doanh thu đã thu', icon: <DollarOutlined />, tone: 'violet' },
];

const SHORTCUTS = [
  { href: 'users', label: 'Người dùng' },
  { href: 'appointments', label: 'Lịch hẹn' },
  { href: 'billing', label: 'Hóa đơn' },
  { href: 'doctors', label: 'Bác sĩ' },
  { href: 'services', label: 'Dịch vụ & giá' },
  { href: 'patients', label: 'Bệnh nhân' },
  { href: 'encounters', label: 'Hồ sơ khám' },
  { href: 'reports', label: 'Báo cáo' },
];

const PERIOD_OPTIONS: Array<{ label: string; value: DashboardPeriod }> = [
  { label: 'Ngày', value: 'day' },
  { label: 'Tuần', value: 'week' },
  { label: 'Quý', value: 'quarter' },
  { label: 'Khoảng ngày', value: 'range' },
];

function reportRows(response: Record<string, unknown>): DailyReportRow[] {
  const payload = response.data && typeof response.data === 'object' && !Array.isArray(response.data)
    ? response.data as Record<string, unknown> : response;
  return Array.isArray(payload.rows) ? payload.rows as DailyReportRow[] : [];
}

const RETRY_DELAYS_MS = [500, 1_000, 2_000, 4_000];
const isTemporaryReportError = (error: unknown) =>
  (error instanceof ApiError && [502, 503, 504].includes(error.statusCode)) || error instanceof TypeError;

function formatMetric(report: Record<string, unknown> | null, key: MetricKey) {
  const raw = report?.[key];
  if (raw === undefined || raw === null || raw === '') return '—';
  const value = Number(raw);
  if (!Number.isFinite(value)) return '—';
  if (key === 'totalCollectedAmount') {
    return formatMoneyMinor(value, typeof report?.currency === 'string' ? report.currency : 'VND');
  }
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function DashboardPage() {
  const { request } = useAuthSession();
  const [period, setPeriod] = useState<DashboardPeriod>('week');
  const [selectedDate, setSelectedDate] = useState(() => dayjs().locale('vi'));
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => [dayjs().subtract(29, 'day'), dayjs()]);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [appointmentRows, setAppointmentRows] = useState<DailyReportRow[]>([]);
  const [revenueRows, setRevenueRows] = useState<DailyReportRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; filename: string; label: string } | null>(null);
  const previewRequestId = useRef(0);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [catalog, setCatalog] = useState<{ doctors: number | null; services: number | null }>({
    doctors: null,
    services: null,
  });

  const range = useMemo(() => dashboardPeriodRange(period, selectedDate, customRange), [period, selectedDate, customRange]);
  const query = useMemo(() => new URLSearchParams({
    fromDate: range.fromDate,
    toDate: range.toDate,
  }).toString(), [range.fromDate, range.toDate]);
  const analytics = useMemo(() => buildDashboardAnalytics(range.fromDate, range.toDate, appointmentRows, revenueRows), [range.fromDate, range.toDate, appointmentRows, revenueRows]);

  useEffect(() => () => { previewRequestId.current += 1; }, []);
  useEffect(() => () => { if (pdfPreview) URL.revokeObjectURL(pdfPreview.url); }, [pdfPreview]);

  async function openPdfPreview() {
    const requestId = ++previewRequestId.current;
    setPreviewLoading(true);
    try {
      let file: Blob | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          file = await getOverviewPdf(request, query);
          break;
        } catch (error) {
          if (!isTemporaryReportError(error) || attempt === 2) throw error;
          await new Promise((resolve) => window.setTimeout(resolve, (attempt + 1) * 500));
          if (requestId !== previewRequestId.current) return;
        }
      }
      if (requestId !== previewRequestId.current) return;
      if (!(file instanceof Blob) || file.type !== 'application/pdf') throw new Error('Tệp PDF trả về không hợp lệ.');
      const url = URL.createObjectURL(file);
      setPdfPreview({
        url,
        filename: `bao-cao-van-hanh-${range.fromDate}-${range.toDate}.pdf`,
        label: `${dayjs(range.fromDate).format('DD/MM/YYYY')} – ${dayjs(range.toDate).format('DD/MM/YYYY')}`,
      });
    } catch (error) {
      if (requestId === previewRequestId.current) void message.error(isTemporaryReportError(error)
        ? 'Không kết nối được dịch vụ PDF. Vui lòng thử lại.'
        : error instanceof Error ? error.message : 'Không thể xem trước báo cáo PDF.');
    } finally {
      if (requestId === previewRequestId.current) setPreviewLoading(false);
    }
  }

  function downloadPreview() {
    if (!pdfPreview) return;
    const link = document.createElement('a');
    link.href = pdfPreview.url;
    link.download = pdfPreview.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  useEffect(() => {
    let active = true;
    let retryTimer: number | undefined;
    setReportLoading(true);
    setReportError('');
    const load = async (attempt: number) => {
      try {
        const [response, appointments, revenue] = await Promise.all([
          getReportOverview(request, query),
          getAppointmentReport(request, query),
          getRevenueReport(request, query),
        ]);
        if (!active) return;
        const nested = response?.data;
        setReport(nested && typeof nested === 'object' && !Array.isArray(nested)
          ? nested as Record<string, unknown>
          : response);
        setAppointmentRows(reportRows(appointments));
        setRevenueRows(reportRows(revenue));
        setReportLoading(false);
      } catch (error) {
        if (!active) return;
        if (isTemporaryReportError(error) && attempt < RETRY_DELAYS_MS.length) {
          retryTimer = window.setTimeout(() => void load(attempt + 1), RETRY_DELAYS_MS[attempt]);
          return;
        }
        setReport(null);
        setAppointmentRows([]);
        setRevenueRows([]);
        setReportError(isTemporaryReportError(error)
          ? 'Dịch vụ báo cáo tạm thời chưa kết nối được. Vui lòng thử lại.'
          : error instanceof Error ? error.message : 'Không thể tải số liệu vận hành.');
        setReportLoading(false);
      }
    };
    void load(0);
    return () => { active = false; window.clearTimeout(retryTimer); };
  }, [request, query, retryKey]);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      RESOURCES.doctors.load(request),
      RESOURCES.services.load(request),
    ]).then(([doctors, services]) => {
      if (!active) return;
      setCatalog({
        doctors: doctors.status === 'fulfilled' ? doctors.value.length : null,
        services: services.status === 'fulfilled' ? services.value.length : null,
      });
    });
    return () => { active = false; };
  }, [request]);

  return (
    <div className="admin-dashboard">
      <section className="admin-overview-surface" aria-labelledby="admin-overview-title">
        <div className="admin-overview-header">
          <div className="admin-overview-heading">
            <span className="admin-overview-heading-icon" aria-hidden="true"><BarChartOutlined /></span>
            <div>
              <h2 id="admin-overview-title">Số liệu vận hành</h2>
              <p>{range.fromDate === range.toDate
                ? `Ngày ${dayjs(range.fromDate).format('DD/MM/YYYY')}`
                : `${dayjs(range.fromDate).format('DD/MM/YYYY')} – ${dayjs(range.toDate).format('DD/MM/YYYY')}`} · Theo sự kiện ghi nhận</p>
            </div>
          </div>
          <div className="admin-overview-controls" aria-label="Chọn kỳ thống kê">
            <Segmented
              aria-label="Đơn vị thời gian"
              options={PERIOD_OPTIONS}
              value={period}
              onChange={(value) => setPeriod(value as DashboardPeriod)}
            />
            {period === 'range' ? <DatePicker.RangePicker
              className="admin-overview-picker admin-overview-range-picker"
              classNames={{ popup: { root: 'admin-overview-range-dropdown' } }}
              placement="bottomLeft"
              value={customRange}
              format="DD/MM/YYYY"
              allowClear={false}
              inputReadOnly
              onChange={(dates) => { if (dates?.[0] && dates?.[1]) setCustomRange([dates[0], dates[1]]); }}
            /> : <DatePicker
              className="admin-overview-picker"
              picker={period === 'day' ? 'date' : period}
              value={selectedDate}
              format={(value) => dashboardPeriodRange(period, value).label}
              placeholder={period === 'day' ? 'Chọn ngày' : period === 'week' ? 'Chọn tuần' : 'Chọn quý'}
              allowClear={false}
              inputReadOnly
              onChange={(value) => { if (value) setSelectedDate(value); }}
            />}
            <Button icon={<EyeOutlined />} loading={previewLoading} disabled={reportLoading || !!reportError} onClick={() => void openPdfPreview()}>Xem trước PDF</Button>
          </div>
        </div>
        {reportError && <Alert type="warning" showIcon title="Không tải được số liệu cho kỳ đã chọn" description={reportError} action={<Button size="small" onClick={() => setRetryKey((key) => key + 1)}>Thử lại</Button>} />}
        <div className="admin-overview-metrics" aria-live="polite" aria-busy={reportLoading}>
          {METRICS.map((metric) => (
            <article className="admin-overview-metric" key={metric.key}>
              <span className={`admin-overview-metric-icon tone-${metric.tone}`} aria-hidden="true">{metric.icon}</span>
              <div>
                <span className="admin-overview-metric-label">{metric.label}</span>
                <strong className="admin-overview-metric-value">
                  {reportLoading ? <Skeleton.Input active size="small" /> : formatMetric(report, metric.key)}
                </strong>
              </div>
            </article>
          ))}
        </div>
        <div className="admin-overview-insights" aria-live="polite">
          <div><span>Đặt lịch trung bình/ngày</span><strong>{reportLoading || !report ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(analytics.averageBookedPerDay)}</strong></div>
          <div><span>Ngày đặt lịch cao nhất</span><strong>{reportLoading || !report || !analytics.peakDay ? '—' : `${dayjs(analytics.peakDay[0]).format('DD/MM')} · ${new Intl.NumberFormat('vi-VN').format(analytics.peakDay[1])}`}</strong></div>
          <div><span>Giao dịch thanh toán</span><strong>{reportLoading || !report ? '—' : new Intl.NumberFormat('vi-VN').format(analytics.transactions)}</strong></div>
          <div><span>Thu bình quân/giao dịch</span><strong>{reportLoading || !report || !analytics.transactions ? '—' : formatMoneyMinor(Math.round(analytics.averageCollectedPerTransaction), 'VND')}</strong></div>
        </div>
      </section>

      {!reportLoading && !reportError && <DashboardCharts buckets={analytics.buckets} weekdayBookings={analytics.weekdayBookings} activeBookingDays={analytics.activeBookingDays} />}

      <section className="admin-overview-secondary" aria-label="Danh mục và truy cập nhanh">
        <div className="admin-overview-catalog">
          <h2>Danh mục hệ thống</h2>
          <div className="admin-overview-catalog-row">
            <span className="admin-overview-catalog-icon tone-blue" aria-hidden="true"><MedicineBoxOutlined /></span>
            <span>Bác sĩ</span>
            <strong>{catalog.doctors === null ? '—' : new Intl.NumberFormat('vi-VN').format(catalog.doctors)}</strong>
          </div>
          <div className="admin-overview-catalog-row">
            <span className="admin-overview-catalog-icon tone-green" aria-hidden="true"><ProfileOutlined /></span>
            <span>Dịch vụ khám</span>
            <strong>{catalog.services === null ? '—' : new Intl.NumberFormat('vi-VN').format(catalog.services)}</strong>
          </div>
        </div>
        <div className="admin-overview-access">
          <h2>Truy cập nhanh</h2>
          <div className="admin-overview-shortcuts">
            {SHORTCUTS.map((item) => (
              <AppLink key={item.href} href={`/workspace/admin/${item.href}`} className="admin-overview-shortcut">
                <span>{item.label}</span>
                <ArrowRightOutlined aria-hidden="true" />
              </AppLink>
            ))}
          </div>
        </div>
      </section>
      <Modal
        className="admin-pdf-preview-modal"
        title="Xem trước báo cáo vận hành"
        open={!!pdfPreview}
        onCancel={() => setPdfPreview(null)}
        width="min(96vw, 980px)"
        footer={<>
          <Button onClick={() => setPdfPreview(null)}>Đóng</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={downloadPreview}>Tải PDF</Button>
        </>}
      >
        {pdfPreview && <>
          <p className="admin-pdf-preview-meta">Kỳ báo cáo: {pdfPreview.label}</p>
          <iframe className="admin-pdf-preview-frame" src={pdfPreview.url} title={`Bản xem trước PDF ${pdfPreview.label}`} />
          <p className="admin-pdf-preview-fallback">Nếu trình duyệt không hiển thị PDF, <a href={pdfPreview.url} target="_blank" rel="noopener noreferrer">mở bản xem trước trong tab mới</a>.</p>
        </>}
      </Modal>
    </div>
  );
}
