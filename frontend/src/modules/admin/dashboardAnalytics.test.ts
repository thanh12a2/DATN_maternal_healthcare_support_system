import { describe, expect, it } from 'vitest';
import { buildDashboardAnalytics } from './dashboardAnalytics';

describe('dashboard analytics', () => {
  it('aggregates inclusive daily data and computes useful averages', () => {
    const result = buildDashboardAnalytics('2026-11-20', '2026-11-22', [
      { date: '2026-11-20', total: 2, completed: 1 },
      { date: '2026-11-22', total: 4, cancelled: 1 },
    ], [{ date: '2026-11-22', collected: 350000, transactions: 2 }]);
    expect(result.buckets).toHaveLength(3);
    expect(result.buckets[1]).toMatchObject({ booked: 0, collected: 0, transactions: 0 });
    expect(result.buckets[2]).toMatchObject({ collected: 350000, transactions: 2 });
    expect(result.averageBookedPerDay).toBe(2);
    expect(result.peakDay).toEqual(['2026-11-22', 4]);
    expect(result.transactions).toBe(2);
    expect(result.averageCollectedPerTransaction).toBe(175000);
    expect(result.activeBookingDays).toBe(2);
    expect(result.weekdayBookings.find((item) => item.label === 'T6')).toMatchObject({ booked: 2, daysObserved: 1, average: 2 });
    expect(result.weekdayBookings.find((item) => item.label === 'CN')).toMatchObject({ booked: 4, daysObserved: 1, average: 4 });
  });

  it('groups a longer range by week without discarding boundary days', () => {
    const result = buildDashboardAnalytics('2026-12-28', '2027-01-15', [
      { date: '2026-12-28', total: 3 },
      { date: '2027-01-15', total: 5 },
    ], []);
    expect(result.buckets.reduce((sum, row) => sum + row.booked, 0)).toBe(8);
    expect(result.buckets.at(-1)?.toDate).toBe('2027-01-15');
  });

  it('marks unobserved weekdays as unavailable for a single-day range', () => {
    const result = buildDashboardAnalytics('2026-11-22', '2026-11-22', [{ date: '2026-11-22', total: 3 }], []);
    expect(result.weekdayBookings.find((item) => item.label === 'CN')?.average).toBe(3);
    expect(result.weekdayBookings.find((item) => item.label === 'T2')?.average).toBeNull();
  });
});
