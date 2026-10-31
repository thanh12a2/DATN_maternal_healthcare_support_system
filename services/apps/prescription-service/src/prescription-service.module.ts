import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClinicalDoctorAccess, PlatformModule, RabbitMqModule } from '@platform';
import { MedicationCatalogController } from './medications/medication-catalog.controller';
import { MedicationCatalogService } from './medications/medication-catalog.service';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionService } from './prescription.service';
import { PrescriptionDatabaseModule } from './database/database.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PlatformModule, RabbitMqModule, PrescriptionDatabaseModule],
  controllers: [MedicationCatalogController, PrescriptionController],
  providers: [PrescriptionService, MedicationCatalogService, ClinicalDoctorAccess],
})
export class PrescriptionServiceModule {}
