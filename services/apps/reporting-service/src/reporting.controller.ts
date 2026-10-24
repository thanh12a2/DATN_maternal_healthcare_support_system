import { Controller, ForbiddenException, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import type { Response } from 'express';
import {
  PublicHttp,
  CurrentAuth,
  type PublicAuthContext,
  PublicJwtGuard,
  ServiceJwtGuard,
  ServiceScopes,
} from '@platform';
import { ReportingService } from './reporting.service';

@Controller()
export class ReportingController {
  constructor(private readonly s: ReportingService) {}

  @PublicHttp()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // ─── REST Endpoints ────────────────────────────────────────────────────────

  @UseGuards(PublicJwtGuard)
  @Get(['reports/catalog', 'catalog'])
  catalog(@CurrentAuth() auth: PublicAuthContext) {
    this.requireClinicManager(auth);
    const reports = this.s.getCatalog();
    return {
      data: reports,
      reports,
    };
  }

  @UseGuards(PublicJwtGuard)
  @Get(['reports/overview', 'overview'])
  async overviewRest(@Query() query: any, @CurrentAuth() auth: PublicAuthContext) {
    this.requireClinicManager(auth);
    const fromDate =
      query?.fromDate ||
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate = query?.toDate || new Date().toISOString().slice(0, 10);
    const result = await this.s.overview({ period: { fromDate, toDate } });
    return { data: result, ...result };
  }

  @UseGuards(PublicJwtGuard)
  @Get(['reports/appointments', 'appointments'])
  async appointmentsRest(@Query() query: any, @CurrentAuth() auth: PublicAuthContext) {
    this.requireClinicManager(auth);
    const fromDate =
      query?.fromDate ||
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate = query?.toDate || new Date().toISOString().slice(0, 10);
    const rows = await this.s.rows('APPOINTMENT_DAILY', fromDate, toDate);
    const result = {
      period: { fromDate, toDate },
      rows: rows.map((x) => ({
        date: x.businessDate.toISOString().slice(0, 10),
        ...((x.measures as any) ?? {}),
      })),
    };
    return { data: result, ...result };
  }

  @UseGuards(PublicJwtGuard)
  @Get(['reports/revenue', 'revenue'])
  async revenueRest(@Query() query: any, @CurrentAuth() auth: PublicAuthContext) {
    this.requireClinicManager(auth);
    const fromDate =
      query?.fromDate ||
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate = query?.toDate || new Date().toISOString().slice(0, 10);
    const rows = await this.s.rows('REVENUE_DAILY', fromDate, toDate);
    const totalCollectedAmount = rows.reduce(
      (a, x) => a + Number((x.measures as any)?.collected ?? 0),
      0,
    );
    const result = {
      period: { fromDate, toDate },
      totalCollectedAmount: String(totalCollectedAmount),
      currency: 'VND',
      rows: rows.map((x) => ({
        date: x.businessDate.toISOString().slice(0, 10),
        ...((x.measures as any) ?? {}),
      })),
    };
    return { data: result, ...result };
  }

  @UseGuards(PublicJwtGuard)
  @Get([
    'reports/appointments.csv',
    'appointments.csv',
    'reports/APPOINTMENT_DAILY.csv',
    'APPOINTMENT_DAILY.csv',
  ])
  async exportAppointmentsCsvRest(
    @Query() query: any,
    @Res() res: Response,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    this.requireClinicManager(auth);
    const fromDate =
      query?.fromDate ||
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate = query?.toDate || new Date().toISOString().slice(0, 10);
    const file = await this.s.csv('APPOINTMENT_DAILY', { fromDate, toDate });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    return res.send(file.content);
  }

  @UseGuards(PublicJwtGuard)
  @Get([
    'reports/revenue.csv',
    'revenue.csv',
    'reports/REVENUE_DAILY.csv',
    'REVENUE_DAILY.csv',
  ])
  async exportRevenueCsvRest(
    @Query() query: any,
    @Res() res: Response,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    this.requireClinicManager(auth);
    const fromDate =
      query?.fromDate ||
      new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const toDate = query?.toDate || new Date().toISOString().slice(0, 10);
    const file = await this.s.csv('REVENUE_DAILY', { fromDate, toDate });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    return res.send(file.content);
  }

  @UseGuards(PublicJwtGuard)
  @Get(['reports/:reportType', ':reportType'])
  async getReportByType(
    @Param('reportType') reportType: string,
    @Query() query: any,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    this.requireClinicManager(auth);
    if (reportType === 'catalog') {
      return this.catalog(auth);
    }
    if (reportType === 'overview') {
      return this.overviewRest(query, auth);
    }
    return this.s.getReportData(reportType, query);
  }

  // ─── gRPC Endpoints ────────────────────────────────────────────────────────

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('reporting:read')
  @GrpcMethod('ReportingInternalService', 'GetOverview')
  overview(r: any) {
    return this.s.overview(r);
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('reporting:read')
  @GrpcMethod('ReportingInternalService', 'GetAppointmentReport')
  async appointments(r: any) {
    const rows = await this.s.rows(
      'APPOINTMENT_DAILY',
      r.filter.period.fromDate,
      r.filter.period.toDate,
    );
    return {
      period: r.filter.period,
      rows: rows.map((x) => ({
        date: x.businessDate.toISOString().slice(0, 10),
        ...(x.measures as any),
      })),
    };
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('reporting:read')
  @GrpcMethod('ReportingInternalService', 'GetRevenueReport')
  async revenue(r: any) {
    const rows = await this.s.rows(
      'REVENUE_DAILY',
      r.filter.period.fromDate,
      r.filter.period.toDate,
    );
    return {
      period: r.filter.period,
      totalCollectedAmount: String(
        rows.reduce(
          (a, x) => a + Number((x.measures as any).collected ?? 0),
          0,
        ),
      ),
      currency: 'VND',
      rows: [],
    };
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('reporting:export')
  @GrpcMethod('ReportingInternalService', 'ExportAppointmentsCsv')
  exportA(r: any) {
    return this.s.csv('APPOINTMENT_DAILY', r.filter.period);
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('reporting:export')
  @GrpcMethod('ReportingInternalService', 'ExportRevenueCsv')
  exportR(r: any) {
    return this.s.csv('REVENUE_DAILY', r.filter.period);
  }

  private requireClinicManager(auth: PublicAuthContext): void {
    if (!['ADMIN', 'CLINIC_MANAGER'].includes(auth.role)) {
      throw new ForbiddenException('Clinic manager access required');
    }
  }
}
