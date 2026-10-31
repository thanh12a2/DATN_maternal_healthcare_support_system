import { SetMetadata } from '@nestjs/common';
import { DoctorRole } from './auth.types';

export const ROLES_KEY = 'doctor_roles';
export const Roles = (...roles: DoctorRole[]) => SetMetadata(ROLES_KEY, roles);
