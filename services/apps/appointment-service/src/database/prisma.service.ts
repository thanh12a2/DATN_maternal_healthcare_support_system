import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../../generated/appointment-client';
@Injectable()
export class AppointmentPrismaService extends PrismaClient implements OnModuleDestroy { async onModuleDestroy(){ await this.$disconnect(); } }
