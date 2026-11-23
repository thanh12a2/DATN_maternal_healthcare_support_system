import { Injectable } from '@nestjs/common';
import * as path from 'node:path';
import { ReportingService } from './reporting.service';

// pdfmake's server API provides getBuffer for streaming a generated document.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');

type Metric = { businessDate: Date; measures: unknown };
type Bucket = { label: string; booked: number; completed: number; cancelled: number; collected: number; transactions: number };

const number = (value: unknown) => Number(value ?? 0) || 0;
const formatNumber = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
const dateLabel = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;

function buildBuckets(fromDate: string, toDate: string, appointmentRows: Metric[], revenueRows: Metric[]): Bucket[] {
  const days = Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86400000) + 1;
  const unit = days <= 14 ? 'day' : days <= 112 ? 'week' : days <= 730 ? 'month' : days <= 2920 ? 'quarter' : 'year';
  const buckets = new Map<string, Bucket>();
  const keyFor = (date: string) => {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (unit === 'day') return date;
    if (unit === 'week') {
      parsed.setUTCDate(parsed.getUTCDate() - ((parsed.getUTCDay() + 6) % 7));
      return parsed.toISOString().slice(0, 10);
    }
    if (unit === 'month') return date.slice(0, 7);
    if (unit === 'quarter') return `${date.slice(0, 4)}-Q${Math.floor(parsed.getUTCMonth() / 3) + 1}`;
    return date.slice(0, 4);
  };
  const cursor = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    const key = keyFor(date);
    if (!buckets.has(key)) buckets.set(key, { label: key, booked: 0, completed: 0, cancelled: 0, collected: 0, transactions: 0 });
    if (unit === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (unit === 'week') cursor.setUTCDate(cursor.getUTCDate() + 7);
    else if (unit === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    else if (unit === 'quarter') cursor.setUTCMonth(cursor.getUTCMonth() + 3, 1);
    else cursor.setUTCFullYear(cursor.getUTCFullYear() + 1, 0, 1);
  }
  const add = (row: Metric, field: keyof Pick<Bucket, 'booked' | 'completed' | 'cancelled' | 'collected' | 'transactions'>, source: string) => {
    const date = row.businessDate.toISOString().slice(0, 10);
    const bucket = buckets.get(keyFor(date));
    if (bucket) bucket[field] += number((row.measures as Record<string, unknown>)?.[source]);
  };
  for (const row of appointmentRows) {
    add(row, 'booked', 'total'); add(row, 'completed', 'completed'); add(row, 'cancelled', 'cancelled');
  }
  for (const row of revenueRows) { add(row, 'collected', 'collected'); add(row, 'transactions', 'transactions'); }
  return [...buckets.values()];
}

function compactBuckets(buckets: Bucket[]): Bucket[] {
  const groupSize = Math.ceil(buckets.length / 24);
  return groupSize <= 1 ? buckets : Array.from({ length: Math.ceil(buckets.length / groupSize) }, (_, index) => {
    const group = buckets.slice(index * groupSize, (index + 1) * groupSize);
    return {
      label: `${group[0].label}–${group[group.length - 1].label}`,
      booked: group.reduce((sum, bucket) => sum + bucket.booked, 0),
      completed: group.reduce((sum, bucket) => sum + bucket.completed, 0),
      cancelled: group.reduce((sum, bucket) => sum + bucket.cancelled, 0),
      collected: group.reduce((sum, bucket) => sum + bucket.collected, 0),
      transactions: group.reduce((sum, bucket) => sum + bucket.transactions, 0),
    };
  });
}

