import { Global, Module } from '@nestjs/common';
import { MedicalPrismaService } from './prisma.service';
@Global()
@Module({ providers: [MedicalPrismaService], exports: [MedicalPrismaService] })
export class MedicalDatabaseModule {}
