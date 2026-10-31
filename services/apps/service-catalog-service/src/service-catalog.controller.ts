import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { ServiceCatalogService } from './service-catalog.service';
import type { CatalogHealthResponse } from './service-catalog.service';

@Controller()
export class ServiceCatalogController {
  constructor(private readonly service: ServiceCatalogService) {}

  @Public()
  @Get('health')
  health(): CatalogHealthResponse {
    return this.service.health();
  }

  @Public()
  @Get('ready')
  ready(): Promise<CatalogHealthResponse> {
    return this.service.ready();
  }
}
