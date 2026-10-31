import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AppointmentDomainException } from './domain.exception';
@Catch()
export class AppointmentExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response=host.switchToHttp().getResponse<Response>();
    const status=error instanceof HttpException?error.getStatus():HttpStatus.INTERNAL_SERVER_ERROR;
    const code=error instanceof AppointmentDomainException?error.code:status===400?'VALIDATION_FAILED':status===401?'UNAUTHENTICATED':status===403?'FORBIDDEN':status===404?'RESOURCE_NOT_FOUND':status===409?'RESOURCE_CONFLICT':status===422?'BUSINESS_RULE_VIOLATION':status===503?'DEPENDENCY_UNAVAILABLE':'INTERNAL_ERROR';
    const message=error instanceof Error?error.message:'Internal server error';
    response.status(status).json({error:{code,message:status===500?'Internal server error':message,requestId:randomUUID(),...(error instanceof AppointmentDomainException&&error.details?{details:error.details}:{})}});
  }
}
