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
import { PrescriptionStatus } from '../../../generated/prescription-client';
import { PrescriptionService } from './prescription.service';

@Controller()
export class PrescriptionController {
  constructor(private readonly s: PrescriptionService, private readonly access: ClinicalDoctorAccess) {}

  private async authorizeWrite(a: PublicAuthContext, encounterId: string, patientId: string, allowFinalized = false) {
    if (a.role !== 'DOCTOR') return;
    if (!patientId) throw new BadRequestException('PATIENT_REQUIRED');
    const encounter = await this.access.assertEncounter(a, encounterId, patientId);
    const states = ['IN_PROGRESS', 'ENCOUNTER_STATE_IN_PROGRESS', ...(allowFinalized ? ['FINALIZED', 'ENCOUNTER_STATE_FINALIZED'] : [])];
    if (!states.includes(encounter.state)) throw new ConflictException('ENCOUNTER_NOT_IN_PROGRESS');
    return encounter.resolvedDoctorId as string;
  }

  private async authorizeExisting(a: PublicAuthContext, id: string, b: any, allowFinalized = false) {
    if (a.role !== 'DOCTOR') return;
    if (!Number.isInteger(b?.version) || b.version < 1) throw new BadRequestException('VERSION_REQUIRED');
    const { data } = await this.s.getRest(id);
    await this.authorizeWrite(a, data.encounterId, data.patientId, allowFinalized && data.status === 'ISSUED');
  }

  @PublicHttp()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // ─── REST Endpoints ────────────────────────────────────────────────────────

  @UseGuards(PublicJwtGuard)
  @Post(['', 'prescriptions'])
  async createPrescription(
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR' && (!Array.isArray(b.items) || !b.items.length || b.items.some((x: any) => !String(x.medicationName ?? '').trim() || !String(x.dose ?? '').trim() || !String(x.frequency ?? '').trim()))) throw new BadRequestException('PRESCRIPTION_ITEMS_REQUIRED');
    const doctorId = await this.authorizeWrite(a, b.encounterId, b.patientId);
    return this.s.createRest(b, a, doctorId);
  }

  @UseGuards(PublicJwtGuard)
  @Get(['', 'prescriptions'])
  async listPrescriptions(@Query() q: any, @CurrentAuth() a: PublicAuthContext) {
    if (a.role === 'DOCTOR') await this.access.assertEncounter(a, q?.encounterId, q?.patientId);
    return this.s.listRest(q);
  }

  @UseGuards(PublicJwtGuard)
  @Get([':id', 'prescriptions/:id'])
  async getPrescription(@Param('id') id: string, @CurrentAuth() a: PublicAuthContext) {
    const result = await this.s.getRest(id);
    if (a.role === 'DOCTOR') await this.access.assertEncounter(a, result.data.encounterId, result.data.patientId);
    return result;
  }

  @UseGuards(PublicJwtGuard)
  @Patch([':id', 'prescriptions/:id'])
  async updatePrescriptionDraft(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR' && b.items !== undefined && (!Array.isArray(b.items) || !b.items.length || b.items.some((x: any) => !String(x.medicationName ?? '').trim() || !String(x.dose ?? '').trim() || !String(x.frequency ?? '').trim()))) throw new BadRequestException('PRESCRIPTION_ITEMS_REQUIRED');
    await this.authorizeExisting(a, id, b);
    return this.s.updateRest(id, b);
  }

  @UseGuards(PublicJwtGuard)
  @Post([':id/issue', 'prescriptions/:id/issue'])
  async issuePrescription(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    await this.authorizeExisting(a, id, b);
    return this.s.issueRest(id, b);
  }

  @UseGuards(PublicJwtGuard)
  @Post([':id/cancel', 'prescriptions/:id/cancel'])
  async cancelPrescription(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    await this.authorizeExisting(a, id, b, true);
    return this.s.cancelRest(id, b);
  }

  // ─── gRPC Endpoints ────────────────────────────────────────────────────────

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('prescription:clinical')
  @GrpcMethod('PrescriptionInternalService', 'CreateDraftPrescription')
  create(r: any) {
    return this.s.create(r);
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('prescription:read')
  @GrpcMethod('PrescriptionInternalService', 'GetPrescription')
  get(r: any) {
    return this.s.get(r.prescriptionId);
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('prescription:read')
  @GrpcMethod('PrescriptionInternalService', 'ListPrescriptionsByEncounter')
  list(r: any) {
    return this.s.list(r.encounterId);
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('prescription:clinical')
  @GrpcMethod('PrescriptionInternalService', 'IssuePrescription')
  issue(r: any) {
    return this.s.command(
      r.prescriptionId,
      Number(r.expectedVersion),
      PrescriptionStatus.ISSUED,
    );
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('prescription:clinical')
  @GrpcMethod('PrescriptionInternalService', 'CancelPrescription')
  cancel(r: any) {
    return this.s.command(
      r.prescriptionId,
      Number(r.expectedVersion),
      PrescriptionStatus.CANCELLED,
      r.reason,
    );
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('prescription:read')
  @GrpcMethod('PrescriptionInternalService', 'ValidatePrescriptionReference')
  validate(r: any) {
    return this.s.validate(r);
  }
}
