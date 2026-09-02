import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';
const normalizeWhitespace = (value: string) =>
  value.trim().replace(/\s+/gu, ' ');

function normalizeRequiredText(
  value: string,
  minimum: number,
  maximum: number,
  field: string,
): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new DomainException(
      'VALIDATION_FAILED',
      `${field} must contain between ${minimum} and ${maximum} characters`,
      HttpStatus.BAD_REQUEST,
    );
  }
  return normalized;
}

export const normalizeFullName = (value: string) =>
  normalizeRequiredText(value, 2, 150, 'fullName');
export const normalizeRelationship = (value: string) =>
  normalizeRequiredText(value, 1, 50, 'relationship');
export const normalizeReason = (value: string) =>
  normalizeRequiredText(value, 1, 250, 'reason');
export const normalizeSearchName = (value: string) =>
  normalizeFullName(value).toLocaleLowerCase('vi-VN');
export function normalizePhone(v: string): string {
  let r = v.trim().replace(/[\s().-]/g, '');
  if (r.startsWith('00')) r = '+' + r.slice(2);
  if (/^0\d{9}$/.test(r)) r = '+84' + r.slice(1);
  if (/^84\d{9}$/.test(r)) r = '+' + r;
  if (!/^\+[1-9]\d{7,14}$/.test(r))
    throw new DomainException(
      'VALIDATION_FAILED',
      'phoneNumber is invalid',
      HttpStatus.BAD_REQUEST,
    );
  return r;
}
export function normalizeNationalId(v: string): string {
  const r = v.replace(/[\s.-]/g, '');
  if (!/^(?:\d{9}|\d{12})$/.test(r))
    throw new DomainException(
      'VALIDATION_FAILED',
      'nationalId must contain 9 or 12 digits',
      HttpStatus.BAD_REQUEST,
    );
  return r;
}
export function parseBusinessDate(v: string, now = new Date()): Date {
  const bad = () =>
    new DomainException(
      'INVALID_DATE_OF_BIRTH',
      'dateOfBirth is invalid or in the future',
      HttpStatus.BAD_REQUEST,
    );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw bad();
  const d = new Date(v + 'T00:00:00.000Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v)
    throw bad();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const g = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  if (v > `${g('year')}-${g('month')}-${g('day')}`) throw bad();
  return d;
}
export function cleanOptional(v: string | null | undefined): string | null {
  if (v == null) return null;
  const normalized = normalizeWhitespace(v);
  if (!normalized) return null;
  if (normalized.length > 500) {
    throw new DomainException(
      'VALIDATION_FAILED',
      'address must contain at most 500 characters',
      HttpStatus.BAD_REQUEST,
    );
  }
  return normalized;
}
