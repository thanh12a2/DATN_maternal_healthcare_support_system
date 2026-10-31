import { Controller, Get } from '@nestjs/common';
import { PublicHttp } from '@platform';
import { BillingPrismaService } from './database/prisma.service';
@Controller() export class BillingServiceController { constructor(private readonly db:BillingPrismaService){} @PublicHttp() @Get('health') health(){return {status:'ok'};} @PublicHttp() @Get('ready') async ready(){await this.db.$queryRawUnsafe('SELECT 1');return {status:'ready'};} }
