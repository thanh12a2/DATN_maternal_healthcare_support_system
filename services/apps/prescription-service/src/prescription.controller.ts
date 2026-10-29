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
import { PrescriptionStatus } from '../../../generated/prescription-client';
import { PrescriptionService } from './prescription.service';

@Controller()
export class PrescriptionController {
  constructor(private readonly s: PrescriptionService, private readonly access: ClinicalDoctorAccess) {}

  @PublicHttp()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // ─── REST Endpoints ────────────────────────────────────────────────────────

  @UseGuards(PublicJwtGuard)
  @Post(['', 'prescriptions'])
  createPrescription(
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR') throw new ForbiddenException('CLINICAL_WRITE_NOT_AVAILABLE');
    return this.s.createRest(b, a);
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
  updatePrescriptionDraft(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR') throw new ForbiddenException('CLINICAL_WRITE_NOT_AVAILABLE');
    return this.s.updateRest(id, b);
  }

  @UseGuards(PublicJwtGuard)
  @Post([':id/issue', 'prescriptions/:id/issue'])
  issuePrescription(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR') throw new ForbiddenException('CLINICAL_WRITE_NOT_AVAILABLE');
    return this.s.issueRest(id, b);
  }

  @UseGuards(PublicJwtGuard)
  @Post([':id/cancel', 'prescriptions/:id/cancel'])
  cancelPrescription(
    @Param('id') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    if (a.role === 'DOCTOR') throw new ForbiddenException('CLINICAL_WRITE_NOT_AVAILABLE');
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
