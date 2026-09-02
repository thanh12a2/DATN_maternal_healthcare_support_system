import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { ReceptionRequest } from './request-context';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<ReceptionRequest>();

    if (request.path === '/health') {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => ({
        data,
        meta: { requestId: request.requestId },
      })),
    );
  }
}
