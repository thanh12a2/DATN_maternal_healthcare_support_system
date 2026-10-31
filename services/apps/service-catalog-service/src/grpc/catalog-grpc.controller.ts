import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServiceCallers, ServiceJwtGuard, ServiceScopes, timestampToDate } from '@platform';
import { CatalogService } from '../catalog/catalog.service';

@Controller()
@UseGuards(ServiceJwtGuard)
@ServiceCallers('appointment-service', 'medical-record-service', 'billing-service', 'reporting-service')
@ServiceScopes('catalog:resolve')
export class CatalogGrpcController {
  constructor(private readonly catalog: CatalogService) {}

  @GrpcMethod('CatalogInternalService', 'ResolveBookingOffering')
  async resolveBookingOffering(request: { serviceId: string; consultationRankCode?: string; effectiveAt?: { seconds?: string | number; nanos?: number } }) {
    const at = timestampToDate(request.effectiveAt)?.toISOString();
    const result = await this.catalog.resolveEligibility(request.serviceId, {
      doctorRankCode: request.consultationRankCode || undefined,
      at,
      currency: 'VND',
    });
    return { offering: this.offering(result.data, request.consultationRankCode, at) };
  }

  @GrpcMethod('CatalogInternalService', 'BatchResolveServices')
  async batchResolveServices(request: { serviceIds: string[]; effectiveAt?: { seconds?: string | number; nanos?: number } }) {
    const at = timestampToDate(request.effectiveAt)?.toISOString();
    const result = await this.catalog.resolveMany({ serviceIds: [...new Set(request.serviceIds ?? [])].slice(0, 50), at, currency: 'VND' });
    return { services: result.data.map((item: any) => ({
      serviceId: item.service.id,
      serviceCode: item.service.code,
      serviceName: item.service.name,
      serviceVersion: String(item.service.version),
      active: true,
    })) };
  }

  private offering(data: any, rankCode?: string, effectiveAt?: string) {
    const money = (value: any) => ({ amountMinor: String(value?.amountMinor ?? 0), currencyCode: value?.currency ?? 'VND' });
    return {
      serviceId: data.service.id,
      serviceCode: data.service.code,
      serviceName: data.service.name,
      serviceVersion: String(data.service.version),
      active: true,
      bookable: data.service.bookingEnabled,
      requiredSpecialtyId: data.service.specialtyId ?? '',
      durationMinutes: data.service.durationMinutes ?? 0,
      consultationRankCode: rankCode || data.doctorRankSurcharge?.rankCode || 'BASIC',
      basePrice: money(data.basePrice),
      rankSurcharge: money(data.doctorRankSurcharge),
      totalPrice: money(data.estimatedTotal),
      basePriceId: data.basePrice.id,
      rankSurchargeId: data.doctorRankSurcharge?.priceId ?? '',
      effectiveAt: effectiveAt ? this.timestamp(new Date(effectiveAt)) : undefined,
    };
  }

  private timestamp(value: Date) {
    return { seconds: Math.floor(value.getTime() / 1000).toString(), nanos: (value.getTime() % 1000) * 1_000_000 };
  }
}
