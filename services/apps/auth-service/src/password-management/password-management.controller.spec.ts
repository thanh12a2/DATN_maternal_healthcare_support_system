import { UnauthorizedException } from '@nestjs/common';
import { PasswordManagementController } from './password-management.controller';
import { PasswordManagementService } from './password-management.service';

describe('PasswordManagementController', () => {
  const service = {
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  } as unknown as jest.Mocked<PasswordManagementService>;
  let controller: PasswordManagementController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PasswordManagementController(service);
  });

  it('returns a generic accepted response for forgot-password', async () => {
    service.forgotPassword.mockResolvedValue(undefined);

    await expect(
      controller.forgotPassword({ email: 'patient@example.com' }),
    ).resolves.toEqual({
      message:
        'If an eligible account exists, password reset instructions will be sent.',
    });
  });

  it('delegates reset-password', async () => {
    service.resetPassword.mockResolvedValue(undefined);
    const dto = { token: 'reset-token', newPassword: 'NewPassword123!' };

    await expect(controller.resetPassword(dto)).resolves.toBeUndefined();
    expect(service.resetPassword).toHaveBeenCalledWith(dto);
  });

  it('extracts a bearer token for change-password', async () => {
    service.changePassword.mockResolvedValue(undefined);
    const dto = {
      currentPassword: 'Current123!',
      newPassword: 'NewPassword123!',
    };

    await expect(
      controller.changePassword('Bearer access-token', dto),
    ).resolves.toBeUndefined();
    expect(service.changePassword).toHaveBeenCalledWith('access-token', dto);
  });

  it('rejects a missing bearer token for change-password', () => {
    expect(() =>
      controller.changePassword(undefined, {
        currentPassword: 'Current123!',
        newPassword: 'NewPassword123!',
      }),
    ).toThrow(UnauthorizedException);
  });
});
