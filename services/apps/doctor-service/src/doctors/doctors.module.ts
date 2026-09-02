import { Module } from '@nestjs/common';
import { DoctorController } from './doctor.controller';
import { DoctorDomainService } from './doctor.service';

@Module({
  controllers: [DoctorController],
  providers: [DoctorDomainService],
  exports: [DoctorDomainService],
})
export class DoctorsModule {}
