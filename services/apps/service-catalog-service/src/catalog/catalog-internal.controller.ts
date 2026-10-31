import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { InternalAuthGuard } from '../auth/internal-auth.guard';
import { CatalogService } from './catalog.service';
import { EligibilityQueryDto, ResolveServicesDto } from './dto';

@Public()
@UseGuards(InternalAuthGuard)
@Controller('internal/services')
export class CatalogInternalController {
  constructor(private readonly service: CatalogService) {}

  @Get(':serviceId/eligibility')
  eligibility(@Param('serviceId') serviceId: string, @Query() query: EligibilityQueryDto) {
    return this.service.resolveEligibility(serviceId, query);
  }

  @Post('resolve')
  resolve(@Body() dto: ResolveServicesDto) {
    return this.service.resolveMany(dto);
  }
}
