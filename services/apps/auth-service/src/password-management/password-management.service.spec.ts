import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PasswordHasherService } from '../security/password-hasher.service';
import { AccessTokenService } from '../tokens/access-token.service';
import { PasswordResetEmailService } from './password-reset-email.service';
import {
  InvalidPasswordResetTokenError,
  PasswordChangeAccountUnavailableError,
  PasswordManagementRepository,
} from './password-management.repository';
import { PasswordManagementService } from './password-management.service';
import { PasswordResetTokenService } from './password-reset-token.service';

describe('PasswordManagementService', () => {
  const repository = {
    findEligibleAccountByEmail: jest.fn(),
    storePasswordResetToken: jest.fn(),
    deletePasswordResetTokenIfMatches: jest.fn(),
    resetPasswordWithToken: jest.fn(),
    findActiveCredentialByAccountId: jest.fn(),
    changePassword: jest.fn(),
  } as unknown as jest.Mocked<PasswordManagementRepository>;
  const passwordHasher = {
    hashPassword: jest.fn(),
    verifyPassword: jest.fn(),
  } as unknown as jest.Mocked<PasswordHasherService>;
  const accessTokenService = {
    verifyAccessToken: jest.fn(),
  } as unknown as jest.Mocked<AccessTokenService>;
  const resetTokenService = {
    issueToken: jest.fn(),
    hashToken: jest.fn(),
    getCooldownThreshold: jest.fn(),
  } as unknown as jest.Mocked<PasswordResetTokenService>;
  const emailService = {
    sendPasswordResetEmail: jest.fn(),
  } as unknown as jest.Mocked<PasswordResetEmailService>;

  let service: PasswordManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PasswordManagementService(
      repository,
      passwordHasher,
      accessTokenService,
      resetTokenService,
      emailService,
    );
  });

  it('does not reveal that a forgot-password email is unknown', async () => {
    repository.findEligibleAccountByEmail.mockResolvedValue(null);

    await expect(
      service.forgotPassword({ email: ' Missing@Example.com ' }),
    ).resolves.toBeUndefined();
    expect(repository.findEligibleAccountByEmail).toHaveBeenCalledWith(
      'missing@example.com',
    );
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('stores a hashed reset token and sends only the raw token by email', async () => {
    const now = new Date('2026-09-06T12:00:00.000Z');
    const expiresAt = new Date('2026-09-06T12:15:00.000Z');
    const cooldownThreshold = new Date('2026-09-06T11:59:00.000Z');
    repository.findEligibleAccountByEmail.mockResolvedValue({
      accountId: 'account-id',
      email: 'patient@example.com',
    });
    resetTokenService.issueToken.mockReturnValue({
      token: 'raw-token',
      tokenHash: 'token-hash',
      expiresAt,
    });
    resetTokenService.getCooldownThreshold.mockReturnValue(cooldownThreshold);
    repository.storePasswordResetToken.mockResolvedValue(true);
    emailService.sendPasswordResetEmail.mockResolvedValue(undefined);

    await service.forgotPassword({ email: 'patient@example.com' }, now);

    expect(repository.storePasswordResetToken).toHaveBeenCalledWith({
      accountId: 'account-id',
      tokenHash: 'token-hash',
      createdAt: now,
      expiresAt,
      cooldownThreshold,
    });
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      'patient@example.com',
      'raw-token',
    );
  });

  it('keeps a generic response when reset-token processing fails', async () => {
    repository.findEligibleAccountByEmail.mockResolvedValue({
      accountId: 'account-id',
      email: 'patient@example.com',
    });
    resetTokenService.issueToken.mockImplementation(() => {
      throw new Error('Missing token configuration');
    });

    await expect(
      service.forgotPassword({ email: 'patient@example.com' }),
    ).resolves.toBeUndefined();
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('does not send another email during cooldown', async () => {
    repository.findEligibleAccountByEmail.mockResolvedValue({
      accountId: 'account-id',
      email: 'patient@example.com',
    });
    resetTokenService.issueToken.mockReturnValue({
      token: 'raw-token',
      tokenHash: 'token-hash',
      expiresAt: new Date(),
    });
    resetTokenService.getCooldownThreshold.mockReturnValue(new Date());
    repository.storePasswordResetToken.mockResolvedValue(false);

    await service.forgotPassword({ email: 'patient@example.com' });
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('removes an unusable reset token when email delivery fails', async () => {
    repository.findEligibleAccountByEmail.mockResolvedValue({
      accountId: 'account-id',
      email: 'patient@example.com',
    });
    resetTokenService.issueToken.mockReturnValue({
      token: 'raw-token',
      tokenHash: 'token-hash',
      expiresAt: new Date(),
    });
    resetTokenService.getCooldownThreshold.mockReturnValue(new Date());
    repository.storePasswordResetToken.mockResolvedValue(true);
    emailService.sendPasswordResetEmail.mockRejectedValue(
      new Error('SMTP unavailable'),
    );
    repository.deletePasswordResetTokenIfMatches.mockResolvedValue(undefined);

    await expect(
      service.forgotPassword({ email: 'patient@example.com' }),
    ).resolves.toBeUndefined();
    expect(repository.deletePasswordResetTokenIfMatches).toHaveBeenCalledWith(
      'account-id',
      'token-hash',
    );
  });

  it('resets a password using the reset-token hash', async () => {
    const now = new Date('2026-09-06T12:00:00.000Z');
    resetTokenService.hashToken.mockReturnValue('token-hash');
    passwordHasher.hashPassword.mockResolvedValue('new-password-hash');
    repository.resetPasswordWithToken.mockResolvedValue(undefined);

    await service.resetPassword(
      { token: 'raw-token', newPassword: 'NewPassword123!' },
      now,
    );
    expect(repository.resetPasswordWithToken).toHaveBeenCalledWith(
      'token-hash',
      'new-password-hash',
      now,
    );
  });

  it('maps an invalid reset token to a generic bad request', async () => {
    resetTokenService.hashToken.mockReturnValue('token-hash');
    passwordHasher.hashPassword.mockResolvedValue('new-password-hash');
    repository.resetPasswordWithToken.mockRejectedValue(
      new InvalidPasswordResetTokenError(),
    );

    await expect(
      service.resetPassword({
        token: 'invalid',
        newPassword: 'NewPassword123!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('changes password for an authenticated active account', async () => {
    const now = new Date('2026-09-06T12:00:00.000Z');
    accessTokenService.verifyAccessToken.mockReturnValue({
      userId: 'account-id',
      role: 'PATIENT',
      tokenId: 'token-id',
    } as never);
    repository.findActiveCredentialByAccountId.mockResolvedValue({
      passwordHash: 'current-hash',
    });
    passwordHasher.verifyPassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    passwordHasher.hashPassword.mockResolvedValue('new-password-hash');
    repository.changePassword.mockResolvedValue(undefined);

    await service.changePassword(
      'access-token',
      { currentPassword: 'Current123!', newPassword: 'NewPassword123!' },
      now,
    );
    expect(repository.changePassword).toHaveBeenCalledWith(
      'account-id',
      'current-hash',
      'new-password-hash',
      now,
    );
  });

  it('rejects an invalid current password', async () => {
    accessTokenService.verifyAccessToken.mockReturnValue({
      userId: 'account-id',
    } as never);
    repository.findActiveCredentialByAccountId.mockResolvedValue({
      passwordHash: 'current-hash',
    });
    passwordHasher.verifyPassword.mockResolvedValue(false);

    await expect(
      service.changePassword('access-token', {
        currentPassword: 'WrongPassword!',
        newPassword: 'NewPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects reuse of the current password', async () => {
    accessTokenService.verifyAccessToken.mockReturnValue({
      userId: 'account-id',
    } as never);
    repository.findActiveCredentialByAccountId.mockResolvedValue({
      passwordHash: 'current-hash',
    });
    passwordHasher.verifyPassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await expect(
      service.changePassword('access-token', {
        currentPassword: 'Current123!',
        newPassword: 'Current123!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps an account state change during password update to unauthorized', async () => {
    accessTokenService.verifyAccessToken.mockReturnValue({
      userId: 'account-id',
    } as never);
    repository.findActiveCredentialByAccountId.mockResolvedValue({
      passwordHash: 'current-hash',
    });
    passwordHasher.verifyPassword
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    passwordHasher.hashPassword.mockResolvedValue('new-password-hash');
    repository.changePassword.mockRejectedValue(
      new PasswordChangeAccountUnavailableError(),
    );

    await expect(
      service.changePassword('access-token', {
        currentPassword: 'Current123!',
        newPassword: 'NewPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
