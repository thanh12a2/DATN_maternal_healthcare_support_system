import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CurrentAuth,
  PublicJwtGuard,
  ReceptionWorkAccess,
  type PublicAuthContext,
} from '@platform';
import { AppointmentDomainService } from './appointment.service';
import { AppointmentRealtimeService } from './appointment-realtime.service';
import {
  AppointmentListDto,
  CreateAppointmentDto,
  CreateHoldDto,
  DoctorOccupancyDto,
  ReassignDto,
  ReasonVersionDto,
  RescheduleDto,
  SlotQueryDto,
} from './dto';

@Controller()
@UseGuards(PublicJwtGuard)
export class AppointmentController {
  constructor(
    private readonly service: AppointmentDomainService,
    private readonly realtime: AppointmentRealtimeService,
    private readonly receptionWork: ReceptionWorkAccess,
  ) {}

  @Get('desk/stream')
  streamDesk(@CurrentAuth() a: PublicAuthContext, @Res() res: Response): void {
    if (
      a.role !== 'RECEPTIONIST' &&
      a.role !== 'ADMIN' &&
      a.role !== 'CLINIC_MANAGER' &&
      a.role !== 'DOCTOR'
    ) {
      throw new ForbiddenException('Staff only');
    }
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(': connected\n\n');

    const unsubscribe = this.realtime.subscribeDesk((event) => {
      res.write('event: ' + event.eventType + '\n');
      res.write('data: ' + JSON.stringify(event) + '\n\n');
    });

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 20_000);

    res.once('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }

  @Get('me/stream')
  async streamMe(
    @CurrentAuth() a: PublicAuthContext,
    @Res() res: Response,
  ): Promise<void> {
    if (a.role !== 'PATIENT') {
      throw new ForbiddenException('Patient only');
    }
    const patientId = await this.service.resolvePatientIdForAuth(a);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(': connected\n\n');

    const unsubscribe = this.realtime.subscribePatient(patientId, (event) => {
      res.write('event: ' + event.eventType + '\n');
      res.write('data: ' + JSON.stringify(event) + '\n\n');
    });

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 20_000);

    res.once('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }

  @Get('bookable-slots')
  slots(@Query() q: SlotQueryDto, @CurrentAuth() a: PublicAuthContext) {
    return this.service.listBookableSlots(q, a);
  }

  @Post('slot-holds')
  hold(
    @Body() d: CreateHoldDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.service.createHold(d, a, k);
  }

  @Delete('slot-holds/:holdId')
  async release(
    @Param('holdId') id: string,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    await this.service.releaseHold(id, a);
  }

  @Post('appointments')
  create(
    @Body() d: CreateAppointmentDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.service.createAppointment(d, a, k);
  }

  @Get('appointments')
  list(@Query() q: AppointmentListDto, @CurrentAuth() a: PublicAuthContext) {
    return this.service.list(q, a);
  }

  @Get('doctor-occupancy')
  occupancy(
    @Query() q: DoctorOccupancyDto,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.service.doctorOccupancy(q, a);
  }

  @Get('appointments/:id')
  get(@Param('id') id: string, @CurrentAuth() a: PublicAuthContext) {
    return this.service.get(id, a);
  }

  @Post('appointments/:id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() d: ReasonVersionDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.receptionWork.run(id, a.userId, () =>
      this.service.cancel(id, d, a, k),
    );
  }

  @Post('appointments/:id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() d: RescheduleDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.receptionWork.run(id, a.userId, () =>
      this.service.reschedule(id, d, a, k),
    );
  }

  @Post('appointments/:id/reassign')
  reassign(
    @Param('id') id: string,
    @Body() d: ReassignDto,
    @CurrentAuth() a: PublicAuthContext,
    @Headers('idempotency-key') k?: string,
  ) {
    return this.receptionWork.run(id, a.userId, () =>
      this.service.reassign(id, d, a, k),
    );
  }

  @Post('appointments/:id/reassignment-required')
  requestReassignment(
    @Param('id') id: string,
    @Body() d: ReasonVersionDto,
    @CurrentAuth() a: PublicAuthContext,
  ) {
    return this.receptionWork.run(id, a.userId, () =>
      this.service.requestReassignment(id, d, a),
    );
  }
}
