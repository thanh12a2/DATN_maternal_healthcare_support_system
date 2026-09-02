import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { ReceptionRequest } from './request-context';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: ReceptionRequest, response: Response, next: NextFunction): void {
    const suppliedRequestId = request.header('x-request-id');
    request.requestId =
      suppliedRequestId && UUID_PATTERN.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    next();
  }
}
