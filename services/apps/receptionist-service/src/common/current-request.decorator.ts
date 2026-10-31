import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ReceptionRequest } from './request-context';

export const CurrentRequestId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<ReceptionRequest>().requestId,
);
