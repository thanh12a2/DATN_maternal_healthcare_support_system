import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

export interface HealthCheckResponse {
  status: 'ok';
}

@Injectable()
export class DoctorServiceService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<HealthCheckResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('DEPENDENCY_UNAVAILABLE');
    }
  }
}
