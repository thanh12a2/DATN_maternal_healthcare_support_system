import { Module } from '@nestjs/common';
import { MedicalController } from './medical.controller';
import { MedicalGrpcController } from './medical-grpc.controller';
import { MedicalDomainService } from './medical.service';
import { DoctorIdentityGateway } from './doctor-identity.gateway';
@Module({
  controllers: [MedicalController, MedicalGrpcController],
  providers: [MedicalDomainService, DoctorIdentityGateway],
  exports: [MedicalDomainService],
})
export class MedicalModule {}
