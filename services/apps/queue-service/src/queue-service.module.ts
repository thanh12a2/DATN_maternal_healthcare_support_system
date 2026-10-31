import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule, PublicJwtGuard, RabbitMqModule } from '@platform';
import { QueueDatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PlatformModule,
    RabbitMqModule,
    QueueDatabaseModule,
    QueueModule,
  ],
  providers: [{ provide: APP_GUARD, useExisting: PublicJwtGuard }],
})
export class QueueServiceModule {}
