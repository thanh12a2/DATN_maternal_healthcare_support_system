import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class PasswordResetEmailService {
  constructor(private readonly configService: ConfigService) {}

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const transporter = this.createTransporter();
    const resetUrl = this.buildResetUrl(token);

    await transporter.sendMail({
      from: this.getRequiredConfig('AUTH_EMAIL_FROM'),
      to: email,
      subject: 'Reset your password',
      text: [
        'A password reset was requested for your account.',
        '',
        'Open this link to choose a new password:',
        resetUrl,
        '',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
    });
  }

  private createTransporter(): Transporter {
    const port = this.getPort();
    const secure = this.getSecure();
    const user = this.configService.get<string>('AUTH_SMTP_USER');
    const password = this.configService.get<string>('AUTH_SMTP_PASSWORD');

    if ((user && !password) || (!user && password)) {
      throw new InternalServerErrorException(
        'AUTH_SMTP_USER and AUTH_SMTP_PASSWORD must be configured together',
      );
    }

    return nodemailer.createTransport({
      host: this.getRequiredConfig('AUTH_SMTP_HOST'),
      port,
      secure,
      auth: user && password ? { user, pass: password } : undefined,
    });
  }

  private buildResetUrl(token: string): string {
    const configuredUrl = this.getRequiredConfig('AUTH_PASSWORD_RESET_URL');
    try {
      const resetUrl = new URL(configuredUrl);
      resetUrl.searchParams.set('token', token);
      return resetUrl.toString();
    } catch {
      throw new InternalServerErrorException(
        'Invalid AUTH_PASSWORD_RESET_URL configuration',
      );
    }
  }

  private getPort(): number {
    const configuredPort =
      this.configService.get<string>('AUTH_SMTP_PORT') ?? '587';
    const port = Number(configuredPort);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new InternalServerErrorException(
        'Invalid AUTH_SMTP_PORT configuration',
      );
    }
    return port;
  }

  private getSecure(): boolean {
    const configuredSecure =
      this.configService.get<string>('AUTH_SMTP_SECURE') ?? 'false';
    if (configuredSecure !== 'true' && configuredSecure !== 'false') {
      throw new InternalServerErrorException(
        'Invalid AUTH_SMTP_SECURE configuration',
      );
    }
    return configuredSecure === 'true';
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new InternalServerErrorException(
        'Missing required configuration: ' + key,
      );
    }
    return value;
  }
}