function chartSvg(buckets: Bucket[], field: 'booked', color: string): string {
  const visible = compactBuckets(buckets);
  const max = Math.max(1, ...visible.map((bucket) => bucket[field]));
  const height = 54 + visible.length * 21;
  const bars = visible.map((bucket, index) => {
    const y = 33 + index * 21;
    const width = Math.max(0, Math.round(bucket[field] / max * 250));
    return `<text x="2" y="${y + 10}" font-size="9" fill="#42556f">${bucket.label}</text><rect x="110" y="${y}" width="250" height="13" rx="3" fill="#eef3f9"/><rect x="110" y="${y}" width="${width}" height="13" rx="3" fill="${color}"/><text x="368" y="${y + 10}" font-size="9" fill="#102e52">${formatNumber(bucket[field])}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="${height}" viewBox="0 0 480 ${height}">${bars}</svg>`;
}

function trendSvg(buckets: Bucket[], type: 'revenue' | 'average'): string {
  const visible = compactBuckets(buckets);
  const values = visible.map((bucket) => type === 'revenue' ? bucket.collected : bucket.transactions ? bucket.collected / bucket.transactions : null);
  const max = Math.max(1, ...values.map((value) => value ?? 0));
  const x = (index: number) => visible.length === 1 ? 250 : 42 + index * 416 / (visible.length - 1);
  const y = (value: number) => 148 - value / max * 105;
  const points = values.map((value, index) => ({ x: x(index), y: y(value ?? 0), value }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const fill = points.length ? `${line} L ${points.at(-1)!.x} 148 L ${points[0].x} 148 Z` : '';
  const marks = points.map((point) => point.value === null ? '' : type === 'average'
    ? `<line x1="${point.x}" y1="148" x2="${point.x}" y2="${point.y}" stroke="#7350d1" stroke-width="2"/><circle cx="${point.x}" cy="${point.y}" r="4" fill="#7350d1"/>`
    : `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#0da681"/>`).join('');
  const labelStep = Math.max(1, Math.ceil(visible.length / 6));
  const labels = visible.map((bucket, index) => index % labelStep === 0 || index === visible.length - 1
    ? `<text x="${x(index)}" y="170" text-anchor="middle" font-size="8" fill="#536b83">${bucket.label.replace(/^\d{4}-/, '')}</text>` : '').join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="185" viewBox="0 0 480 185"><line x1="35" y1="148" x2="465" y2="148" stroke="#cbd8e6"/><line x1="35" y1="95" x2="465" y2="95" stroke="#e7eef5" stroke-dasharray="3,4"/>${type === 'revenue' ? `<path d="${fill}" fill="#d8f5ed"/><path d="${line}" fill="none" stroke="#0da681" stroke-width="3"/>` : ''}${marks}${labels}</svg>`;
}

@Injectable()
export class ReportingPdfService {
  constructor(private readonly reporting: ReportingService) {}

  async overview(fromDate: string, toDate: string): Promise<Buffer> {
    const [appointments, revenue] = await Promise.all([
      this.reporting.rows('APPOINTMENT_DAILY', fromDate, toDate),
      this.reporting.rows('REVENUE_DAILY', fromDate, toDate),
    ]);
    const get = (row: Metric, key: string) => number((row.measures as Record<string, unknown>)?.[key]);
    const sum = (rows: Metric[], key: string) => rows.reduce((total, row) => total + get(row, key), 0);
    const booked = sum(appointments, 'total');
    const completed = sum(appointments, 'completed');
    const cancelled = sum(appointments, 'cancelled');
    const collected = sum(revenue, 'collected');
    const transactions = sum(revenue, 'transactions');
    const days = Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86400000) + 1;
    const peak = appointments.reduce<{ date: string; count: number } | null>((best, row) => {
      const candidate = { date: row.businessDate.toISOString().slice(0, 10), count: get(row, 'total') };
      return candidate.count > (best?.count ?? 0) ? candidate : best;
    }, null);
    const buckets = buildBuckets(fromDate, toDate, appointments, revenue);
    const fontDir = path.join(process.cwd(), 'assets', 'fonts');
    const allowedFonts = new Set([
      path.resolve(fontDir, 'BeVietnamPro-Regular.ttf'),
      path.resolve(fontDir, 'BeVietnamPro-Bold.ttf'),
    ]);
    pdfmake.setUrlAccessPolicy(() => false);
    pdfmake.setLocalAccessPolicy((file: string) => allowedFonts.has(path.resolve(file)));
    pdfmake.setFonts({ BeVietnamPro: {
      normal: path.join(fontDir, 'BeVietnamPro-Regular.ttf'),
      bold: path.join(fontDir, 'BeVietnamPro-Bold.ttf'),
      italics: path.join(fontDir, 'BeVietnamPro-Regular.ttf'),
      bolditalics: path.join(fontDir, 'BeVietnamPro-Bold.ttf'),
    } });
    const summary = [
      ['Lịch được đặt', formatNumber(booked), 'Lịch hoàn thành', formatNumber(completed)],
      ['Lịch đã hủy', formatNumber(cancelled), 'Doanh thu đã thu', `${formatNumber(collected)} đ`],
      ['Đặt lịch trung bình/ngày', new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(booked / days), 'Giao dịch thanh toán', formatNumber(transactions)],
      ['Thu bình quân/giao dịch', transactions ? `${formatNumber(Math.round(collected / transactions))} đ` : '—', 'Ngày đặt lịch cao nhất', peak ? `${dateLabel(peak.date)} · ${formatNumber(peak.count)}` : '—'],
    ];
    const statusMax = Math.max(1, booked, completed, cancelled);
    const statusRows = [
      ['Đặt mới', booked, '#2474d2'],
      ['Hoàn thành', completed, '#12a984'],
      ['Đã hủy', cancelled, '#f2a536'],
    ] as const;
    const doc = {
      pageSize: 'A4', pageMargins: [42, 42, 42, 42], defaultStyle: { font: 'BeVietnamPro', fontSize: 9, color: '#193755' },
      content: [
        { text: 'BÁO CÁO VẬN HÀNH', style: 'title' },
        { text: `Kỳ báo cáo: ${dateLabel(fromDate)} – ${dateLabel(toDate)} (${formatNumber(days)} ngày)`, margin: [0, 2, 0, 14], color: '#5e7084' },
        { text: 'Chỉ số chính', style: 'section' },
        { table: { widths: ['*', 'auto', '*', 'auto'], body: summary.map((row) => row.map((cell, index) => ({ text: cell, bold: index % 2 === 1, margin: [4, 6, 4, 6] }))) }, layout: 'lightHorizontalLines' },
        { text: 'Xu hướng đặt lịch', style: 'section', margin: [0, 18, 0, 4] },
        { svg: chartSvg(buckets, 'booked', '#2474d2'), width: 480 },
        { text: 'Xu hướng doanh thu đã thu (VND)', style: 'section', margin: [0, 16, 0, 4], pageBreak: buckets.length > 15 ? 'before' : undefined },
        { svg: trendSvg(buckets, 'revenue'), width: 480 },
        { text: 'So sánh hoạt động lịch hẹn', style: 'section', margin: [0, 16, 0, 8], pageBreak: 'before' },
        { table: { widths: [110, 260, 70], body: statusRows.map(([label, count, color]) => [
          { text: label, margin: [0, 6, 0, 6] },
          { canvas: [
            { type: 'rect', x: 0, y: 0, w: 250, h: 14, r: 5, color: '#eef3f9' },
            { type: 'rect', x: 0, y: 0, w: count / statusMax * 250, h: 14, r: 5, color },
          ], margin: [0, 6, 0, 6] },
          { text: formatNumber(count), bold: true, alignment: 'right', margin: [0, 6, 0, 6] },
        ]) }, layout: 'noBorders' },
        { text: 'Thu bình quân mỗi giao dịch theo khoảng (VND)', style: 'section', margin: [0, 22, 0, 4] },
        { svg: trendSvg(buckets, 'average'), width: 480 },
        { text: 'Số liệu phản ánh sự kiện phát sinh trong kỳ: đặt lịch, hoàn thành, hủy lịch và ghi nhận thanh toán. Các nhóm có thể thuộc những lịch hẹn khác nhau.', fontSize: 8, color: '#66788a', margin: [0, 14, 0, 0] },
      ],
      styles: { title: { fontSize: 17, bold: true, color: '#0b3565' }, section: { fontSize: 11, bold: true, color: '#0b3565' } },
      footer: (page: number, count: number) => ({ text: `${page} / ${count}`, alignment: 'right', margin: [0, 0, 42, 0], fontSize: 8, color: '#8798a9' }),
    };
    return pdfmake.createPdf(doc).getBuffer();
  }
}
