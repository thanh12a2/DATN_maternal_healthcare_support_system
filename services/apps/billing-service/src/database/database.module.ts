import { Global, Module } from '@nestjs/common';
import { BillingPrismaService } from './prisma.service';
@Global() @Module({providers:[BillingPrismaService],exports:[BillingPrismaService]}) export class BillingDatabaseModule {}
