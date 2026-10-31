import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServiceCallers, ServiceJwtGuard, ServiceScopes } from '@platform';
import { QueueDomainService } from './queue.service';
@Controller()
@UseGuards(ServiceJwtGuard)
export class QueueGrpcController {
  constructor(private readonly s: QueueDomainService) {}
  @GrpcMethod('QueueInternalService', 'CreateOrGetJourney')
  @ServiceCallers('receptionist-service')
  @ServiceScopes('queue:journey:create')
  create(r: any) {
    return this.s.create(r);
  }
  @GrpcMethod('QueueInternalService', 'EnqueueStage')
  @ServiceCallers('medical-record-service', 'receptionist-service')
  @ServiceScopes('queue:stage:create')
  enqueue(r: any) {
    return this.s.enqueue(r);
  }
  @GrpcMethod('QueueInternalService', 'GetJourney')
  @ServiceCallers('receptionist-service', 'medical-record-service')
  @ServiceScopes('queue:journey:read')
  get(r: any) {
    return this.s.get(r.journeyId || undefined, r.appointmentId || undefined);
  }
  @GrpcMethod('QueueInternalService', 'EstimateWait')
  @ServiceCallers('appointment-service')
  @ServiceScopes('queue:estimate')
  estimate(r: any) {
    return this.s.estimate(r.stageCode);
  }
  @GrpcMethod('QueueInternalService', 'CancelWaitingTickets')
  @ServiceCallers('appointment-service', 'receptionist-service')
  @ServiceScopes('queue:cancel')
  cancel(r: any) {
    return this.s.cancelWaiting(r.journeyId, r.reason);
  }
}
