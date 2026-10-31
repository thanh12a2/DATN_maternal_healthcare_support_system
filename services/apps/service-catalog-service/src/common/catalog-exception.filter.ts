import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class CatalogExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ requestId?: string }>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const payload = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
    response.status(status).json({
      error: {
        code: typeof payload.code === 'string' ? payload.code : this.defaultCode(status),
        message:
          typeof payload.message === 'string'
            ? payload.message
            : Array.isArray(payload.message)
              ? 'Request validation failed'
              : this.defaultMessage(status),
        details: payload.details ?? (Array.isArray(payload.message) ? payload.message : undefined),
        requestId: request.requestId,
      },
    });
  }

  private defaultCode(status: number): string {
    if (status === 400) return 'VALIDATION_FAILED';
    if (status === 401) return 'UNAUTHENTICATED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    if (status === 503) return 'SERVICE_UNAVAILABLE';
    return 'INTERNAL_ERROR';
  }

  private defaultMessage(status: number): string {
    if (status === 400) return 'Request validation failed';
    if (status === 401) return 'Authentication is required';
    if (status === 403) return 'Access is forbidden';
    if (status === 404) return 'Resource was not found';
    if (status === 409) return 'Request conflicts with current state';
    if (status === 503) return 'Catalog database is unavailable';
    return 'An internal error occurred';
  }
}
