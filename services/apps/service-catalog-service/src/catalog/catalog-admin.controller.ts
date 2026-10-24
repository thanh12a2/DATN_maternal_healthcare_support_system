import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { CatalogService } from './catalog.service';
import {
  CreateCategoryDto,
  CreateServiceDto,
  CreateTagDto,
  ListAdminServicesQueryDto,
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

  @Get('services')
  listServices(@Query() query: ListAdminServicesQueryDto) {
    return this.service.listAdminServices(query);
  }

  @Get('services/:serviceId')
  getService(@Param('serviceId') serviceId: string) {
    return this.service.getAdminService(serviceId);
  }

  @Post('services')
  createService(@Body() dto: CreateServiceDto) {
    return this.service.createService(dto);
  }

  @Patch('services/:serviceId')
  updateService(@Param('serviceId') serviceId: string, @Body() dto: UpdateServiceDto) {
    return this.service.updateService(serviceId, dto);
  }

  @Delete('services/:serviceId')
  deleteService(@Param('serviceId') serviceId: string) {
    return this.service.deleteService(serviceId);
  }

  @Post('services/:serviceId/activate')
  activateService(@Param('serviceId') serviceId: string) {
    return this.service.changeServiceStatus(serviceId, 'ACTIVE');
  }

  @Post('services/:serviceId/deactivate')
  deactivateService(@Param('serviceId') serviceId: string) {
    return this.service.changeServiceStatus(serviceId, 'INACTIVE');
  }

  @Get('services/:serviceId/prices')
  listServicePrices(@Param('serviceId') serviceId: string) {
    return this.service.listServicePrices(serviceId);
  }

  @Post('services/:serviceId/prices')
  scheduleBasePrice(@Param('serviceId') serviceId: string, @Body() dto: ScheduleBasePriceDto) {
    return this.service.scheduleBasePrice(serviceId, dto);
  }

  @Get('categories')
  listCategories() {
    return this.service.listAdminCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch('categories/:categoryId')
  updateCategory(@Param('categoryId') categoryId: string, @Body() dto: UpdateCategoryDto) {
    return this.service.updateCategory(categoryId, dto);
  }

  @Delete('categories/:categoryId')
  deleteCategory(@Param('categoryId') categoryId: string) {
    return this.service.deleteCategory(categoryId);
  }

  @Post('categories/:categoryId/activate')
  activateCategory(@Param('categoryId') categoryId: string) {
    return this.service.changeCategoryStatus(categoryId, 'ACTIVE');
  }

  @Post('categories/:categoryId/deactivate')
  deactivateCategory(@Param('categoryId') categoryId: string) {
    return this.service.changeCategoryStatus(categoryId, 'INACTIVE');
  }

  @Get('tags')
  listTags() {
    return this.service.listAdminTags();
  }

  @Post('tags')
  createTag(@Body() dto: CreateTagDto) {
    return this.service.createTag(dto);
  }

  @Patch('tags/:tagId')
  updateTag(@Param('tagId') tagId: string, @Body() dto: UpdateTagDto) {
    return this.service.updateTag(tagId, dto);
  }

  @Delete('tags/:tagId')
  deleteTag(@Param('tagId') tagId: string) {
    return this.service.deleteTag(tagId);
  }

  @Post('tags/:tagId/activate')
  activateTag(@Param('tagId') tagId: string) {
    return this.service.changeTagStatus(tagId, 'ACTIVE');
  }

  @Post('tags/:tagId/deactivate')
  deactivateTag(@Param('tagId') tagId: string) {
    return this.service.changeTagStatus(tagId, 'INACTIVE');
  }

  @Get('doctor-rank-surcharges')
  listRankSurcharges() {
    return this.service.listRankSurcharges();
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
