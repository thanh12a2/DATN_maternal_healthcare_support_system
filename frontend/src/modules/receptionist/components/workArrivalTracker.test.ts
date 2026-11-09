import { describe, expect, it } from 'vitest';
import { createWorkArrivalTracker } from './workArrivalTracker';

describe('work arrival detection', () => {
  it('detects replacement at the same count and work released by another receptionist', () => {
    const check = createWorkArrivalTracker();
    expect(check(null, [{ id: 'a', claim: 'AVAILABLE' }, { id: 'b', claim: 'OTHER' }], 1)).toBe(false);
    expect(check(null, [{ id: 'c', claim: 'AVAILABLE' }, { id: 'b', claim: 'OTHER' }], 1)).toBe(true);
    expect(check(null, [{ id: 'c', claim: 'OTHER' }, { id: 'b', claim: 'AVAILABLE' }], 1)).toBe(true);
    expect(check(null, [{ id: 'c', claim: 'OTHER' }, { id: 'b', claim: 'AVAILABLE' }], 1)).toBe(false);
  });
  it('does not announce a page just because it is opened', () => {
    const check = createWorkArrivalTracker();
    check(null, [{ id: 'a', claim: 'AVAILABLE' }], 2);
    expect(check('page2', [{ id: 'b', claim: 'AVAILABLE' }], 2)).toBe(false);
  });
  it('announces a new case already owned by another receptionist', () => {
    const check = createWorkArrivalTracker();
    expect(check(null, [], 0)).toBe(false);
    expect(check(null, [{ id: 'case', claim: 'OTHER' }], 0)).toBe(true);
    expect(check(null, [{ id: 'case', claim: 'OTHER' }], 0)).toBe(false);
  });
  it('announces that an existing case needs retry or has completed', () => {
    const check = createWorkArrivalTracker();
    check(null, [{ id: 'case', claim: 'MINE', status: 'ADMISSION_IN_PROGRESS', admissionStatus: 'AWAITING_PAYMENT' }], 0);
    expect(check(null, [{ id: 'case', claim: 'MINE', status: 'ADMISSION_IN_PROGRESS', admissionStatus: 'FAILED_RETRYABLE' }], 0)).toBe(true);
    expect(check(null, [{ id: 'case', claim: 'MINE', status: 'ADMITTED', admissionStatus: 'COMPLETED' }], 1)).toBe(true);
  });
});
