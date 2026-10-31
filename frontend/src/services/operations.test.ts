import { describe, expect, it, vi } from 'vitest';
import { admitReceptionCase, verifyReceptionIdentity } from './operations';

describe('verifyReceptionIdentity', () => {
  it('loads the current case version before submitting verification', async () => {
    const request = vi.fn().mockResolvedValueOnce({ data: { id: 'case-1', version: 7 } }).mockResolvedValueOnce({ data: { id: 'verification-1' } });
    await verifyReceptionIdentity(request, 'case-1', { method: 'APPOINTMENT_CODE', result: 'VERIFIED' });
    expect(request).toHaveBeenNthCalledWith(1, '/api/reception/cases/case-1');
    expect(request).toHaveBeenNthCalledWith(2, '/api/reception/cases/case-1/identity-verifications', expect.objectContaining({ method: 'POST', body: JSON.stringify({ method: 'APPOINTMENT_CODE', result: 'VERIFIED', expectedVersion: 7 }) }));
  });
  it('sends the latest case version when admitting', async () => {
    const request = vi.fn().mockResolvedValueOnce({ id: 'case-1', version: 8 }).mockResolvedValueOnce({ id: 'case-1' });
    await admitReceptionCase(request, 'case-1');
    expect(request).toHaveBeenNthCalledWith(2, '/api/reception/cases/case-1/admit', expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedVersion: 8 }) }));
  });
});
