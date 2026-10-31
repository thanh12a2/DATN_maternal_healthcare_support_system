import { Module } from '@nestjs/common';
import { PlatformModule } from '@platform';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthGrpcController } from './auth-grpc.controller';

@Module({ imports: [PlatformModule, AccountsModule], controllers: [AuthGrpcController] })
export class AuthGrpcModule {}
