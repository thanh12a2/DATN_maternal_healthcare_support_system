import { SetMetadata } from '@nestjs/common';
import type { CatalogRole } from './auth.types';

export const ROLES_KEY = 'catalog_roles';
export const Roles = (...roles: CatalogRole[]) => SetMetadata(ROLES_KEY, roles);
