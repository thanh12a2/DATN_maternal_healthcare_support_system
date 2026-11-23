import { Module } from '@nestjs/common';
import { DoctorController } from './doctor.controller';
import { DoctorDomainService } from './doctor.service';
import { ProfileImageModule } from '@platform';
import { DoctorPhotoService } from './doctor-photo.service';

@Module({
  imports: [ProfileImageModule],
  controllers: [DoctorController],
  providers: [DoctorDomainService, DoctorPhotoService],
  exports: [DoctorDomainService],
})
export class DoctorsModule {}
