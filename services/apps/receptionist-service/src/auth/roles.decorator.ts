import { SetMetadata } from '@nestjs/common';
import type { AuthRole } from './auth-context';

export const ROLES_KEY = 'receptionist-service:roles';
export const Roles = (...roles: AuthRole[]) => SetMetadata(ROLES_KEY, roles);
