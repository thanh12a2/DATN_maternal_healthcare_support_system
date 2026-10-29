import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CurrentAuth,
  PublicHttp,
  PublicJwtGuard,
  type PublicAuthContext,
} from '@platform';
import { TicketState } from '../../../../generated/queue-client';
import { QueueDomainService } from './queue.service';
import { PatientDependencyGateway } from './patient-dependency.gateway';
import { QueueRealtimeService } from './queue-realtime.service';

const CLINICAL_ROLES = ['DOCTOR', 'ADMIN', 'NURSE'];
function assertClinicalRole(auth: PublicAuthContext) {
  if (!CLINICAL_ROLES.includes(auth.role)) {
    throw new ForbiddenException('Chỉ bác sĩ hoặc nhân viên lâm sàng mới có quyền gọi số và phục vụ bệnh nhân.');
  }
}

@Controller()
@UseGuards(PublicJwtGuard)
export class QueueController {
  constructor(
    private readonly s: QueueDomainService,
    private readonly patient: PatientDependencyGateway,
    private readonly realtime: QueueRealtimeService,
  ) {}

  @PublicHttp()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('stages')
  async listStages() {
    const data = await this.s.listStages();
    return { data };
  }

  @Get('stages/:stageId/tickets')
  async listStageTickets(
    @Param('stageId') stageId: string,
    @Query() query: any,
  ) {
    return this.s.listStageTickets(stageId, query);
  }

  @Get('me/events')
  async streamMyEvents(
    @CurrentAuth() a: PublicAuthContext,
    @Res() response: Response,
  ): Promise<void> {
    const patientId = await this.patient.resolvePatientId(a.userId);
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    response.write(': connected\n\n');

    const unsubscribe = this.realtime.subscribe(patientId, (event) => {
      response.write('event: ' + event.eventType + '\n');
      response.write('data: ' + JSON.stringify(event.data) + '\n\n');
    });
    const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 25_000);
    response.once('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }

  @Get('me/journeys/active')
  async getMyActiveJourney(@CurrentAuth() a: PublicAuthContext) {
    const patientId = await this.patient.resolvePatientId(a.userId);
    const data = await this.s.getActiveJourney(patientId);
    return { data, id: data.id };
  }

  @Get('journeys/:id')
  async getJourney(@Param('id') id: string) {
    const data = await this.s.getJourneyById(id);
    return { data, id: data.id };
  }

  @Post('journeys')
  async createJourneyRest(@Body() b: any) {
    const data = await this.s.createOrGetJourneyRest(b);
    return { data, id: data.id };
  }

  @Post('stages/:stageId/call-next')
  async call(
    @Param('stageId') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    assertClinicalRole(a);
    const ticket = await this.s.callNext(id, a.userId, b?.overrideTicketId, b?.reason);
    if (ticket?.id) await this.s.notifyTicketChange(ticket.id, 'queue.ticket_called.v1');
    return ticket;
  }

  @Post('tickets/:id/start')
  async start(@Param('id') id: string, @Body() b: any, @CurrentAuth() a: PublicAuthContext) {
    assertClinicalRole(a);
    const ticket = await this.s.transition(id, TicketState.IN_SERVICE, b.expectedVersion);
    await this.s.notifyTicketChange(id, 'queue.ticket_service_started.v1');
    return ticket;
  }

  @Post('tickets/:id/complete')
  async complete(@Param('id') id: string, @Body() b: any, @CurrentAuth() a: PublicAuthContext) {
    assertClinicalRole(a);
    const ticket = await this.s.transition(id, TicketState.COMPLETED, b.expectedVersion);
    await this.s.notifyTicketChange(id, 'queue.ticket_completed.v1');
    return ticket;
  }

  @Post('tickets/:id/requeue')
  async requeue(@Param('id') id: string, @Body() b: any, @CurrentAuth() a: PublicAuthContext) {
    assertClinicalRole(a);
    const ticket = await this.s.transition(
      id,
      TicketState.WAITING,
      b.expectedVersion,
      b.reason,
    );
    await this.s.notifyTicketChange(id, 'queue.ticket_requeued.v1');
    return ticket;
  }

  @Post('tickets/:id/cancel')
  async cancel(@Param('id') id: string, @Body() b: any, @CurrentAuth() a: PublicAuthContext) {
    assertClinicalRole(a);
    const ticket = await this.s.transition(
      id,
      TicketState.CANCELLED,
      b.expectedVersion,
      b.reason,
    );
    await this.s.notifyTicketChange(id, 'queue.ticket_cancelled.v1');
    return ticket;
  }
}
