import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { CatalogService } from './catalog.service';
import { EligibilityQueryDto, ListServicesQueryDto } from './dto';

@Public()
@Controller()
export class CatalogPublicController {
  constructor(private readonly service: CatalogService) {}

  @Get('services')
  listServices(@Query() query: ListServicesQueryDto) {
    return this.service.listPublicServices(query);
  }

  @Get('services/:idOrSlug')
  getService(@Param('idOrSlug') idOrSlug: string) {
    return this.service.getPublicService(idOrSlug);
  }

  // Read-only estimate through the same effective-price resolver used by booking.
  // Catalog prices are already public; no internal credentials cross the browser.
  @Get('services/:serviceId/estimate')
  estimate(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Query() query: EligibilityQueryDto,
  ) {
    return this.service.resolveEligibility(serviceId, query);
  }

  @Get('categories')
  listCategories() {
    return this.service.listPublicCategories();
  }

  @Get('filters')
  filters() {
    return this.service.getFilters();
  }
}
