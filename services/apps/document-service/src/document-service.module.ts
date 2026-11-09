import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule, RabbitMqModule } from '@platform';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { DocumentDatabaseModule } from './database/database.module';
import { ClinicalResultsController } from './clinical-results.controller';
import { ClinicalResultsGrpcController } from './clinical-results-grpc.controller';
import { ClinicalResultsService } from './clinical-results.service';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PlatformModule,
    RabbitMqModule,
    DocumentDatabaseModule,
  ],
  controllers: [
    ClinicalResultsController,
    ClinicalResultsGrpcController,
    DocumentController,
  ],
  providers: [DocumentService, ClinicalResultsService],
})
export class DocumentServiceModule {}
