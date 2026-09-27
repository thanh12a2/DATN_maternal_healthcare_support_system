import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PasswordHasherService } from '../security/password-hasher.service';
import { AccessTokenService } from '../tokens/access-token.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordResetEmailService } from './password-reset-email.service';
import {
  InvalidPasswordResetTokenError,
  PasswordChangeAccountUnavailableError,
  PasswordManagementRepository,
} from './password-management.repository';
import { PasswordResetTokenService } from './password-reset-token.service';

@Injectable()
export class PasswordManagementService {
  private readonly logger = new Logger(PasswordManagementService.name);

  constructor(
    private readonly repository: PasswordManagementRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly accessTokenService: AccessTokenService,
    private readonly resetTokenService: PasswordResetTokenService,
    private readonly emailService: PasswordResetEmailService,
  ) {}

  async forgotPassword(
    dto: ForgotPasswordDto,
    now = new Date(),
  ): Promise<void> {
    const email = dto.email.trim().toLowerCase();
    const account = await this.repository.findEligibleAccountByEmail(email);
    if (!account) return;

    let storedTokenHash: string | undefined;

    try {
      const issuedToken = this.resetTokenService.issueToken(now);
      const stored = await this.repository.storePasswordResetToken({
        accountId: account.accountId,
        tokenHash: issuedToken.tokenHash,
        createdAt: now,
        expiresAt: issuedToken.expiresAt,
        cooldownThreshold: this.resetTokenService.getCooldownThreshold(now),
      });
      if (!stored) return;

      storedTokenHash = issuedToken.tokenHash;
      await this.emailService.sendPasswordResetEmail(
        account.email,
        issuedToken.token,
      );
    } catch (error) {
      if (storedTokenHash) {
        try {
          await this.repository.deletePasswordResetTokenIfMatches(
            account.accountId,
            storedTokenHash,
          );
        } catch (cleanupError) {
          this.logger.error(
            'Failed to clean up an undelivered password reset token for account ' +
              account.accountId,
            cleanupError instanceof Error ? cleanupError.stack : undefined,
          );
        }
      }
      this.logger.error(
        'Failed to process a password reset request for account ' +
          account.accountId,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async resetPassword(dto: ResetPasswordDto, now = new Date()): Promise<void> {
    const tokenHash = this.resetTokenService.hashToken(dto.token);
    const passwordHash = await this.passwordHasher.hashPassword(
      dto.newPassword,
    );

    try {
      await this.repository.resetPasswordWithToken(
        tokenHash,
        passwordHash,
        now,
      );
    } catch (error) {
      if (error instanceof InvalidPasswordResetTokenError) {
        throw new BadRequestException('INVALID_OR_EXPIRED_RESET_TOKEN');
      }
      throw error;
    }
  }

  async changePassword(
    accessToken: string,
    dto: ChangePasswordDto,
    now = new Date(),
  ): Promise<void> {
    const verifiedToken =
      this.accessTokenService.verifyAccessToken(accessToken);
    const credential = await this.repository.findActiveCredentialByAccountId(
      verifiedToken.userId,
    );
    if (!credential) throw new UnauthorizedException('Invalid credentials');

    const currentPasswordMatches = await this.passwordHasher.verifyPassword(
      credential.passwordHash,
      dto.currentPassword,
    );
    if (!currentPasswordMatches) {
      throw new UnauthorizedException('Invalid current password');
    }

    const newPasswordMatchesCurrent = await this.passwordHasher.verifyPassword(
      credential.passwordHash,
      dto.newPassword,
    );
    if (newPasswordMatchesCurrent) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const passwordHash = await this.passwordHasher.hashPassword(
      dto.newPassword,
    );
    try {
      await this.repository.changePassword(
        verifiedToken.userId,
        credential.passwordHash,
        passwordHash,
        now,
      );
    } catch (error) {
      if (error instanceof PasswordChangeAccountUnavailableError) {
        throw new UnauthorizedException('Invalid credentials');
      }
      throw error;
    }
  }
}
