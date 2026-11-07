import { Module } from '@nestjs/common';
import { AppointmentController } from './appointment.controller';
import { AppointmentGrpcController } from './appointment-grpc.controller';
import { AppointmentDomainService } from './appointment.service';
import { AppointmentDependencyGateway } from './dependency.gateway';
import { AppointmentRealtimeService } from './appointment-realtime.service';

import { NotificationOutboxService } from './notification-outbox.service';
@Module({
  controllers: [AppointmentController, AppointmentGrpcController],
  providers: [
    AppointmentDomainService,
    AppointmentDependencyGateway,NotificationOutboxService,
    AppointmentRealtimeService,
  ],
  exports: [AppointmentDomainService, AppointmentRealtimeService],
})
export class AppointmentsModule {}
