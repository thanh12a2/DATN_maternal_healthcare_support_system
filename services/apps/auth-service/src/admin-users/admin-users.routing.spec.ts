import { GUARDS_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersModule } from './admin-users.module';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AuthServiceModule } from '../auth-service.module';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminUsersService } from './admin-users.service';
import { AccessTokenService } from '../tokens/access-token.service';
import { PrismaService } from '../database/prisma.service';

describe('admin users routing', () => {
  it('registers the guarded controller in the running auth service', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AuthServiceModule))
      .toContain(AdminUsersModule);
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AdminUsersModule))
      .toContain(AdminUsersController);
    expect(Reflect.getMetadata(PATH_METADATA, AdminUsersController))
      .toBe('auth/admin/users');
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminUsersController))
      .toContain(AdminAuthGuard);
  });

  it('requires an admin access token for the HTTP list route', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      status: 'ACTIVE', roles: [{ role: { code: 'ADMIN' } }],
    });
    const module = await Test.createTestingModule({ imports: [AdminUsersModule] })
      .overrideProvider(PrismaService).useValue({ account: { findUnique } })
      .overrideProvider(AccessTokenService).useValue({
        verifyAccessToken: (token: string) => ({
          userId: '11111111-1111-4111-8111-111111111111',
          role: token === 'admin' ? 'ADMIN' : 'PATIENT',
          tokenId: 'test-token',
        }),
      })
      .overrideProvider(AdminUsersService).useValue({
        listUsers: async () => ({ items: [], total: 0, page: 1, limit: 20 }),
      })
      .compile();
    const app = module.createNestApplication();
    await app.init();
    try {
      await request(app.getHttpServer()).get('/auth/admin/users').expect(401);
      await request(app.getHttpServer()).get('/auth/admin/users')
        .set('Authorization', 'Bearer patient').expect(403);
      await request(app.getHttpServer()).get('/auth/admin/users')
        .set('Authorization', 'Bearer admin').expect(200);
      findUnique.mockResolvedValueOnce({ status: 'LOCKED', roles: [{ role: { code: 'ADMIN' } }] });
      await request(app.getHttpServer()).get('/auth/admin/users')
        .set('Authorization', 'Bearer admin').expect(403);
      findUnique.mockResolvedValueOnce(null);
      await request(app.getHttpServer()).get('/auth/admin/users')
        .set('Authorization', 'Bearer admin').expect(403);
    } finally {
      await app.close();
    }
  });
});
