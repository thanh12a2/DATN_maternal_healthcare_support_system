import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthRole } from './dto/auth-role.enum';

describe('AuthController internal account lookup', () => {
  const authService = {} as never;
  const accountsRepository = {
    findInternalAccountById: jest.fn(),
  };
  const config = {
    get: jest.fn(),
  } as unknown as ConfigService;
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(authService, accountsRepository as never, config);
  });

  it('rejects an invalid internal service secret', async () => {
    config.get = jest.fn().mockReturnValue('expected-secret');

    await expect(
      controller.getInternalAccount(
        '13809f1f-d7c6-40e4-8b8e-457afa385898',
        'wrong-secret',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(accountsRepository.findInternalAccountById).not.toHaveBeenCalled();
  });

  it('returns the account status and selected role for a valid secret', async () => {
    config.get = jest.fn().mockReturnValue('expected-secret');
    accountsRepository.findInternalAccountById.mockResolvedValue({
      accountId: '13809f1f-d7c6-40e4-8b8e-457afa385898',
      status: 'ACTIVE',
      role: AuthRole.Doctor,
    });

    await expect(
      controller.getInternalAccount(
        '13809f1f-d7c6-40e4-8b8e-457afa385898',
        'expected-secret',
      ),
    ).resolves.toEqual({
      accountId: '13809f1f-d7c6-40e4-8b8e-457afa385898',
      status: 'ACTIVE',
      role: AuthRole.Doctor,
    });
  });

  it('returns not found when the account does not exist', async () => {
    config.get = jest.fn().mockReturnValue('expected-secret');
    accountsRepository.findInternalAccountById.mockResolvedValue(null);

    await expect(
      controller.getInternalAccount(
        '13809f1f-d7c6-40e4-8b8e-457afa385898',
        'expected-secret',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
