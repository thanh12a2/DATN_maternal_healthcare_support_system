import { AccountStatus } from '@prisma/client';
import { AuthRole } from '../auth/dto/auth-role.enum';

export interface RegisteredAccount {
  userId: string;
  email: string;
  role: AuthRole;
}

export interface RegisterAccountInput {
  email: string;
  passwordHash: string;
  role: AuthRole;
}

export interface AccountForLogin {
  userId: string;
  email: string;
  status: AccountStatus;
  passwordHash: string;
  role: AuthRole;
}

export interface AccountAuthProfile {
  userId: string;
  email: string;
  status: AccountStatus;
  role: AuthRole;
}

export interface InternalAccountLookup {
  accountId: string;
  status: AccountStatus;
  role: AuthRole;
}
