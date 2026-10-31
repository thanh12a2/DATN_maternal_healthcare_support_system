import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueGrpcController } from './queue-grpc.controller';
import { QueueDomainService } from './queue.service';
import { PatientDependencyGateway } from './patient-dependency.gateway';
import { QueueRealtimeService } from './queue-realtime.service';
@Module({
  controllers: [QueueController, QueueGrpcController],
  providers: [QueueDomainService, PatientDependencyGateway, QueueRealtimeService],
  exports: [QueueDomainService],
})
export class QueueModule {}
