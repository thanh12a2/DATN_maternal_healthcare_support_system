import { ReportingPdfService } from './reporting-pdf.service';
import { ReportingService } from './reporting.service';

describe('ReportingPdfService', () => {
  it('creates a downloadable PDF with reporting metrics', async () => {
    const rows = jest.fn(async (type: string) => type === 'APPOINTMENT_DAILY'
      ? [{ businessDate: new Date('2026-11-20T00:00:00Z'), measures: { total: 5, completed: 3, cancelled: 1 } }]
      : [{ businessDate: new Date('2026-11-20T00:00:00Z'), measures: { collected: 350000, transactions: 1 } }]);
    const service = new ReportingPdfService({ rows } as unknown as ReportingService);
    const file = await service.overview('2026-11-20', '2026-11-22');
    expect(file.subarray(0, 5).toString()).toBe('%PDF-');
    expect(file.length).toBeGreaterThan(10_000);
    expect(rows).toHaveBeenCalledWith('APPOINTMENT_DAILY', '2026-11-20', '2026-11-22');
    expect(rows).toHaveBeenCalledWith('REVENUE_DAILY', '2026-11-20', '2026-11-22');
  });

  it('renders a multi-year range without dropping the PDF chart', async () => {
    const rows = jest.fn(async (type: string) => type === 'APPOINTMENT_DAILY'
      ? [{ businessDate: new Date('2026-11-20T00:00:00Z'), measures: { total: 2 } }]
      : []);
    const service = new ReportingPdfService({ rows } as unknown as ReportingService);
    const file = await service.overview('2019-01-01', '2026-12-31');
    expect(file.subarray(0, 5).toString()).toBe('%PDF-');
    expect(file.length).toBeGreaterThan(10_000);
  });
});
