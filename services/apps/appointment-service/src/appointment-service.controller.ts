import { Controller, Get } from '@nestjs/common';
import { PublicHttp } from '@platform';
import { AppointmentPrismaService } from './database/prisma.service';
@Controller() export class AppointmentServiceController { constructor(private readonly db:AppointmentPrismaService){} @PublicHttp() @Get('health') health(){return {status:'ok'};} @PublicHttp() @Get('ready') async ready(){await this.db.$queryRawUnsafe('SELECT 1');return {status:'ready'};} }
