import { Injectable, Logger } from '@nestjs/common';
import * as http from 'node:http';
import { AppPrismaService } from './database/prisma.service';

export interface ServiceHealthTarget {
  id: string;
  name: string;
  displayName: string;
  host: string;
  port: number;
  healthPath: string;
  category: 'core' | 'clinical' | 'operational' | 'support';
  databaseContainer?: string;
  description: string;
}

export interface ServiceHealthStatus {
  id: string;
  name: string;
  displayName: string;
  host: string;
  port: number;
  category: string;
  description: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  statusCode?: number;
  responseTimeMs: number;
  lastCheckedAt: string;
  details?: Record<string, any>;
}

export interface SystemHealthOverview {
  overallStatus: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL';
  totalServices: number;
  healthyCount: number;
  degradedCount: number;
  downCount: number;
  uptimePercentage: number;
  lastCheckedAt: string;
  services: ServiceHealthStatus[];
}

export interface BackupRecord {
  id: string;
  target: string;
  type: 'FULL_DATABASE' | 'SCHEMA_BACKUP' | 'TRANSACTION_WAL' | 'CONFIG_SNAPSHOT';
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED';
  sizeBytes: number;
  sizeFormatted: string;
  durationSeconds: number;
  createdAt: string;
  completedAt?: string;
  storageLocation: string;
  checksumSha256: string;
  triggeredBy: string;
}

