import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import {
  CurrentAuth,
  PublicHttp,
  PublicJwtGuard,
  ServiceJwtGuard,
  ServiceScopes,
  type PublicAuthContext,
} from '@platform';
import { ConsultationAccessGateway } from './consultation-access.gateway';
import { ConsultationService } from './consultation.service';

@Controller()
export class ConsultationController {
  constructor(
    private readonly service: ConsultationService,
    private readonly access: ConsultationAccessGateway,
  ) {}

  @PublicHttp()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // ─── REST Endpoints ────────────────────────────────────────────────────────

  @UseGuards(PublicJwtGuard)
  @Post(['consultations', ''])
  async create(@Body() request: any, @CurrentAuth() auth: PublicAuthContext) {
    if (!['PATIENT', 'RECEPTIONIST', 'ADMIN'].includes(auth.role)) {
      throw new ForbiddenException('FORBIDDEN');
    }
    const patientId = await this.access.assertPatientOwner(
      request.patientId,
      auth,
    );
    return this.service.create({
      ...request,
      patientId,
      actorId: auth.userId,
    });
  }

  @UseGuards(PublicJwtGuard)
  @Get(['consultations', ''])
  async list(@Query() q: any, @CurrentAuth() auth: PublicAuthContext) {
    return this.service.list(q, auth, this.access);
  }

  @UseGuards(PublicJwtGuard)
  @Get(['consultations/:id', ':id'])
  async get(
    @Param('id') id: string,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    await this.service.authorizeParticipant(id, auth, this.access);
    return this.service.getRest(id);
  }

  @UseGuards(PublicJwtGuard)
  @Get(['consultations/:id/messages', ':id/messages'])
  async getMessages(
    @Param('id') id: string,
    @Query('limit') limit: string,
    @Query('afterSequence') afterSequence: string,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    await this.service.authorizeParticipant(id, auth, this.access);
    const after = afterSequence ? Number(afterSequence) : 0;
    if (!Number.isSafeInteger(after) || after < 0) throw new ForbiddenException('INVALID_SEQUENCE');
    return this.service.messagesRest(id, limit ? Number(limit) : 50, after);
  }

  @UseGuards(PublicJwtGuard)
  @Post(['consultations/:id/read', ':id/read'])
  async markRead(@Param('id') id: string, @Body() body: any, @CurrentAuth() auth: PublicAuthContext) {
    await this.service.authorizeParticipant(id, auth, this.access);
    return this.service.markRead(id, auth.userId, Number(body.sequenceNo));
  }

  @UseGuards(PublicJwtGuard)
  @Post(['consultations/:id/assign', ':id/assign'])
  assign(
    @Param('id') id: string,
    @Body() request: any,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    if (!['RECEPTIONIST', 'ADMIN'].includes(auth.role)) {
      throw new ForbiddenException('FORBIDDEN');
    }
    return this.service.assign(id, request.doctorId, auth.userId);
  }

  @UseGuards(PublicJwtGuard)
  @Post(['consultations/:id/messages', ':id/messages'])
  async message(
    @Param('id') id: string,
    @Body() request: any,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    await this.service.authorizeParticipant(id, auth, this.access);
    return this.service.message(id, {
      ...request,
      senderAccountId: auth.userId,
      senderType: auth.role,
    });
  }

  @UseGuards(PublicJwtGuard)
  @Post(['consultations/:id/close', ':id/close'])
  async close(
    @Param('id') id: string,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    await this.service.authorizeParticipant(id, auth, this.access);
    return this.service.close(id);
  }

  @UseGuards(PublicJwtGuard)
  @Post(['consultations/:id/escalations', ':id/escalations'])
  async raiseEscalation(
    @Param('id') id: string,
    @Body() request: any,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    await this.service.authorizeParticipant(id, auth, this.access);
    return this.service.raiseEscalation(id, request, auth.userId);
  }

  @UseGuards(PublicJwtGuard)
  @Get(['consultations/:id/escalations', ':id/escalations'])
  async listEscalations(
    @Param('id') id: string,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    await this.service.authorizeParticipant(id, auth, this.access);
    return this.service.listEscalations(id);
  }

  @UseGuards(PublicJwtGuard)
  @HttpCode(HttpStatus.OK)
  @Post([
    'consultations/:id/escalations/:escalationId/acknowledge',
    ':id/escalations/:escalationId/acknowledge',
  ])
  async acknowledgeEscalation(
    @Param('id') id: string,
    @Param('escalationId') escalationId: string,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    if (!['RECEPTIONIST', 'ADMIN'].includes(auth.role)) {
      throw new ForbiddenException('FORBIDDEN');
    }
    return this.service.acknowledgeEscalation(id, escalationId, auth.userId);
  }

  @UseGuards(PublicJwtGuard)
  @HttpCode(HttpStatus.OK)
  @Post([
    'consultations/:id/escalations/:escalationId/resolve',
    ':id/escalations/:escalationId/resolve',
  ])
  async resolveEscalation(
    @Param('id') id: string,
    @Param('escalationId') escalationId: string,
    @Body() request: any,
    @CurrentAuth() auth: PublicAuthContext,
  ) {
    if (!['RECEPTIONIST', 'ADMIN'].includes(auth.role)) {
      throw new ForbiddenException('FORBIDDEN');
    }
    return this.service.resolveEscalation(
      id,
      escalationId,
      request,
      auth.userId,
    );
  }

  // ─── gRPC Endpoints ────────────────────────────────────────────────────────

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('consultation:read')
  @GrpcMethod('ConsultationInternalService', 'GetConsultation')
  async getInternal(request: any) {
    return { consultation: await this.service.get(request.consultationId) };
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('consultation:read')
  @GrpcMethod('ConsultationInternalService', 'GetConsultationByAppointment')
  by(request: any) {
    return this.service.byAppointment(request.appointmentId);
  }

  @UseGuards(ServiceJwtGuard)
  @ServiceScopes('consultation:read')
  @GrpcMethod('ConsultationInternalService', 'ListConsultationMessages')
  messages(request: any) {
    return this.service.messages(request.consultationId, request.limit || 50);
  }
}
