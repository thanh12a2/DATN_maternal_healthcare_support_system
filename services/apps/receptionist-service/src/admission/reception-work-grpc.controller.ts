import { Controller, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServiceCallers, ServiceJwtGuard, ServiceScopes } from '@platform';
import { ReceptionWorkService } from './reception-work.service';

@Controller()
@UseGuards(ServiceJwtGuard)
export class ReceptionWorkGrpcController {
  constructor(private readonly work: ReceptionWorkService) {}

  @GrpcMethod('ReceptionWorkInternalService', 'GetAppointmentOwner')
  @ServiceCallers('appointment-service', 'billing-service')
  @ServiceScopes('reception:work:read')
  getAppointmentOwner(request: { appointmentId: string }) {
    return this.work.getAppointmentOwner(request.appointmentId);
  }

  @GrpcMethod('ReceptionWorkInternalService', 'BeginOperation')
  @ServiceCallers('appointment-service', 'billing-service')
  @ServiceScopes('reception:work:write')
  beginOperation(request: { appointmentId: string; accountId: string }) {
    return this.work.beginOperation(request.appointmentId, request.accountId);
  }

  @GrpcMethod('ReceptionWorkInternalService', 'EndOperation')
  @ServiceCallers('appointment-service', 'billing-service')
  @ServiceScopes('reception:work:write')
  endOperation(request: { token: string }) {
    return this.work.endOperation(request.token);
  }
}
