import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Response } from 'express';
import type { PatientRequest } from './request-context';
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: PatientRequest, res: Response, next: NextFunction): void {
    const v = req.header('x-request-id');
    req.requestId = v && /^[0-9a-f-]{36}$/i.test(v) ? v : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('Cache-Control', 'no-store');
    next();
  }
}
