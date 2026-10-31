import { Injectable } from '@nestjs/common';

export interface HealthCheckResponse {
  status: 'ok';
}

@Injectable()
export class AuthServiceService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): HealthCheckResponse {
    return { status: 'ok' };
  }
}
