import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ReceptionRequest } from './request-context';

interface ExceptionBody {
  code?: unknown;
  message?: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<ReceptionRequest>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!(exception instanceof HttpException)) {
      this.logger.error('Unhandled receptionist service error', exception);
    }

    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const parsedBody: ExceptionBody =
      typeof body === 'object' && body !== null ? body : {};
    const code =
      typeof parsedBody.code === 'string'
        ? parsedBody.code
        : this.defaultCode(status);
    const message =
      typeof parsedBody.message === 'string'
        ? parsedBody.message
        : this.defaultMessage(status);

    response.status(status).json({
      error: {
        code,
        message,
        requestId: request.requestId,
      },
    });
  }

  private defaultCode(status: number): string {
    switch (status) {
      case 400:
        return 'VALIDATION_FAILED';
      case 401:
        return 'UNAUTHENTICATED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      default:
        return 'INTERNAL_ERROR';
    }
  }

  private defaultMessage(status: number): string {
    return status >= 500
      ? 'An internal error occurred'
      : 'The request could not be completed';
  }
}
