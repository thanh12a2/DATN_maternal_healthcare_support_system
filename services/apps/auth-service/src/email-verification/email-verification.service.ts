import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { PrismaService } from '../database/prisma.service';
import { AccessTokenService } from '../tokens/access-token.service';

@Injectable()
export class EmailVerificationService {
  constructor(private readonly db: PrismaService, private readonly tokens: AccessTokenService, private readonly config: ConfigService) {}

  private accountId(header?: string) {
    const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
    if (!match) throw new UnauthorizedException('MISSING_ACCESS_TOKEN');
    const auth = this.tokens.verifyAccessToken(match[1]);
    if (auth.role !== 'PATIENT') throw new UnauthorizedException('PATIENT_REQUIRED');
    return auth.userId;
  }

  async status(header?: string) {
    const account = await this.db.account.findUnique({ where: { id: this.accountId(header) }, select: { email: true, status: true, emailVerifiedAt: true, verifiedEmail: true } });
    if (!account || account.status !== 'ACTIVE') throw new UnauthorizedException('ACCOUNT_UNAVAILABLE');
    return { email: account.email, verified: Boolean(account.emailVerifiedAt && account.verifiedEmail === account.email) };
  }

  async request(header?: string) {
    const accountId = this.accountId(header);
    const account = await this.db.account.findUnique({ where: { id: accountId }, select: { email: true, status: true, emailVerifiedAt: true, verifiedEmail: true } });
    if (!account || account.status !== 'ACTIVE') throw new UnauthorizedException('ACCOUNT_UNAVAILABLE');
    if (account.emailVerifiedAt && account.verifiedEmail === account.email) return { verified: true };
    const host = this.required('AUTH_SMTP_HOST'), from = this.required('AUTH_EMAIL_FROM');
    let verificationUrl: URL;
    try { verificationUrl = new URL(this.required('AUTH_EMAIL_VERIFICATION_URL')); } catch { throw new ServiceUnavailableException('EMAIL_VERIFICATION_URL_INVALID'); }
    const port = Number(this.config.get('AUTH_SMTP_PORT') ?? 587), secure = this.config.get<string>('AUTH_SMTP_SECURE') ?? 'false';
    const user = this.config.get<string>('AUTH_SMTP_USER'), pass = this.config.get<string>('AUTH_SMTP_PASSWORD');
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !['true', 'false'].includes(secure) || Boolean(user) !== Boolean(pass)) throw new ServiceUnavailableException('AUTH_SMTP_CONFIGURATION_INVALID');
    const token = randomBytes(32).toString('base64url'), tokenHash = createHash('sha256').update(token).digest('hex'), now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    await this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${accountId}, 0))::text`;
      const old = await tx.emailVerificationToken.findUnique({ where: { accountId } });
      if (old && old.createdAt.getTime() > now.getTime() - 60000) throw new ConflictException('EMAIL_VERIFICATION_COOLDOWN');
      await tx.emailVerificationToken.upsert({ where: { accountId }, create: { accountId, tokenHash, email: account.email, createdAt: now, expiresAt }, update: { tokenHash, email: account.email, createdAt: now, expiresAt } });
    });
    verificationUrl.searchParams.set('token', token);
    const transport = nodemailer.createTransport({ host, port, secure: secure === 'true', ...(user && pass ? { auth: { user, pass } } : {}) });
    try {
      const result = await transport.sendMail({ from, to: account.email, subject: 'Xác minh địa chỉ email', text: `Vui lòng đăng nhập và xác minh địa chỉ email tại liên kết sau: ${verificationUrl.toString()}\nLiên kết có hiệu lực trong 30 phút. Nếu bạn không yêu cầu, hãy bỏ qua thư này.` });
      if (!result.accepted.length) throw new Error('RECIPIENT_REJECTED');
    } catch {
      await this.db.emailVerificationToken.deleteMany({ where: { accountId, tokenHash } });
      throw new ServiceUnavailableException('EMAIL_VERIFICATION_SEND_FAILED');
    } finally { transport.close(); }
    return { verified: false, sent: true };
  }

  async confirm(header: string | undefined, token: string) {
    const accountId = this.accountId(header);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new BadRequestException('INVALID_VERIFICATION_TOKEN');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.db.$transaction(async tx => {
      const record = await tx.emailVerificationToken.findFirst({ where: { accountId, tokenHash, expiresAt: { gt: new Date() } } });
      if (!record) throw new BadRequestException('INVALID_OR_EXPIRED_VERIFICATION_TOKEN');
      const consumed = await tx.emailVerificationToken.deleteMany({ where: { accountId, tokenHash, expiresAt: { gt: new Date() } } });
      if (!consumed.count) throw new BadRequestException('INVALID_OR_EXPIRED_VERIFICATION_TOKEN');
      const account = await tx.account.updateMany({ where: { id: accountId, email: record.email, status: 'ACTIVE' }, data: { verifiedEmail: record.email, emailVerifiedAt: new Date() } });
      if (!account.count) throw new BadRequestException('EMAIL_CHANGED_OR_ACCOUNT_UNAVAILABLE');
    });
    return { verified: true };
  }

  private required(key: string) { const value = this.config.get<string>(key)?.trim(); if (!value) throw new ServiceUnavailableException('MISSING_' + key); return value; }
}
