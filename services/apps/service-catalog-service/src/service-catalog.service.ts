import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CatalogDatabaseService } from './database/catalog-database.service';

export interface CatalogHealthResponse {
  status: 'ok';
}

@Injectable()
export class ServiceCatalogService {
  constructor(private readonly db: CatalogDatabaseService) {}

  health(): CatalogHealthResponse {
    return { status: 'ok' };
  }

  async ready(): Promise<CatalogHealthResponse> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('DEPENDENCY_UNAVAILABLE');
    }
  }
}
