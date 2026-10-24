import { Controller, Get, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PublicHttp, ServiceJwtGuard, ServiceScopes } from '@platform';
import { AuditService, type AuditLogQueryDto, type CreateAuditEntryInput } from './audit.service';
import { HealthService } from './health.service';

@Controller()
export class AuditController {
  constructor(
    private readonly s: AuditService,
    private readonly healthService: HealthService,
  ) {}

  @PublicHttp()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // ─── System Health & Backup Endpoints ─────────────────────────────────────

  @PublicHttp()
  @Get(['system/health', 'health/all'])
  async getSystemHealth() {
    return this.healthService.getSystemHealth();
  }

  @PublicHttp()
  @Get('system/backups')
  async getBackups() {
    return this.healthService.getBackups();
  }

  @PublicHttp()
  @Post('system/backups')
  async triggerBackup(@Body() body: { targetType?: string; actorEmail?: string }) {
    return this.healthService.triggerBackup(body?.targetType, body?.actorEmail);
  }

  // ─── REST Admin Audit Endpoints ────────────────────────────────────────────

  @PublicHttp()
  @Get(['logs', 'admin/logs', ''])
  async listLogs(@Query() query: AuditLogQueryDto) {
    return this.s.listRest(query);
  }

  @PublicHttp()
  @Get('stats')
  async stats() {
    return this.s.getStats();
  }

  @PublicHttp()
  @Post(['logs', 'admin/logs'])
  async createLog(@Body() body: CreateAuditEntryInput) {
    return this.s.recordDirect(body);
  }

  @PublicHttp()
  @Get('logs/:id')
  async getLogById(@Param('id') id: string) {
    return this.s.get(id);
  }

  // ─── gRPC Endpoints ────────────────────────────────────────────────────────

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('audit:read')
  @GrpcMethod('AuditLogInternalService', 'GetAuditLog')
  get(r: any) {
    return this.s.get(r.auditLogId);
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('audit:read')
  @GrpcMethod('AuditLogInternalService', 'ListAuditLogs')
  list(r: any) {
    return this.s.list(r);
  }
}
