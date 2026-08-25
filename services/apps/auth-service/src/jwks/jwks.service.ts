import { createPublicKey } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonWebKey, JsonWebKeySet } from './jwks.types';

@Injectable()
export class JwksService {
  constructor(private readonly configService: ConfigService) {}

  getJwks(): JsonWebKeySet {
    const publicKey = this.getRequiredConfig('AUTH_JWT_PUBLIC_KEY');
    const keyId = this.configService.get<string>('AUTH_JWT_KEY_ID') ?? 'local-dev-key';
    const jwk = createPublicKey(this.normalizePem(publicKey)).export({
      format: 'jwk',
    }) as unknown as JsonWebKey;

    return {
      keys: [
        {
          ...jwk,
          kid: keyId,
          alg: 'RS256',
          use: 'sig',
        },
      ],
    };
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new InternalServerErrorException(`Missing required configuration: ${key}`);
    }

    return value;
  }

  private normalizePem(value: string): string {
    const trimmedValue = value.trim();
    const unquotedValue =
      (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
      (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
        ? trimmedValue.slice(1, -1)
        : trimmedValue;

    return unquotedValue.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  }
}