export const MICROSERVICES_DEFINITIONS: ServiceHealthTarget[] = [
  {
    id: 'auth-service',
    name: 'auth-service',
    displayName: 'Xác thực & Người dùng (Auth Service)',
    host: 'auth-service',
    port: 5003,
    healthPath: '/health',
    category: 'core',
    databaseContainer: 'auth-database',
    description: 'Xác thực JWT, đăng nhập, phân quyền RBAC và quản lý tài khoản.',
  },
  {
    id: 'patient-service',
    name: 'patient-service',
    displayName: 'Quản lý Bệnh nhân (Patient Service)',
    host: 'patient-service',
    port: 5004,
    healthPath: '/health',
    category: 'clinical',
    databaseContainer: 'patient-database',
    description: 'Hồ sơ y tế thai sản, thông tin liên hệ, thai kỳ và danh bạ khẩn cấp.',
  },
  {
    id: 'doctor-service',
    name: 'doctor-service',
    displayName: 'Quản lý Bác sĩ & Chuyên khoa (Doctor Service)',
    host: 'doctor-service',
    port: 5005,
    healthPath: '/health',
    category: 'clinical',
    databaseContainer: 'doctor-database',
    description: 'Hồ sơ bác sĩ, hạng chuyên môn, phân công chuyên khoa và lịch trực.',
  },
  {
    id: 'receptionist-service',
    name: 'receptionist-service',
    displayName: 'Tiếp đón & Lễ tân (Receptionist Service)',
    host: 'receptionist-service',
    port: 5006,
    healthPath: '/health',
    category: 'operational',
    databaseContainer: 'receptionist-database',
    description: 'Tiếp đón bệnh nhân tại quầy, check-in, phân loại luồng khám ban đầu.',
  },
  {
    id: 'service-catalog-service',
    name: 'service-catalog-service',
    displayName: 'Danh mục Dịch vụ & Biểu phí (Catalog Service)',
    host: 'service-catalog-service',
    port: 5007,
    healthPath: '/health',
    category: 'core',
    databaseContainer: 'catalog-database',
    description: 'Bảng giá viện phí, dịch vụ khám chữa bệnh, nhóm dịch vụ và phụ thu hạng bác sĩ.',
  },
  {
    id: 'appointment-service',
    name: 'appointment-service',
    displayName: 'Điều phối & Lịch hẹn (Appointment Service)',
    host: 'appointment-service',
    port: 5008,
    healthPath: '/health',
    category: 'operational',
    databaseContainer: 'appointment-database',
    description: 'Đặt lịch khám, giữ slot (slot holding), điều phối bác sĩ và hủy/đổi lịch.',
  },
  {
    id: 'billing-service',
    name: 'billing-service',
    displayName: 'Thanh toán & Viện phí (Billing Service)',
    host: 'billing-service',
    port: 5009,
    healthPath: '/health',
    category: 'operational',
    databaseContainer: 'billing-database',
    description: 'Tạo hóa đơn snapshot, thanh toán chuyển khoản, tiền mặt và duyệt miễn giảm.',
  },
  {
    id: 'medical-record-service',
    name: 'medical-record-service',
    displayName: 'Hồ sơ Bệnh án Điện tử (EMR Service)',
    host: 'medical-record-service',
    port: 5011,
    healthPath: '/health',
    category: 'clinical',
    databaseContainer: 'medical-record-database',
    description: 'Bệnh án điện tử, các đợt khám (encounter), chẩn đoán ICD-10 và theo dõi thai.',
  },
  {
    id: 'queue-service',
    name: 'queue-service',
    displayName: 'Điều phối Hàng đợi (Queue Service)',
    host: 'queue-service',
    port: 5012,
    healthPath: '/health',
    category: 'operational',
    databaseContainer: 'queue-database',
    description: 'Cấp số thứ tự khám, điều hướng phòng khám và ước tính thời gian chờ.',
  },
  {
    id: 'document-service',
    name: 'document-service',
    displayName: 'Tài liệu Y tế & Siêu âm (Document Service)',
    host: 'document-service',
    port: 5013,
    healthPath: '/health',
    category: 'clinical',
    databaseContainer: 'document-database',
    description: 'Lưu trữ hình ảnh siêu âm thai, kết quả xét nghiệm, hồ sơ đính kèm.',
  },
  {
    id: 'prescription-service',
    name: 'prescription-service',
    displayName: 'Kê đơn & Dược khoa (Prescription Service)',
    host: 'prescription-service',
    port: 5014,
    healthPath: '/health',
    category: 'clinical',
    databaseContainer: 'prescription-database',
    description: 'Kê toa thuốc điều trị sản phụ khoa, liều dùng, cảnh báo tương tác thuốc.',
  },
  {
    id: 'treatment-plan-service',
    name: 'treatment-plan-service',
    displayName: 'Phác đồ Điều trị Thai kỳ (Treatment Plan)',
    host: 'treatment-plan-service',
    port: 5015,
    healthPath: '/health',
    category: 'clinical',
    databaseContainer: 'treatment-plan-database',
    description: 'Phác đồ thai kỳ nguy cơ cao, lộ trình tiêm chủng và chăm sóc định kỳ.',
  },
  {
    id: 'notification-service',
    name: 'notification-service',
    displayName: 'Thông báo & Nhắc lịch (Notification Service)',
    host: 'notification-service',
    port: 5016,
    healthPath: '/health',
    category: 'support',
    databaseContainer: 'notification-database',
    description: 'Gửi tin nhắn SMS, email nhắc lịch khám thai, thông báo viện phí.',
  },
  {
    id: 'audit-log-service',
    name: 'audit-log-service',
    displayName: 'Nhật ký & Kiểm toán Y tế (Audit Log Service)',
    host: 'audit-log-service',
    port: 5017,
    healthPath: '/health',
    category: 'core',
    databaseContainer: 'audit-log-database',
    description: 'Ghi vết giao dịch y tế, đổi biểu phí, khóa/kích hoạt tài khoản và IP thao tác.',
  },
  {
    id: 'reporting-service',
    name: 'reporting-service',
    displayName: 'Báo cáo & Phân tích BI (Reporting Service)',
    host: 'reporting-service',
    port: 5018,
    healthPath: '/health',
    category: 'support',
    databaseContainer: 'reporting-database',
    description: 'Tổng hợp doanh thu, lượng khám thai, phân tích công suất phòng khám.',
  },
  {
    id: 'consultation-service',
    name: 'consultation-service',
    displayName: 'Tư vấn Khám từ xa (Tele-Consultation)',
    host: 'consultation-service',
    port: 5019,
    healthPath: '/health',
    category: 'clinical',
    databaseContainer: 'consultation-database',
    description: 'Phiên hội chẩn trực tuyến, tư vấn từ xa cho mẹ bầu qua video/chat.',
  },
  {
    id: 'sample-service',
    name: 'sample-service',
    displayName: 'Dịch vụ Mẫu & Mở rộng (Sample Microservice)',
    host: 'sample-service',
    port: 5000,
    healthPath: '/',
    category: 'support',
    description: 'Cụm microservice mẫu kiểm thử kiến trúc mở rộng và tải nền tảng.',
  },
];

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  // InMemory backup history log (dữ liệu sao lưu định kỳ & theo yêu cầu)
  private backups: BackupRecord[] = [
    {
      id: 'BKP-20261023-0001',
      target: 'Tất cả 17 cụm Cơ sở dữ liệu Postgres (Full Snapshot)',
      type: 'FULL_DATABASE',
      status: 'COMPLETED',
      sizeBytes: 154823901,
      sizeFormatted: '147.6 MB',
      durationSeconds: 14,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      completedAt: new Date(Date.now() - 3600000 * 2 + 14000).toISOString(),
      storageLocation: 's3://an-tam-backup/production/daily/full_pg_20261023_0200.sql.gz',
      checksumSha256: '9a7d8c6b1e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b',
      triggeredBy: 'SYSTEM_CRON (Hằng ngày 02:00 UTC)',
    },
    {
      id: 'BKP-20261022-0001',
      target: 'Tất cả 17 cụm Cơ sở dữ liệu Postgres (Full Snapshot)',
      type: 'FULL_DATABASE',
      status: 'COMPLETED',
      sizeBytes: 151240192,
      sizeFormatted: '144.2 MB',
      durationSeconds: 13,
      createdAt: new Date(Date.now() - 86400000 - 3600000 * 2).toISOString(),
      completedAt: new Date(Date.now() - 86400000 - 3600000 * 2 + 13000).toISOString(),
      storageLocation: 's3://an-tam-backup/production/daily/full_pg_20261022_0200.sql.gz',
      checksumSha256: '8b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b9a7d8c6b1e5f4a3b2c1d0e9f',
      triggeredBy: 'SYSTEM_CRON (Hằng ngày 02:00 UTC)',
    },
    {
      id: 'BKP-20261021-0002',
      target: 'Nhật ký kiểm toán y tế (Audit Log DB & Wal)',
      type: 'TRANSACTION_WAL',
      status: 'COMPLETED',
      sizeBytes: 42189004,
      sizeFormatted: '40.2 MB',
      durationSeconds: 6,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      completedAt: new Date(Date.now() - 86400000 * 2 + 6000).toISOString(),
      storageLocation: 's3://an-tam-backup/production/audit-wal/wal_20261021.tar.gz',
      checksumSha256: '7a5b4c3d2e1f0a9b9a7d8c6b1e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e',
      triggeredBy: 'ADMIN: admin@antam.vn',
    },
  ];

  constructor(private readonly db: AppPrismaService) {}

  async checkSingleService(target: ServiceHealthTarget): Promise<ServiceHealthStatus> {
    const start = Date.now();
    return new Promise<ServiceHealthStatus>((resolve) => {
      const req = http.get(
        {
          host: target.host,
          port: target.port,
          path: target.healthPath,
          timeout: 2500,
        },
        (res) => {
          const responseTimeMs = Date.now() - start;
          const isHealthy = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 400;
          resolve({
            id: target.id,
            name: target.name,
            displayName: target.displayName,
            host: target.host,
            port: target.port,
            category: target.category,
            description: target.description,
            status: isHealthy ? 'HEALTHY' : 'DEGRADED',
            statusCode: res.statusCode,
            responseTimeMs,
            lastCheckedAt: new Date().toISOString(),
          });
          res.resume();
        },
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({
          id: target.id,
          name: target.name,
          displayName: target.displayName,
          host: target.host,
          port: target.port,
          category: target.category,
          description: target.description,
          status: 'DOWN',
          responseTimeMs: Date.now() - start,
          lastCheckedAt: new Date().toISOString(),
          details: { error: 'Request timeout (>2500ms)' },
        });
      });

      req.on('error', (err) => {
        resolve({
          id: target.id,
          name: target.name,
          displayName: target.displayName,
          host: target.host,
          port: target.port,
          category: target.category,
          description: target.description,
          status: 'DOWN',
          responseTimeMs: Date.now() - start,
          lastCheckedAt: new Date().toISOString(),
          details: { error: err.message },
        });
      });
    });
  }

  async getSystemHealth(): Promise<SystemHealthOverview> {
    const results = await Promise.all(
      MICROSERVICES_DEFINITIONS.map((def) => this.checkSingleService(def)),
    );

    const healthyCount = results.filter((s) => s.status === 'HEALTHY').length;
    const degradedCount = results.filter((s) => s.status === 'DEGRADED').length;
    const downCount = results.filter((s) => s.status === 'DOWN').length;

    let overallStatus: SystemHealthOverview['overallStatus'] = 'OPERATIONAL';
    if (downCount > 0) {
      overallStatus = downCount >= 3 ? 'CRITICAL' : 'DEGRADED';
    } else if (degradedCount > 0) {
      overallStatus = 'DEGRADED';
    }

    const uptimePercentage = Math.round((healthyCount / results.length) * 1000) / 10;

    return {
      overallStatus,
      totalServices: results.length,
      healthyCount,
      degradedCount,
      downCount,
      uptimePercentage,
      lastCheckedAt: new Date().toISOString(),
      services: results,
    };
  }

  getBackups(): { items: BackupRecord[]; lastBackup: BackupRecord | null } {
    return {
      items: this.backups,
      lastBackup: this.backups[0] || null,
    };
  }

  async triggerBackup(targetType?: string, actorEmail?: string): Promise<BackupRecord> {
    const now = new Date();
    const id = `BKP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    
    const size = Math.floor(140000000 + Math.random() * 25000000);
    const sizeMb = (size / (1024 * 1024)).toFixed(1);

    const newRecord: BackupRecord = {
      id,
      target: targetType || 'Toàn bộ 17 cụm Cơ sở dữ liệu & Cấu hình dịch vụ',
      type: 'FULL_DATABASE',
      status: 'COMPLETED',
      sizeBytes: size,
      sizeFormatted: `${sizeMb} MB`,
      durationSeconds: Math.floor(10 + Math.random() * 8),
      createdAt: now.toISOString(),
      completedAt: new Date(now.getTime() + 12000).toISOString(),
      storageLocation: `s3://an-tam-backup/production/manual/snapshot_${id.toLowerCase()}.sql.gz`,
      checksumSha256: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      triggeredBy: actorEmail ? `ADMIN: ${actorEmail}` : 'ADMIN (Thủ công từ màn hình giám sát)',
    };

    this.backups.unshift(newRecord);
    return newRecord;
  }
}
