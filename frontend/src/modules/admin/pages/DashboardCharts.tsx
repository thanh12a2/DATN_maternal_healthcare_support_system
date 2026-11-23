import type { DashboardBucket, WeekdayBooking } from '../dashboardAnalytics';

const formatCount = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
const formatAverage = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
const formatRevenue = (value: number) => {
  if (value >= 1_000_000_000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} tỷ`;
  if (value >= 1_000_000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value / 1_000_000)} tr`;
  if (value >= 1_000) return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value / 1_000)} k`;
  return formatCount(value);
};

function TrendChart({ buckets, type }: { buckets: DashboardBucket[]; type: 'revenue' | 'average' }) {
  const width = Math.max(470, buckets.length * 76);
  const height = 174;
  const bottom = 146;
  const values = buckets.map((item) => type === 'revenue'
    ? item.collected
    : item.transactions ? item.collected / item.transactions : null);
  const max = Math.max(1, ...values.map((value) => value ?? 0));
  const x = (index: number) => buckets.length === 1 ? (width + 36) / 2 : 54 + index * (width - 80) / (buckets.length - 1);
  const y = (value: number) => bottom - value / max * 104;
  const points = values.map((value, index) => ({ value, x: x(index), y: y(value ?? 0) }));
  const line = type === 'revenue' ? points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ') : '';
  const area = type === 'revenue' && points.length ? `${line} L ${points.at(-1)!.x} ${bottom} L ${points[0].x} ${bottom} Z` : '';
  const label = type === 'revenue' ? 'Đường xu hướng doanh thu đã thu' : 'Giá trị trung bình của các giao dịch thanh toán';

  return <div className="admin-chart-scroll">
    <div className="admin-trend-plot" style={{ minWidth: width }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {[0, 0.5, 1].map((fraction) => <g key={fraction}>
          <line x1="52" x2={width - 24} y1={y(max * fraction)} y2={y(max * fraction)} className={fraction === 0 ? 'admin-trend-axis' : 'admin-trend-grid'} />
          <text x="45" y={y(max * fraction) + 4} textAnchor="end" className="admin-trend-tick">{formatRevenue(max * fraction)}</text>
        </g>)}
        {type === 'revenue' && <>
          <path d={area} className="admin-trend-area" />
          <path d={line} className="admin-trend-line" />
        </>}
        {points.map((point, index) => point.value === null ? null : <g key={buckets[index].fromDate}>
          {type === 'average' && <line x1={point.x} x2={point.x} y1={bottom} y2={point.y} className="admin-trend-stem" />}
          <circle cx={point.x} cy={point.y} r={type === 'average' ? 5 : 4} className={type === 'average' ? 'admin-trend-dot average' : 'admin-trend-dot'}>
            <title>{`${buckets[index].label}: ${formatCount(Math.round(point.value))} đ${type === 'average' ? ` / ${formatCount(buckets[index].transactions)} giao dịch` : ''}`}</title>
          </circle>
          <text x={point.x} y={Math.max(23, point.y - 9)} textAnchor="middle" className="admin-trend-value">{formatRevenue(point.value)}</text>
        </g>)}
      </svg>
      <div className="admin-trend-labels">{buckets.map((item) => <span key={item.fromDate} title={item.label}>{item.label}</span>)}</div>
    </div>
  </div>;
}

function WeekdayChart({ weekdays }: { weekdays: WeekdayBooking[] }) {
  const max = Math.max(1, ...weekdays.map((item) => item.average ?? 0));
  const y = (value: number) => 144 - value / max * 108;
  return <div className="admin-weekday-chart">
    <svg viewBox="0 0 470 190" role="img" aria-label="Số lịch đặt trung bình theo từng thứ trong tuần">
      {[0, 0.5, 1].map((fraction) => <g key={fraction}>
        <line x1="50" x2="458" y1={y(max * fraction)} y2={y(max * fraction)} className={fraction === 0 ? 'admin-trend-axis' : 'admin-trend-grid'} />
        <text x="42" y={y(max * fraction) + 4} textAnchor="end" className="admin-trend-tick">{formatAverage(max * fraction)}</text>
      </g>)}
      {weekdays.map((item, index) => {
        const x = 64 + index * 56;
        return <g key={item.day}>
          {item.average !== null && <>
            <rect x={x} y={y(item.average)} width="24" height={144 - y(item.average)} rx="5" className="admin-weekday-bar">
              <title>{`${item.label}: ${formatAverage(item.average)} lịch/ngày; ${formatCount(item.booked)} lịch trong ${item.daysObserved} ngày`}</title>
            </rect>
            <text x={x + 12} y={Math.max(27, y(item.average) - 7)} textAnchor="middle" className="admin-trend-value">{formatAverage(item.average)}</text>
          </>}
          {item.average === null && <text x={x + 12} y="137" textAnchor="middle" className="admin-trend-tick">—</text>}
          <text x={x + 12} y="167" textAnchor="middle" className="admin-weekday-label">{item.label}</text>
        </g>;
      })}
    </svg>
  </div>;
}

export function DashboardCharts({ buckets, weekdayBookings, activeBookingDays }: { buckets: DashboardBucket[]; weekdayBookings: WeekdayBooking[]; activeBookingDays: number }) {
  const maxCount = Math.max(1, ...buckets.map((item) => Math.max(item.booked, item.completed, item.cancelled)));
  const hasAppointments = buckets.some((item) => item.booked || item.completed || item.cancelled);
  const hasRevenue = buckets.some((item) => item.collected);
  const hasTransactions = buckets.some((item) => item.transactions);
  const totals = [
    { key: 'booked', label: 'Đặt mới', count: buckets.reduce((sum, item) => sum + item.booked, 0) },
    { key: 'completed', label: 'Hoàn thành', count: buckets.reduce((sum, item) => sum + item.completed, 0) },
    { key: 'cancelled', label: 'Đã hủy', count: buckets.reduce((sum, item) => sum + item.cancelled, 0) },
  ];
  const maxStatus = Math.max(1, ...totals.map((item) => item.count));

  return (
    <div className="admin-overview-charts">
      <section className="admin-overview-chart" aria-label="Biểu đồ xu hướng lịch hẹn">
        <div className="admin-overview-chart-heading">
          <div><h3>Xu hướng lịch hẹn</h3><p>Sự kiện phát sinh theo khoảng thời gian</p></div>
          <div className="admin-chart-legend"><span className="booked">Đặt mới</span><span className="completed">Hoàn thành</span><span className="cancelled">Hủy</span></div>
        </div>
        {hasAppointments ? <div className="admin-chart-plot">
          <div className="admin-chart-y-axis" aria-label="Trục Y: số sự kiện">
            <span>{formatCount(maxCount)}</span><span>{formatAverage(maxCount / 2)}</span><span>0</span>
          </div>
          <div className="admin-chart-scroll"><div className="admin-chart-columns" style={{ minWidth: `${Math.max(470, buckets.length * 76)}px` }}>
          {buckets.map((item) => (
            <div className="admin-chart-column" key={item.fromDate}>
              <div className="admin-chart-bars">
                {([['booked', item.booked], ['completed', item.completed], ['cancelled', item.cancelled]] as const).map(([kind, value]) => (
                  <div key={kind} className={`admin-chart-bar ${kind}`} style={{ height: `${Math.max(value ? 4 : 0, value / maxCount * 100)}%` }} title={`${item.label}: ${formatCount(value)}`} />
                ))}
              </div><span className="admin-chart-xlabel" title={item.label}>{item.label}</span>
              <span className="admin-chart-series-values" aria-label={`${item.label}: đặt ${item.booked}, hoàn thành ${item.completed}, hủy ${item.cancelled}`}>
                <b className="booked">{formatCount(item.booked)}</b><b className="completed">{formatCount(item.completed)}</b><b className="cancelled">{formatCount(item.cancelled)}</b>
              </span>
            </div>
          ))}
        </div></div></div> : <p className="admin-chart-empty">Chưa có dữ liệu trong kỳ này.</p>}
      </section>
      <section className="admin-overview-chart" aria-label="Biểu đồ doanh thu đã thu">
        <div className="admin-overview-chart-heading"><div><h3>Doanh thu đã thu</h3><p>Tiền ghi nhận thanh toán · VND</p></div><strong className="admin-chart-total">{formatRevenue(buckets.reduce((sum, item) => sum + item.collected, 0))} đ</strong></div>
        {hasRevenue ? <TrendChart buckets={buckets} type="revenue" /> : <p className="admin-chart-empty">Chưa có doanh thu trong kỳ này.</p>}
      </section>
      <section className="admin-overview-chart" aria-label="Biểu đồ so sánh trạng thái lịch hẹn">
        <div className="admin-overview-chart-heading"><div><h3>So sánh hoạt động lịch hẹn</h3><p>Số sự kiện đặt, hoàn thành và hủy phát sinh trong kỳ</p></div></div>
        {hasAppointments ? <div className="admin-status-bars">{totals.map((item) => <div className="admin-status-row" key={item.key}>
          <span>{item.label}</span>
          <div className="admin-status-track"><div className={`admin-status-fill ${item.key}`} style={{ width: `${item.count / maxStatus * 100}%` }} /></div>
          <strong>{formatCount(item.count)}</strong>
        </div>)}</div> : <p className="admin-chart-empty">Chưa có dữ liệu lịch hẹn trong kỳ này.</p>}
      </section>
      <section className="admin-overview-chart" aria-label="Biểu đồ giá trị trung bình mỗi giao dịch">
        <div className="admin-overview-chart-heading"><div><h3>Thu bình quân mỗi giao dịch</h3><p>Giá trị thanh toán theo từng khoảng · VND</p></div></div>
        {hasTransactions ? <TrendChart buckets={buckets} type="average" /> : <p className="admin-chart-empty">Chưa có giao dịch thanh toán trong kỳ này.</p>}
      </section>
      <section className="admin-overview-chart admin-overview-chart-wide" aria-label="Biểu đồ đặt lịch trung bình theo thứ">
        <div className="admin-overview-chart-heading"><div><h3>Ngày nào thường nhiều lịch đặt?</h3><p>Trung bình số lịch đặt trên mỗi ngày của từng thứ trong kỳ · lịch/ngày</p></div><strong className="admin-chart-total">{formatCount(activeBookingDays)} ngày có lịch</strong></div>
        {activeBookingDays > 0 ? <WeekdayChart weekdays={weekdayBookings} /> : <p className="admin-chart-empty">Chưa có lịch đặt trong kỳ này.</p>}
      </section>
      <details className="admin-chart-data">
        <summary>Xem số liệu chi tiết theo kỳ</summary>
        <div className="admin-chart-data-scroll">
          <table>
            <thead><tr><th scope="col">Khoảng thời gian</th><th scope="col">Đặt mới</th><th scope="col">Hoàn thành</th><th scope="col">Đã hủy</th><th scope="col">Đã thu</th><th scope="col">Giao dịch</th><th scope="col">Bình quân/giao dịch</th></tr></thead>
            <tbody>{buckets.map((item) => <tr key={item.fromDate}>
              <th scope="row">{item.label}</th>
              <td>{formatCount(item.booked)}</td><td>{formatCount(item.completed)}</td><td>{formatCount(item.cancelled)}</td>
              <td>{formatCount(item.collected)} đ</td><td>{formatCount(item.transactions)}</td>
              <td>{item.transactions ? `${formatCount(Math.round(item.collected / item.transactions))} đ` : '—'}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p>Đặt mới, hoàn thành và hủy là số sự kiện phát sinh trong kỳ; các sự kiện có thể thuộc những lịch hẹn khác nhau. Doanh thu là tiền thanh toán đã ghi nhận.</p>
      </details>
    </div>
  );
}
