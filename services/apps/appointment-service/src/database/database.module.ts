import { Global, Module } from '@nestjs/common';
import { AppointmentPrismaService } from './prisma.service';
@Global() @Module({providers:[AppointmentPrismaService],exports:[AppointmentPrismaService]}) export class AppointmentDatabaseModule {}
