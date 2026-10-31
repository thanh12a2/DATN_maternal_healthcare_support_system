import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../../generated/billing-client';
@Injectable()
export class BillingPrismaService extends PrismaClient implements OnModuleDestroy { async onModuleDestroy(){ await this.$disconnect(); } }
