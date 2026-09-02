import { describe, expect, it } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { extractBearerToken } from './bearer-token.util';

describe('extractBearerToken', () => {
  it('should extract bearer token', () => {
    expect(extractBearerToken('Bearer access-token')).toBe('access-token');
  });

  it('should extract from first header value when header is array', () => {
    expect(extractBearerToken(['Bearer access-token'])).toBe('access-token');
  });

  it('should reject missing token', () => {
    expect(() => extractBearerToken(undefined)).toThrow(UnauthorizedException);
  });

  it('should reject malformed token', () => {
    expect(() => extractBearerToken('Basic abc')).toThrow(
      UnauthorizedException,
    );
    expect(() => extractBearerToken('Bearer')).toThrow(UnauthorizedException);
    expect(() => extractBearerToken('Bearer abc extra')).toThrow(
      UnauthorizedException,
    );
  });
});
