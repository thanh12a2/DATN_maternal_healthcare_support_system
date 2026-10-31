import {
  Body,
  Controller,
  BadRequestException,
  ConflictException,
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

  private async authorizeWrite(a: PublicAuthContext, encounterId: string, patientId: string, allowFinalized = false) {
    if (a.role !== 'DOCTOR') return;
    if (!patientId) throw new BadRequestException('PATIENT_REQUIRED');
    const encounter = await this.access.assertEncounter(a, encounterId, patientId);
    const states = ['IN_PROGRESS', 'ENCOUNTER_STATE_IN_PROGRESS', ...(allowFinalized ? ['FINALIZED', 'ENCOUNTER_STATE_FINALIZED'] : [])];
    if (!states.includes(encounter.state)) throw new ConflictException('ENCOUNTER_NOT_IN_PROGRESS');
    return encounter.resolvedDoctorId as string;
  }

  private async authorizeExisting(a: PublicAuthContext, id: string, b: any) {
    if (a.role !== 'DOCTOR') return;
    if (!Number.isInteger(b?.version) || b.version < 1) throw new BadRequestException('VERSION_REQUIRED');
    const { data } = await this.s.getRest(id);
    await this.authorizeWrite(a, data.sourceEncounterId, data.patientId, data.status === 'ACTIVE');
  }

  @PublicHttp()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // ─── REST Endpoints ────────────────────────────────────────────────────────

  @UseGuards(PublicJwtGuard)
  @Post(['', 'treatment-plans'])
  async createTreatmentPlan(
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR' && (!String(b.title ?? '').trim() || !Array.isArray(b.items) || !b.items.length || b.items.some((x: any) => !String(x.title ?? '').trim()))) throw new BadRequestException('PLAN_CONTENT_REQUIRED');
    const doctorId = await this.authorizeWrite(a, b.sourceEncounterId || b.encounterId, b.patientId);
    return this.s.createRest(b, a, doctorId);
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
  async updateTreatmentPlan(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR' && ((b.title !== undefined && !String(b.title).trim()) || (b.items !== undefined && (!Array.isArray(b.items) || !b.items.length || b.items.some((x: any) => !String(x.title ?? '').trim()))))) throw new BadRequestException('PLAN_CONTENT_REQUIRED');
    await this.authorizeExisting(a, id, b);
    return this.s.updateRest(id, b, a);
  }

  @UseGuards(PublicJwtGuard)
  @Post([':id/activate', 'treatment-plans/:id/activate'])
  async activateTreatmentPlan(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    await this.authorizeExisting(a, id, b);
    return this.s.commandRest(id, TreatmentPlanStatus.ACTIVE, b);
  }

  @UseGuards(PublicJwtGuard)
  @Post([':id/complete', 'treatment-plans/:id/complete'])
  async completeTreatmentPlan(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    await this.authorizeExisting(a, id, b);
    return this.s.commandRest(id, TreatmentPlanStatus.COMPLETED, b);
  }

  @UseGuards(PublicJwtGuard)
  @Post([':id/cancel', 'treatment-plans/:id/cancel'])
  async cancelTreatmentPlan(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    await this.authorizeExisting(a, id, b);
    return this.s.commandRest(id, TreatmentPlanStatus.CANCELLED, b);
  }

  @UseGuards(PublicJwtGuard)
  @Post([
    ':id/items/:itemId/complete',
    'treatment-plans/:id/items/:itemId/complete',
    'items/:itemId/complete',
    'treatment-plans/items/:itemId/complete',
  ])
  async completeTreatmentPlanItem(
    @Param('id') planId: string,
    @Param('itemId') itemId: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    // If route was items/:itemId/complete, planId param might be undefined or hold itemId
    const actualItemId = itemId || planId;
    const actualPlanId = itemId ? planId : undefined;
    if (a.role === 'DOCTOR') {
      const parentId = await this.s.itemPlanId(actualItemId);
      if (actualPlanId && actualPlanId !== parentId) throw new BadRequestException('ITEM_PLAN_MISMATCH');
      await this.authorizeExisting(a, parentId, b);
    }
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
