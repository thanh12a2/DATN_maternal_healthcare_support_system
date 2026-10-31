import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { CatalogService } from './catalog.service';
import { ListServicesQueryDto } from './dto';

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

  @Get('categories')
  listCategories() {
    return this.service.listPublicCategories();
  }

  @Get('filters')
  filters() {
    return this.service.getFilters();
  }
}
