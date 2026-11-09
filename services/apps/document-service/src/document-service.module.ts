import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule, RabbitMqModule } from '@platform';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { DocumentDatabaseModule } from './database/database.module';
import { ClinicalResultsController } from './clinical-results.controller';
import { ClinicalResultsService } from './clinical-results.service';
import { MedicalReportPdfService } from './medical-report-pdf.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PlatformModule, RabbitMqModule, DocumentDatabaseModule],
  controllers: [ClinicalResultsController, DocumentController],
  providers: [DocumentService, ClinicalResultsService, MedicalReportPdfService],
})
export class DocumentServiceModule {}

