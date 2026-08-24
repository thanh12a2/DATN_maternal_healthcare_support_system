import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { AccountsRepository, AuthRoleNotSeededError } from '../accounts/accounts.repository';
import { PasswordHasherService } from '../security/password-hasher.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly passwordHasherService: PasswordHasherService,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResponseDto> {
    const normalizedEmail = this.normalizeEmail(registerDto.email);
    const passwordHash = await this.passwordHasherService.hashPassword(registerDto.password);

    try {
      const registeredAccount = await this.accountsRepository.createAccountWithCredential({
        email: normalizedEmail,
        passwordHash,
        role: registerDto.role,
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

    return {
      user: {
        userId: account.userId,
        email: account.email,
        role: account.role,
      },
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private invalidCredentialsException(): UnauthorizedException {
    return new UnauthorizedException('Invalid credentials');
  }
}
