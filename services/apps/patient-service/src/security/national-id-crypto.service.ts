import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'crypto';
@Injectable()
export class NationalIdCryptoService {
  private key: Buffer;
  private pepper: string;
  constructor(c: ConfigService) {
    const raw = c.get<string>('PATIENT_NATIONAL_ID_ENCRYPTION_KEY') ?? '';
    this.pepper = c.get<string>('PATIENT_NATIONAL_ID_LOOKUP_PEPPER') ?? '';
    this.key = /^[0-9a-f]{64}$/i.test(raw)
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'base64');
    if (this.key.length !== 32 || this.pepper.length < 16)
      throw new InternalServerErrorException(
        'Invalid national ID crypto configuration',
      );
  }
  lookupHash(v: string) {
    return createHmac('sha256', this.pepper).update(v).digest('hex');
  }
  encrypt(v: string) {
    const iv = randomBytes(12),
      c = createCipheriv('aes-256-gcm', this.key, iv),
      e = Buffer.concat([c.update(v, 'utf8'), c.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      c.getAuthTag().toString('base64url'),
      e.toString('base64url'),
    ].join('.');
  }
  decrypt(v: string) {
    const [x, iv, t, e] = v.split('.');
    if (x !== 'v1' || !iv || !t || !e)
      throw new InternalServerErrorException('Stored national ID is invalid');
    const d = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(iv, 'base64url'),
    );
    d.setAuthTag(Buffer.from(t, 'base64url'));
    return Buffer.concat([
      d.update(Buffer.from(e, 'base64url')),
      d.final(),
    ]).toString('utf8');
  }
  maskCiphertext(v: string | null) {
    if (!v) return null;
    const p = this.decrypt(v);
    return '*'.repeat(Math.max(0, p.length - 4)) + p.slice(-4);
  }
}
