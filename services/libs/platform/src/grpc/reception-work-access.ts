import { ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GrpcClientFactory } from './grpc-client.factory';

/** Holds the case while a staff mutation executes, so it cannot be handed over mid-operation. */
@Injectable()
export class ReceptionWorkAccess {
  private readonly logger = new Logger(ReceptionWorkAccess.name);
  constructor(private readonly config: ConfigService, private readonly grpc: GrpcClientFactory) {}

  async run<T>(appointmentId: string, accountId: string, action: () => Promise<T>): Promise<T> {
    const client = this.grpc.client({ key: 'reception-work-access', target: this.config.get<string>('RECEPTIONIST_GRPC_TARGET') ?? 'receptionist-service:6006', proto: 'receptionist/v1/reception_work_internal.proto', package: 'maternal.receptionist.v1', service: 'ReceptionWorkInternalService' });
    const metadata = this.grpc.metadata('receptionist-service', ['reception:work:write']);
    let result: { allowed: boolean; token: string };
    try {
      result = await this.grpc.unary(client, 'beginOperation', { appointmentId, accountId }, metadata);
    } catch {
      throw new ServiceUnavailableException('Không thể kiểm tra quyền xử lý case. Vui lòng thử lại.');
    }
    if (!result.allowed) throw new ConflictException('Case đã có người xử lý hoặc đang thực hiện thao tác khác.');
    try {
      return await action();
    } finally {
      if (result.token) {
        try { await this.grpc.unary(client, 'endOperation', { token: result.token }, metadata); }
        catch {
          this.logger.warn('Could not release a reception operation; retrying');
          this.retryRelease(client, result.token);
        }
      }
    }
  }

  private retryRelease(client: ReturnType<GrpcClientFactory['client']>, token: string) {
    const timer = setTimeout(() => {
      try {
        const metadata = this.grpc.metadata('receptionist-service', ['reception:work:write']);
        void this.grpc.unary(client, 'endOperation', { token }, metadata).catch(() => this.retryRelease(client, token));
      } catch { this.retryRelease(client, token); }
    }, 5000);
    timer.unref();
  }
}
