import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { RenderedEmail } from './email-templates';

export interface EmailAttachment { fileName: string; mediaType: string; content: Buffer }

/** SMTP acceptance is recorded as SENT, not proof of delivery to the inbox. */
@Injectable()
export class SmtpEmailService {
  constructor(private readonly config: ConfigService) {}

  async send(recipient: string, message: RenderedEmail, messageId: string, attachments: EmailAttachment[] = []) {
    const host = this.required('NOTIFICATION_SMTP_HOST');
    const from = this.required('NOTIFICATION_EMAIL_FROM');
    const port = Number(this.config.get<string>('NOTIFICATION_SMTP_PORT') ?? '587');
    const secure = this.config.get<string>('NOTIFICATION_SMTP_SECURE') ?? 'false';
    const user = this.config.get<string>('NOTIFICATION_SMTP_USER');
    const password = this.config.get<string>('NOTIFICATION_SMTP_PASSWORD');
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !['true', 'false'].includes(secure) || Boolean(user) !== Boolean(password)) throw new InternalServerErrorException('INVALID_NOTIFICATION_SMTP_CONFIGURATION');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || /[\r\n]/.test(recipient)) throw new InternalServerErrorException('INVALID_EMAIL_RECIPIENT');
    if (attachments.reduce((size, file) => size + file.content.length, 0) > 10 * 1024 * 1024) throw new InternalServerErrorException('EMAIL_ATTACHMENTS_TOO_LARGE');
    const transporter = nodemailer.createTransport({ host, port, secure: secure === 'true', connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000, ...(user && password ? { auth: { user, pass: password } } : {}) });
    try {
      const response = await transporter.sendMail({ from, to: recipient, subject: message.subject, text: message.text, html: message.html, messageId, attachments: attachments.map(file => ({ filename: file.fileName.replace(/[\\/\x00-\x1f\x7f]/g, '_'), contentType: file.mediaType, content: file.content })) });
      if (!response.accepted.length) throw new Error('SMTP_RECIPIENT_REJECTED');
      return { providerMessageId: response.messageId };
    } finally { transporter.close(); }
  }

  private required(key: string) {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new InternalServerErrorException('MISSING_' + key);
    return value;
  }
}
