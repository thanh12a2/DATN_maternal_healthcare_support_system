import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminAuditLogsPage } from './AdminAuditLogsPage';
import { AdminSystemHealthPage } from './AdminSystemHealthPage';

vi.mock('../../app/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    user: { id: 'admin-1', email: 'admin@antam.vn', role: 'ADMIN' },
    request: vi.fn().mockImplementation((path: string) => {
      if (path.includes('/api/audit-logs/stats')) {
        return Promise.resolve({ totalLogs: 24, todayLogs: 5, topActions: [] });
      }
      if (path.includes('/api/audit-logs/system/health')) {
        return Promise.resolve({
          overallStatus: 'OPERATIONAL',
          totalServices: 17,
          healthyCount: 17,
          degradedCount: 0,
          downCount: 0,
          uptimePercentage: 100,
          lastCheckedAt: new Date().toISOString(),
          services: [
            {
              id: 'service-catalog-service',
              name: 'service-catalog-service',
              displayName: 'Danh mục Dịch vụ & Biểu phí (Catalog Service)',
              host: 'service-catalog-service',
              port: 5007,
              category: 'core',
              description: 'Bảng giá viện phí, dịch vụ khám chữa bệnh.',
              status: 'HEALTHY',
              statusCode: 200,
              responseTimeMs: 8,
              lastCheckedAt: new Date().toISOString(),
            },
          ],
        });
      }
      if (path.includes('/api/audit-logs/system/backups')) {
        return Promise.resolve({
          items: [
            {
              id: 'BKP-20261023-0001',
              target: 'Tất cả 17 cụm Postgres',
              type: 'FULL_DATABASE',
              status: 'COMPLETED',
              sizeBytes: 154823901,
              sizeFormatted: '147.6 MB',
              durationSeconds: 14,
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              storageLocation: 's3://an-tam-backup',
              checksumSha256: 'abc123',
              triggeredBy: 'SYSTEM_CRON',
            },
          ],
          lastBackup: null,
        });
      }
      if (path.includes('/api/audit-logs')) {
        return Promise.resolve({
          items: [
            {
              id: 'log-1',
              eventId: 'evt-1',
              eventType: 'SERVICE_PRICE_UPDATED',
              sourceService: 'service-catalog-service',
              aggregateType: 'SERVICE_PRICING',
              aggregateId: 'srv-1',
              actorId: 'admin-1',
              actorType: 'ADMIN',
              action: 'SERVICE_PRICE_UPDATED',
              result: 'SUCCESS',
              changedFields: ['priceMinor'],
              sensitivity: 'STANDARD',
              ipAddress: '192.168.1.45',
              metadata: {
                actorEmail: 'admin@antam.vn',
                serviceName: 'Khám thai định kỳ VIP',
                oldPrice: '300,000 VND',
                newPrice: '350,000 VND',
              },
              occurredAt: new Date().toISOString(),
              ingestedAt: new Date().toISOString(),
            },
          ],
          total: 1,
          page: 1,
          pageSize: 10,
          totalPages: 1,
        });
      }
      return Promise.resolve({});
    }),
  }),
}));

describe('AdminAuditLogsPage & AdminSystemHealthPage', () => {
  it('renders AdminAuditLogsPage with audit stats and audit records', async () => {
    render(<AdminAuditLogsPage />);
    expect(await screen.findByText('Tổng lượt kiểm toán hệ thống')).toBeInTheDocument();
    expect(await screen.findByText('Khám thai định kỳ VIP (300,000 VND ➔ 350,000 VND)')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.45')).toBeInTheDocument();
  });

  it('renders AdminSystemHealthPage with 17 microservices probing and backup manager', async () => {
    render(<AdminSystemHealthPage />);
    expect(await screen.findByText(/17 Microservices Cluster/i)).toBeInTheDocument();
    expect(await screen.findByText('Danh mục Dịch vụ & Biểu phí (Catalog Service)')).toBeInTheDocument();
    expect(screen.getByText('Tạo bản sao lưu ngay')).toBeInTheDocument();
    expect(await screen.findByText('BKP-20261023-0001')).toBeInTheDocument();
  });
});
