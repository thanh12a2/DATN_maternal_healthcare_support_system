import { Controller, NotFoundException, UseGuards } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ServiceCallers, ServiceJwtGuard, ServiceScopes } from '@platform';
import { AccountsRepository } from '../accounts/accounts.repository';

interface GetRequest { accountId: string }
interface BatchRequest { accountIds: string[] }

@Controller()
@UseGuards(ServiceJwtGuard)
@ServiceCallers('doctor-service', 'receptionist-service', 'patient-service', 'medical-record-service')
@ServiceScopes('auth:account:read')
export class AuthGrpcController {
  constructor(private readonly accounts: AccountsRepository) {}

  @GrpcMethod('AuthInternalService', 'GetAccountAuthorization')
  async getAccountAuthorization(request: GetRequest) {
    const account = await this.accounts.findInternalAccountById(request.accountId);
    if (!account) throw new NotFoundException('ACCOUNT_NOT_FOUND');
    return { account: this.present(account) };
  }

  @GrpcMethod('AuthInternalService', 'BatchGetAccountAuthorization')
  async batchGetAccountAuthorization(request: BatchRequest) {
    const uniqueIds = [...new Set(request.accountIds ?? [])].slice(0, 100);
    const accounts = await Promise.all(uniqueIds.map((id) => this.accounts.findInternalAccountById(id)));
    return { accounts: accounts.filter(Boolean).map((account) => this.present(account!)) };
  }

  private present(account: { accountId: string; status: string; role: string }) {
    const status = account.status === 'PENDING_VERIFICATION'
      ? 'ACCOUNT_STATUS_PENDING'
      : 'ACCOUNT_STATUS_' + account.status;
    return { accountId: account.accountId, status, roles: [account.role], authorizationVersion: '1' };
  }
}
