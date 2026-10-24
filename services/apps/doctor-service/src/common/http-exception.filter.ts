import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

@Catch()
export class DoctorExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest<{ requestId?: string }>();
    const requestId = request.requestId ?? randomUUID();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const raw =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      typeof raw === 'string'
        ? raw
        : typeof raw === 'object' && raw !== null && 'message' in raw
          ? (raw as { message: unknown }).message
          : 'Internal server error';
    const code =
      typeof message === 'string' && /^[A-Z0-9_]+$/.test(message)
        ? message
        : this.codeForStatus(status);
    const details = Array.isArray(message)
      ? message.map((item) => ({ reason: String(item) }))
      : [];
    response.status(status).json({
      error: {
        code,
        message:
          code === 'INTERNAL_SERVER_ERROR'
            ? 'Internal server error'
            : String(message),
        details,
        requestId,
      },
    });
  }

  private codeForStatus(status: number): string {
    return (
      (
        {
          400: 'VALIDATION_FAILED',
          401: 'UNAUTHENTICATED',
          403: 'FORBIDDEN',
          404: 'ROUTE_NOT_FOUND',
          409: 'BUSINESS_RULE_VIOLATION',
          422: 'BUSINESS_RULE_VIOLATION',
          503: 'DEPENDENCY_UNAVAILABLE',
        } as Record<number, string>
      )[status] ?? 'INTERNAL_SERVER_ERROR'
    );
  }
}
