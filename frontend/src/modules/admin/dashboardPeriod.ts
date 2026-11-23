import type { Dayjs } from 'dayjs';

export type DashboardPeriod = 'day' | 'week' | 'quarter' | 'range';

export function dashboardPeriodRange(
  period: DashboardPeriod,
  selected: Dayjs,
  customRange?: [Dayjs, Dayjs],
) {
  const day = selected.startOf('day');
  let from = day;
  let to = day;
  let label = `Ngày ${day.format('DD/MM/YYYY')}`;

  if (period === 'week') {
    from = day.subtract((day.day() + 6) % 7, 'day');
    to = from.add(6, 'day');
    label = `Tuần ${from.format('DD/MM')} – ${to.format('DD/MM/YYYY')}`;
  } else if (period === 'quarter') {
    const quarter = Math.floor(day.month() / 3);
    from = day.startOf('year').add(quarter * 3, 'month');
    to = from.add(3, 'month').subtract(1, 'day');
    label = `Quý ${quarter + 1}/${day.year()}`;
  } else if (period === 'range' && customRange) {
    const [first, last] = customRange[0].isBefore(customRange[1])
      ? customRange
      : [customRange[1], customRange[0]];
    from = first.startOf('day');
    to = last.startOf('day');
    label = `${from.format('DD/MM/YYYY')} – ${to.format('DD/MM/YYYY')}`;
  }

  return {
    fromDate: from.format('YYYY-MM-DD'),
    toDate: to.format('YYYY-MM-DD'),
    label,
  };
}
