import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentAuth,
  PublicHttp,
  PublicJwtGuard,
  type PublicAuthContext,
} from '@platform';
import { TicketState } from '../../../../generated/queue-client';
import { QueueDomainService } from './queue.service';
import { PatientDependencyGateway } from './patient-dependency.gateway';

@Controller()
@UseGuards(PublicJwtGuard)
export class QueueController {
  constructor(
    private readonly s: QueueDomainService,
    private readonly patient: PatientDependencyGateway,
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
  call(
    @Param('stageId') id: string,
    @Body() b: any,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.s.callNext(id, a.userId, b?.overrideTicketId, b?.reason, b?.roomCode);
  }

  @Post('tickets/:id/start')
  start(@Param('id') id: string, @Body() b: any) {
    return this.s.transition(id, TicketState.IN_SERVICE, b.expectedVersion);
  }

  @Post('tickets/:id/complete')
  complete(@Param('id') id: string, @Body() b: any) {
    return this.s.transition(id, TicketState.COMPLETED, b.expectedVersion);
  }

  @Post('tickets/:id/requeue')
  requeue(@Param('id') id: string, @Body() b: any) {
    return this.s.transition(
      id,
      TicketState.WAITING,
      b.expectedVersion,
      b.reason,
    );
  }

  @Post('tickets/:id/cancel')
  cancel(@Param('id') id: string, @Body() b: any) {
    return this.s.transition(
      id,
      TicketState.CANCELLED,
      b.expectedVersion,
      b.reason,
    );
  }
}
