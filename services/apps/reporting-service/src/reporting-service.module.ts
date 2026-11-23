import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule, RabbitMqModule } from '@platform';
import { DatabaseModule } from './database/database.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { ReportingPdfService } from './reporting-pdf.service';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PlatformModule,
    RabbitMqModule,
    DatabaseModule,
  ],
  controllers: [ReportingController],
  providers: [ReportingService, ReportingPdfService],
})
export class ReportingServiceModule {}
