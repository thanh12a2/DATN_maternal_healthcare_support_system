import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import type { PatientRequest } from './request-context';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<PatientRequest>();
    const response = context.getResponse<Response>();
    const http = exception as {
      getStatus?: () => number;
      getResponse?: () => unknown;
      code?: unknown;
    };
    let status = typeof http?.getStatus === 'function' ? http.getStatus() : 500;
    if (
      status === 500 &&
      typeof http?.code === 'string' &&
      /^P10(?:0[0-9]|1[0-7])$/.test(http.code)
    ) {
      status = 503;
    }
    const payload = typeof http?.getResponse === 'function'
      ? http.getResponse()
      : undefined;
    const body = payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {};
    const explicitCode = typeof body.code === 'string' ? body.code : undefined;
    const code = explicitCode ?? this.defaultCode(status);
    const message =
      explicitCode && typeof body.message === 'string'
        ? body.message
        : this.defaultMessage(status);
    response.status(status).json({
      error: { code, message, requestId: request.requestId },
    });
  }

  private defaultCode(status: number): string {
    if (status === 400) return 'VALIDATION_FAILED';
    if (status === 401) return 'UNAUTHENTICATED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 413) return 'PAYLOAD_TOO_LARGE';
    if (status === 503) return 'SERVICE_UNAVAILABLE';
    return 'INTERNAL_ERROR';
  }

  private defaultMessage(status: number): string {
    if (status === 400) return 'Request validation failed';
    if (status === 401) return 'Authentication is required';
    if (status === 403) return 'Access is forbidden';
    if (status === 404) return 'Resource was not found';
    if (status === 413) return 'Request payload is too large';
    if (status === 503) return 'Patient database is unavailable';
    return 'An internal error occurred';
  }
}
