import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule, PublicJwtGuard, RabbitMqModule } from '@platform';
import { MedicalDatabaseModule } from './database/database.module';
import { MedicalModule } from './medical/medical.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PlatformModule,
    RabbitMqModule,
    MedicalDatabaseModule,
    MedicalModule,
  ],
  providers: [{ provide: APP_GUARD, useExisting: PublicJwtGuard }],
})
export class MedicalRecordServiceModule {}
