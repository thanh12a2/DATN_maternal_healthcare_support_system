import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  CurrentAuth,
  ClinicalDoctorAccess,
  PublicHttp,
  PublicJwtGuard,
  ServiceJwtGuard,
  ServiceScopes,
  type PublicAuthContext,
} from '@platform';
import { TreatmentPlanStatus } from '../../../generated/treatment-plan-client';
import { TreatmentService } from './treatment.service';

@Controller()
export class TreatmentController {
  constructor(private readonly s: TreatmentService, private readonly access: ClinicalDoctorAccess) {}

  @PublicHttp()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // ─── REST Endpoints ────────────────────────────────────────────────────────

  @UseGuards(PublicJwtGuard)
  @Post(['', 'treatment-plans'])
  createTreatmentPlan(
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR') throw new ForbiddenException('CLINICAL_WRITE_NOT_AVAILABLE');
    return this.s.createRest(b, a);
  }

  @UseGuards(PublicJwtGuard)
  @Get(['', 'treatment-plans'])
  async listTreatmentPlans(@Query() q: any, @CurrentAuth() a: PublicAuthContext) {
    if (a.role === 'DOCTOR') await this.access.assertEncounter(a, q?.encounterId, q?.patientId);
    return this.s.listRest(q);
  }

  @UseGuards(PublicJwtGuard)
  @Get([':id', 'treatment-plans/:id'])
  async getTreatmentPlan(@Param('id') id: string, @CurrentAuth() a: PublicAuthContext) {
    const result = await this.s.getRest(id);
    if (a.role === 'DOCTOR') await this.access.assertEncounter(a, result.data.sourceEncounterId, result.data.patientId);
    return result;
  }

  @UseGuards(PublicJwtGuard)
  @Patch([':id', 'treatment-plans/:id'])
  updateTreatmentPlan(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR') throw new ForbiddenException('CLINICAL_WRITE_NOT_AVAILABLE');
    return this.s.updateRest(id, b, a);
  }

  @UseGuards(PublicJwtGuard)
  @Post([':id/activate', 'treatment-plans/:id/activate'])
  activateTreatmentPlan(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR') throw new ForbiddenException('CLINICAL_WRITE_NOT_AVAILABLE');
    return this.s.commandRest(id, TreatmentPlanStatus.ACTIVE, b);
  }

  @UseGuards(PublicJwtGuard)
  @Post([':id/complete', 'treatment-plans/:id/complete'])
  completeTreatmentPlan(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR') throw new ForbiddenException('CLINICAL_WRITE_NOT_AVAILABLE');
    return this.s.commandRest(id, TreatmentPlanStatus.COMPLETED, b);
  }

  @UseGuards(PublicJwtGuard)
  @Post([':id/cancel', 'treatment-plans/:id/cancel'])
  cancelTreatmentPlan(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR') throw new ForbiddenException('CLINICAL_WRITE_NOT_AVAILABLE');
    return this.s.commandRest(id, TreatmentPlanStatus.CANCELLED, b);
  }

  @UseGuards(PublicJwtGuard)
  @Post([
    ':id/items/:itemId/complete',
    'treatment-plans/:id/items/:itemId/complete',
    'items/:itemId/complete',
    'treatment-plans/items/:itemId/complete',
  ])
  completeTreatmentPlanItem(
    @Param('id') planId: string,
    @Param('itemId') itemId: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR') throw new ForbiddenException('CLINICAL_WRITE_NOT_AVAILABLE');
    // If route was items/:itemId/complete, planId param might be undefined or hold itemId
    const actualItemId = itemId || planId;
    const actualPlanId = itemId ? planId : undefined;
    return this.s.completeItemRest(actualPlanId, actualItemId, b);
  }

  // ─── gRPC Endpoints ────────────────────────────────────────────────────────

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('treatment:clinical')
  @GrpcMethod('TreatmentPlanInternalService', 'CreateDraftPlan')
  create(r: any) {
    return this.s.create(r);
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('treatment:read')
  @GrpcMethod('TreatmentPlanInternalService', 'GetTreatmentPlan')
  get(r: any) {
    return this.s.get(r.planId);
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('treatment:read')
  @GrpcMethod('TreatmentPlanInternalService', 'ListPlansByPatient')
  list(r: any) {
    return this.s.list(r.patientId, r.pregnancyEpisodeId);
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('treatment:clinical')
  @GrpcMethod('TreatmentPlanInternalService', 'ActivatePlan')
  activate(r: any) {
    return this.s.command(
      r.planId,
      Number(r.expectedVersion),
      TreatmentPlanStatus.ACTIVE,
    );
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('treatment:clinical')
  @GrpcMethod('TreatmentPlanInternalService', 'CompletePlan')
  complete(r: any) {
    return this.s.command(
      r.planId,
      Number(r.expectedVersion),
      TreatmentPlanStatus.COMPLETED,
    );
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('treatment:clinical')
  @GrpcMethod('TreatmentPlanInternalService', 'CancelPlan')
  cancel(r: any) {
    return this.s.command(
      r.planId,
      Number(r.expectedVersion),
      TreatmentPlanStatus.CANCELLED,
      r.reason,
    );
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('treatment:read')
  @GrpcMethod('TreatmentPlanInternalService', 'ValidateTreatmentPlanReference')
  validate(r: any) {
    return this.s.validate(r);
  }
}
