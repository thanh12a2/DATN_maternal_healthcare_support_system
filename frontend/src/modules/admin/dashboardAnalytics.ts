import dayjs from 'dayjs';

export interface DailyReportRow {
  date: string;
  total?: number | string;
  completed?: number | string;
  cancelled?: number | string;
  collected?: number | string;
  transactions?: number | string;
}

export interface DashboardBucket {
  label: string;
  fromDate: string;
  toDate: string;
  booked: number;
  completed: number;
  cancelled: number;
  collected: number;
  transactions: number;
}

export interface WeekdayBooking {
  day: number;
  label: string;
  daysObserved: number;
  booked: number;
  average: number | null;
}

const numeric = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

export function buildDashboardAnalytics(
  fromDate: string,
  toDate: string,
  appointmentRows: DailyReportRow[],
  revenueRows: DailyReportRow[],
) {
  const first = dayjs(fromDate);
  const last = dayjs(toDate);
  const days = Math.max(1, last.diff(first, 'day') + 1);
  const unit = days <= 14 ? 'day' : days <= 112 ? 'week' : days <= 730 ? 'month' : days <= 2920 ? 'quarter' : 'year';
  const buckets: DashboardBucket[] = [];

  for (let cursor = first; !cursor.isAfter(last, 'day');) {
    let end = cursor;
    if (unit === 'week') end = cursor.add(6 - ((cursor.day() + 6) % 7), 'day');
    if (unit === 'month') end = cursor.endOf('month');
    if (unit === 'quarter') {
      end = cursor.startOf('year').add((Math.floor(cursor.month() / 3) + 1) * 3, 'month').subtract(1, 'day');
    }
    if (unit === 'year') end = cursor.endOf('year');
    if (end.isAfter(last, 'day')) end = last;

    const label = unit === 'day' ? cursor.format('DD/MM')
      : unit === 'week' ? `${cursor.format('DD/MM')} – ${end.format('DD/MM')}`
      : unit === 'month' ? cursor.format('MM/YYYY')
      : unit === 'quarter' ? `Q${Math.floor(cursor.month() / 3) + 1}/${cursor.year()}`
      : String(cursor.year());
    buckets.push({
      label, fromDate: cursor.format('YYYY-MM-DD'), toDate: end.format('YYYY-MM-DD'),
      booked: 0, completed: 0, cancelled: 0, collected: 0, transactions: 0,
    });
    cursor = end.add(1, 'day');
  }

  const dailyBooked = new Map<string, number>();
  for (const row of appointmentRows) {
    const bucket = buckets.find((item) => row.date >= item.fromDate && row.date <= item.toDate);
    if (!bucket) continue;
    bucket.booked += numeric(row.total);
    bucket.completed += numeric(row.completed);
    bucket.cancelled += numeric(row.cancelled);
    dailyBooked.set(row.date, (dailyBooked.get(row.date) ?? 0) + numeric(row.total));
  }

  let transactions = 0;
  let collected = 0;
  for (const row of revenueRows) {
    const bucket = buckets.find((item) => row.date >= item.fromDate && row.date <= item.toDate);
    if (!bucket) continue;
    const amount = numeric(row.collected);
    bucket.collected += amount;
    bucket.transactions += numeric(row.transactions);
    collected += amount;
    transactions += numeric(row.transactions);
  }

  const booked = buckets.reduce((sum, bucket) => sum + bucket.booked, 0);
  const peak = [...dailyBooked].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const weekdays: WeekdayBooking[] = [
    { day: 1, label: 'T2', daysObserved: 0, booked: 0, average: null },
    { day: 2, label: 'T3', daysObserved: 0, booked: 0, average: null },
    { day: 3, label: 'T4', daysObserved: 0, booked: 0, average: null },
    { day: 4, label: 'T5', daysObserved: 0, booked: 0, average: null },
    { day: 5, label: 'T6', daysObserved: 0, booked: 0, average: null },
    { day: 6, label: 'T7', daysObserved: 0, booked: 0, average: null },
    { day: 0, label: 'CN', daysObserved: 0, booked: 0, average: null },
  ];
  for (let date = first; !date.isAfter(last, 'day'); date = date.add(1, 'day')) {
    const weekday = weekdays.find((item) => item.day === date.day())!;
    weekday.daysObserved += 1;
    weekday.booked += dailyBooked.get(date.format('YYYY-MM-DD')) ?? 0;
  }
  for (const weekday of weekdays) {
    weekday.average = weekday.daysObserved ? weekday.booked / weekday.daysObserved : null;
  }

  return {
    buckets,
    days,
    averageBookedPerDay: booked / days,
    peakDay: peak?.[1] ? peak : null,
    activeBookingDays: [...dailyBooked.values()].filter((count) => count > 0).length,
    weekdayBookings: weekdays,
    transactions,
    averageCollectedPerTransaction: transactions ? collected / transactions : 0,
  };
}
