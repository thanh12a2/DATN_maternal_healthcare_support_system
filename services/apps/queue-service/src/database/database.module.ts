import { Global, Module } from '@nestjs/common';
import { QueuePrismaService } from './prisma.service';
@Global()
@Module({ providers: [QueuePrismaService], exports: [QueuePrismaService] })
export class QueueDatabaseModule {}
