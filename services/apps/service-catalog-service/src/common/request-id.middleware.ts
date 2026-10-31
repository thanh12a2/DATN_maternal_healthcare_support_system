import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, res: Response, next: NextFunction): void {
    const value = req.headers['x-request-id'];
    req.requestId = typeof value === 'string' && value.length > 0 ? value : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  }
}
