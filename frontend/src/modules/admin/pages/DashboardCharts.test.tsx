import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildDashboardAnalytics } from '../dashboardAnalytics';
import { DashboardCharts } from './DashboardCharts';

describe('DashboardCharts', () => {
  it('shows four chart types using the selected report range', () => {
    const analytics = buildDashboardAnalytics('2026-11-20', '2026-11-22', [
      { date: '2026-11-20', total: 2, completed: 1 },
      { date: '2026-11-22', total: 3, cancelled: 1 },
    ], [{ date: '2026-11-22', collected: 350000, transactions: 2 }]);
    render(<DashboardCharts buckets={analytics.buckets} weekdayBookings={analytics.weekdayBookings} activeBookingDays={analytics.activeBookingDays} />);

    expect(screen.getByRole('region', { name: 'Biểu đồ xu hướng lịch hẹn' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Biểu đồ doanh thu đã thu' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Biểu đồ so sánh trạng thái lịch hẹn' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Biểu đồ giá trị trung bình mỗi giao dịch' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Số lịch đặt trung bình theo từng thứ trong tuần' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Giá trị trung bình của các giao dịch thanh toán' }).querySelector('circle title')?.textContent)
      .toBe('22/11: 175.000 đ / 2 giao dịch');
    expect(screen.getByText('350 k đ')).toBeTruthy();
    fireEvent.click(screen.getByText('Xem số liệu chi tiết theo kỳ'));
    const lastRow = screen.getByRole('row', { name: /22\/11/ });
    expect(lastRow.textContent).toContain('350.000 đ');
    expect(lastRow.textContent).toContain('175.000 đ');
  });
});
