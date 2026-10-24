import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformModule, RabbitMqModule } from '@platform';
import { PrescriptionController } from './prescription.controller';
import { PrescriptionService } from './prescription.service';
import { PrescriptionDatabaseModule } from './database/database.module';
import { MedicationCatalogController } from './medications/medication-catalog.controller';
import { MedicationCatalogService } from './medications/medication-catalog.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PlatformModule,
    RabbitMqModule,
    PrescriptionDatabaseModule,
  ],
  // Medication routes must be registered before the legacy '/:id' prescription route.
  controllers: [MedicationCatalogController, PrescriptionController],
  providers: [MedicationCatalogService, PrescriptionService],
})
export class PrescriptionServiceModule {}
