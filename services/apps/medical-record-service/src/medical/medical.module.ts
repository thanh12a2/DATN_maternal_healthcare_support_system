import { Module } from '@nestjs/common';
import { MedicalController } from './medical.controller';
import { MedicalGrpcController } from './medical-grpc.controller';
import { MedicalDomainService } from './medical.service';
@Module({
  controllers: [MedicalController, MedicalGrpcController],
  providers: [MedicalDomainService],
  exports: [MedicalDomainService],
})
export class MedicalModule {}
