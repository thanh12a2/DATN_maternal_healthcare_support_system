import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { dashboardPeriodRange } from './dashboardPeriod';

describe('dashboard reporting periods', () => {
  it('requests exactly the selected day', () => {
    expect(dashboardPeriodRange('day', dayjs('2026-11-22'))).toMatchObject({
      fromDate: '2026-11-22',
      toDate: '2026-11-22',
    });
  });

  it('uses Monday through Sunday even when a week crosses the year boundary', () => {
    expect(dashboardPeriodRange('week', dayjs('2027-01-01'))).toMatchObject({
      fromDate: '2026-12-28',
      toDate: '2027-01-03',
    });
  });

  it('covers the full calendar quarter containing the selected date', () => {
    expect(dashboardPeriodRange('quarter', dayjs('2026-11-22'))).toMatchObject({
      fromDate: '2026-10-01',
      toDate: '2026-12-31',
      label: 'Quý 4/2026',
    });
  });

  it('uses both inclusive dates for a custom range across months', () => {
    expect(dashboardPeriodRange('range', dayjs('2026-11-22'), [
      dayjs('2026-09-29'), dayjs('2026-10-03'),
    ])).toMatchObject({
      fromDate: '2026-09-29',
      toDate: '2026-10-03',
    });
  });
});
