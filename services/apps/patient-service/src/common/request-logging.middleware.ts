import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { PatientRequest } from './request-context';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('PatientHttp');

  use(request: PatientRequest, response: Response, next: NextFunction): void {
    const started = process.hrtime.bigint();
    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      this.logger.log(
        JSON.stringify({
          event: 'http_request',
          requestId: request.requestId,
          method: request.method,
          statusCode: response.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
        }),
      );
    });
    next();
  }
}
