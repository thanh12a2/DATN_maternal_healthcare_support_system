import { describe, expect, it } from '@jest/globals';
import {
  cleanOptional,
  normalizeFullName,
  normalizeNationalId,
  normalizePhone,
  normalizeReason,
  normalizeRelationship,
  parseBusinessDate,
} from './normalization';
describe('patient normalization', () => {
  it('normalizes Vietnamese phone and whitespace', () => {
    expect(normalizePhone('0901 234 567')).toBe('+84901234567');
    expect(normalizeFullName(' Nguyễn   Thị A ')).toBe('Nguyễn Thị A');
  });
  it('normalizes valid national id', () =>
    expect(normalizeNationalId('012-345-678-901')).toBe('012345678901'));
  it('normalizes relationship, reason and optional address with their own limits', () => {
    expect(normalizeRelationship(' Mẹ ')).toBe('Mẹ');
    expect(normalizeReason('  ID   correction ')).toBe('ID correction');
    expect(cleanOptional(' A ')).toBe('A');
    expect(cleanOptional('   ')).toBeNull();
    expect(cleanOptional('x'.repeat(500))).toHaveLength(500);
    expect(() => cleanOptional('x'.repeat(501))).toThrow();
  });
  it('rejects invalid phone/id and future/invalid dates', () => {
    expect(() => normalizePhone('abc')).toThrow();
    expect(() => normalizeNationalId('123')).toThrow();
    expect(() => parseBusinessDate('2025-02-30')).toThrow();
    expect(() => parseBusinessDate('2999-01-01')).toThrow();
  });
});
