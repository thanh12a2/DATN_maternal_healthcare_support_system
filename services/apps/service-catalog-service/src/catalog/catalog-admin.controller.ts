import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CatalogService } from './catalog.service';
import {
  CreateCategoryDto,
  CreateServiceDto,
  CreateTagDto,
  ScheduleBasePriceDto,
  ScheduleRankSurchargeDto,
  UpdateCategoryDto,
  UpdateServiceDto,
  UpdateTagDto,
} from './dto';

@Controller('admin')
@Roles('ADMIN')
export class CatalogAdminController {
  constructor(private readonly service: CatalogService) {}

  @Post('services')
  createService(@Body() dto: CreateServiceDto) {
    return this.service.createService(dto);
  }

  @Patch('services/:serviceId')
  updateService(@Param('serviceId') serviceId: string, @Body() dto: UpdateServiceDto) {
    return this.service.updateService(serviceId, dto);
  }

  @Post('services/:serviceId/activate')
  activateService(@Param('serviceId') serviceId: string) {
    return this.service.changeServiceStatus(serviceId, 'ACTIVE');
  }

  @Post('services/:serviceId/deactivate')
  deactivateService(@Param('serviceId') serviceId: string) {
    return this.service.changeServiceStatus(serviceId, 'INACTIVE');
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch('categories/:categoryId')
  updateCategory(@Param('categoryId') categoryId: string, @Body() dto: UpdateCategoryDto) {
    return this.service.updateCategory(categoryId, dto);
  }

  @Post('tags')
  createTag(@Body() dto: CreateTagDto) {
    return this.service.createTag(dto);
  }

  @Patch('tags/:tagId')
  updateTag(@Param('tagId') tagId: string, @Body() dto: UpdateTagDto) {
    return this.service.updateTag(tagId, dto);
  }

  @Post('services/:serviceId/prices')
  scheduleBasePrice(@Param('serviceId') serviceId: string, @Body() dto: ScheduleBasePriceDto) {
    return this.service.scheduleBasePrice(serviceId, dto);
  }

  @Post('doctor-rank-surcharges')
  scheduleRankSurcharge(@Body() dto: ScheduleRankSurchargeDto) {
    return this.service.scheduleRankSurcharge(dto);
  }

  @Post('prices/:priceId/cancel')
  cancelPrice(@Param('priceId') priceId: string) {
    return this.service.cancelPrice(priceId);
  }

  @Post('doctor-rank-surcharges/:surchargeId/cancel')
  cancelRankSurcharge(@Param('surchargeId') surchargeId: string) {
    return this.service.cancelRankSurcharge(surchargeId);
  }
}
