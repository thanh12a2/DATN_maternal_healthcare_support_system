import { Body, Controller, ForbiddenException, Get, NotImplementedException, Post, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { GrpcMethod } from '@nestjs/microservices';
import { CurrentAuth, PublicHttp, PublicJwtGuard, ServiceJwtGuard, ServiceScopes, type PublicAuthContext } from '@platform';
import { AuditService } from './audit.service';

class RecordClientAuditDto {
  @IsString() @Length(1, 100) action!: string;
  @IsString() @Length(1, 80) aggregateType!: string;
  @IsString() @Length(1, 100) aggregateId!: string;
  @IsIn(['SUCCESS', 'FAILED']) result!: 'SUCCESS' | 'FAILED';
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true })
  @MaxLength(80, { each: true }) changedFields?: string[];
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

@Controller()
export class AuditController {
  constructor(private readonly s: AuditService) {}
  @PublicHttp() @Get('health') health() {
    return { status: 'ok' };
  }
  @UseGuards(PublicJwtGuard)
  @Get('')
  listRest(@Query() query: any, @CurrentAuth() auth: PublicAuthContext) {
    if (auth.role !== 'ADMIN') throw new ForbiddenException('ADMIN_REQUIRED');
    return this.s.listRest(query);
  }
  @UseGuards(PublicJwtGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  @Post('logs')
  recordClientLog(@Body() dto: RecordClientAuditDto, @CurrentAuth() auth: PublicAuthContext) {
    if (auth.role !== 'ADMIN') throw new ForbiddenException('ADMIN_REQUIRED');
    return this.s.recordAdminClientLog(dto, auth.userId);
  }
  @UseGuards(PublicJwtGuard)
  @Get('stats')
  stats(@CurrentAuth() auth: PublicAuthContext) {
    if (auth.role !== 'ADMIN') throw new ForbiddenException('ADMIN_REQUIRED');
    return this.s.statsRest();
  }
  @UseGuards(PublicJwtGuard)
  @Get('system/health')
  systemHealth(@CurrentAuth() auth: PublicAuthContext) {
    if (auth.role !== 'ADMIN') throw new ForbiddenException('ADMIN_REQUIRED');
    return this.s.systemHealthRest();
  }
  @UseGuards(PublicJwtGuard)
  @Get('system/backups')
  backups(@CurrentAuth() auth: PublicAuthContext) {
    if (auth.role !== 'ADMIN') throw new ForbiddenException('ADMIN_REQUIRED');
    throw new NotImplementedException('BACKUP_MONITORING_NOT_CONFIGURED');
  }
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
