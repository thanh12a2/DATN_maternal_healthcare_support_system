import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { AccountsRepository, AuthRoleNotSeededError } from '../accounts/accounts.repository';
import { PasswordHasherService } from '../security/password-hasher.service';
import { InvalidRefreshSessionError, SessionsService } from '../sessions/sessions.service';
import { AccessTokenService } from '../tokens/access-token.service';
import { AuthRole } from './dto/auth-role.enum';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { TokenResponseDto } from './dto/token-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly passwordHasherService: PasswordHasherService,
    private readonly accessTokenService: AccessTokenService,
    private readonly sessionsService: SessionsService,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResponseDto> {
    const normalizedEmail = this.normalizeEmail(registerDto.email);
    const passwordHash = await this.passwordHasherService.hashPassword(registerDto.password);

    try {
      const registeredAccount = await this.accountsRepository.createAccountWithCredential({
        email: normalizedEmail,
        passwordHash,
        role: AuthRole.Patient,
      });

      return {
        user: registeredAccount,
      };
    } catch (error) {
      if (this.accountsRepository.isUniqueConstraintError(error)) {
        throw new ConflictException('Account already exists');
      }

      if (error instanceof AuthRoleNotSeededError) {
        throw new InternalServerErrorException('Auth role configuration is incomplete');
      }

      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const normalizedEmail = this.normalizeEmail(loginDto.email);
    const account = await this.accountsRepository.findAccountForLoginByEmail(normalizedEmail);

    if (!account || account.status !== AccountStatus.ACTIVE) {
      throw this.invalidCredentialsException();
    }

    const passwordMatches = await this.passwordHasherService.verifyPassword(
      account.passwordHash,
      loginDto.password,
    );

    if (!passwordMatches) {
      throw this.invalidCredentialsException();
    }

    await this.accountsRepository.markLastLoginAt(account.userId, new Date());

    const signedAccessToken = this.accessTokenService.signAccessToken({
      userId: account.userId,
      role: account.role,
    });
    const refreshSession = await this.sessionsService.createRefreshSession(account.userId);

    return {
      ...signedAccessToken,
      refreshToken: refreshSession.refreshToken,
      user: {
        userId: account.userId,
        email: account.email,
        role: account.role,
      },
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto): Promise<TokenResponseDto> {
    try {
      const refreshedSession = await this.sessionsService.refreshSession(refreshTokenDto.refreshToken);
      const account = await this.accountsRepository.findAuthProfileById(refreshedSession.accountId);

      if (!account || account.status !== AccountStatus.ACTIVE) {
        throw this.invalidCredentialsException();
      }

      const signedAccessToken = this.accessTokenService.signAccessToken({
        userId: account.userId,
        role: account.role,
      });

      return {
        ...signedAccessToken,
        refreshToken: refreshedSession.refreshToken,
        user: {
          userId: account.userId,
          email: account.email,
          role: account.role,
        },
      };
    } catch (error) {
      if (error instanceof InvalidRefreshSessionError) {
        throw this.invalidCredentialsException();
      }

      throw error;
    }
  }

  async getMe(accessToken: string): Promise<MeResponseDto> {
    const verifiedToken = this.accessTokenService.verifyAccessToken(accessToken);
    const account = await this.accountsRepository.findAuthProfileById(verifiedToken.userId);

    if (!account || account.status !== AccountStatus.ACTIVE) {
      throw this.invalidCredentialsException();
    }

    return {
      user: {
        userId: account.userId,
        email: account.email,
        role: account.role,
      },
    };
  }

  async logout(refreshTokenDto: RefreshTokenDto): Promise<void> {
    try {
      await this.sessionsService.logoutSession(refreshTokenDto.refreshToken);
    } catch (error) {
      if (error instanceof InvalidRefreshSessionError) {
        throw this.invalidCredentialsException();
      }

      throw error;
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private invalidCredentialsException(): UnauthorizedException {
    return new UnauthorizedException('Invalid credentials');
  }
}
