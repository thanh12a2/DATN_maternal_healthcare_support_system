import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule, PublicJwtGuard, RabbitMqModule } from '@platform';
import { AppointmentDatabaseModule } from './database/database.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AppointmentServiceController } from './appointment-service.controller';
@Module({imports:[ConfigModule.forRoot({isGlobal:true}),PlatformModule,RabbitMqModule,AppointmentDatabaseModule,AppointmentsModule],controllers:[AppointmentServiceController],providers:[{provide:APP_GUARD,useExisting:PublicJwtGuard}]}) export class AppointmentServiceModule {}
