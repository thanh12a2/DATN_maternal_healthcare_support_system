import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountStatus, Prisma } from '@prisma/client';
import { AccountsRepository, AuthRoleNotSeededError } from '../accounts/accounts.repository';
import { PasswordHasherService } from '../security/password-hasher.service';
import { AccessTokenService } from '../tokens/access-token.service';
import { AuthService } from './auth.service';
import { AuthRole } from './dto/auth-role.enum';

const accountsRepositoryMock = () => ({
  createAccountWithCredential: jest.fn(),
  findAccountForLoginByEmail: jest.fn(),
  markLastLoginAt: jest.fn(),
  isUniqueConstraintError: jest.fn(),
});

const passwordHasherServiceMock = () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
});

const accessTokenServiceMock = () => ({
  signAccessToken: jest.fn(),
});

describe('AuthService', () => {
  let authService: AuthService;
  let accountsRepository: ReturnType<typeof accountsRepositoryMock>;
  let passwordHasherService: ReturnType<typeof passwordHasherServiceMock>;
  let accessTokenService: ReturnType<typeof accessTokenServiceMock>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AccountsRepository, useFactory: accountsRepositoryMock },
        { provide: PasswordHasherService, useFactory: passwordHasherServiceMock },
        { provide: AccessTokenService, useFactory: accessTokenServiceMock },
      ],
    }).compile();

    authService = moduleRef.get<AuthService>(AuthService);
    accountsRepository = moduleRef.get(AccountsRepository);
    passwordHasherService = moduleRef.get(PasswordHasherService);
    accessTokenService = moduleRef.get(AccessTokenService);
  });

  describe('register', () => {
    it('should register account with normalized email and hashed password', async () => {
      passwordHasherService.hashPassword.mockResolvedValue('argon2id-hash' as never);
      accountsRepository.createAccountWithCredential.mockResolvedValue({
        userId: 'account-id',
        email: 'patient@example.com',
        role: AuthRole.Patient,
      } as never);

      await expect(
        authService.register({
          email: ' Patient@Example.COM ',
          password: 'Password123!',
          role: AuthRole.Patient,
        }),
      ).resolves.toEqual({
        user: {
          userId: 'account-id',
          email: 'patient@example.com',
          role: AuthRole.Patient,
        },
      });

      expect(passwordHasherService.hashPassword).toHaveBeenCalledWith('Password123!');
      expect(accountsRepository.createAccountWithCredential).toHaveBeenCalledWith({
        email: 'patient@example.com',
        passwordHash: 'argon2id-hash',
        role: AuthRole.Patient,
      });
    });

    it('should throw ConflictException when account email already exists', async () => {
      const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      });

      passwordHasherService.hashPassword.mockResolvedValue('argon2id-hash' as never);
      accountsRepository.createAccountWithCredential.mockRejectedValue(uniqueConstraintError as never);
      accountsRepository.isUniqueConstraintError.mockReturnValue(true as never);

      await expect(
        authService.register({
          email: 'patient@example.com',
          password: 'Password123!',
          role: AuthRole.Patient,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should throw InternalServerErrorException when configured role is missing in database', async () => {
      passwordHasherService.hashPassword.mockResolvedValue('argon2id-hash' as never);
      accountsRepository.createAccountWithCredential.mockRejectedValue(
        new AuthRoleNotSeededError(AuthRole.Patient) as never,
      );
      accountsRepository.isUniqueConstraintError.mockReturnValue(false as never);

      await expect(
        authService.register({
          email: 'patient@example.com',
          password: 'Password123!',
          role: AuthRole.Patient,
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('login', () => {
    it('should login active account with normalized email, valid password, and access token', async () => {
      accountsRepository.findAccountForLoginByEmail.mockResolvedValue({
        userId: 'account-id',
        email: 'patient@example.com',
        status: AccountStatus.ACTIVE,
        passwordHash: 'argon2id-hash',
        role: AuthRole.Patient,
      } as never);
      passwordHasherService.verifyPassword.mockResolvedValue(true as never);
      accountsRepository.markLastLoginAt.mockResolvedValue(undefined as never);
      accessTokenService.signAccessToken.mockReturnValue({
        accessToken: 'signed-access-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      } as never);

      await expect(
        authService.login({
          email: ' Patient@Example.COM ',
          password: 'Password123!',
        }),
      ).resolves.toEqual({
        accessToken: 'signed-access-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          userId: 'account-id',
          email: 'patient@example.com',
          role: AuthRole.Patient,
        },
      });

      expect(accountsRepository.findAccountForLoginByEmail).toHaveBeenCalledWith('patient@example.com');
      expect(passwordHasherService.verifyPassword).toHaveBeenCalledWith(
        'argon2id-hash',
        'Password123!',
      );
      expect(accountsRepository.markLastLoginAt).toHaveBeenCalledWith(
        'account-id',
        expect.any(Date),
      );
      expect(accessTokenService.signAccessToken).toHaveBeenCalledWith({
        userId: 'account-id',
        role: AuthRole.Patient,
      });
    });

    it('should throw UnauthorizedException when account does not exist', async () => {
      accountsRepository.findAccountForLoginByEmail.mockResolvedValue(null as never);

      await expect(
        authService.login({ email: 'missing@example.com', password: 'Password123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(passwordHasherService.verifyPassword).not.toHaveBeenCalled();
      expect(accountsRepository.markLastLoginAt).not.toHaveBeenCalled();
      expect(accessTokenService.signAccessToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      accountsRepository.findAccountForLoginByEmail.mockResolvedValue({
        userId: 'account-id',
        email: 'patient@example.com',
        status: AccountStatus.ACTIVE,
        passwordHash: 'argon2id-hash',
        role: AuthRole.Patient,
      } as never);
      passwordHasherService.verifyPassword.mockResolvedValue(false as never);

      await expect(
        authService.login({ email: 'patient@example.com', password: 'WrongPassword!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(accountsRepository.markLastLoginAt).not.toHaveBeenCalled();
      expect(accessTokenService.signAccessToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when account is not active', async () => {
      accountsRepository.findAccountForLoginByEmail.mockResolvedValue({
        userId: 'account-id',
        email: 'patient@example.com',
        status: AccountStatus.DISABLED,
        passwordHash: 'argon2id-hash',
        role: AuthRole.Patient,
      } as never);

      await expect(
        authService.login({ email: 'patient@example.com', password: 'Password123!' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(passwordHasherService.verifyPassword).not.toHaveBeenCalled();
      expect(accountsRepository.markLastLoginAt).not.toHaveBeenCalled();
      expect(accessTokenService.signAccessToken).not.toHaveBeenCalled();
    });
  });
});
