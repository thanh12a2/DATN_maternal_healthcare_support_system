import { describe, expect, it } from 'vitest';
import { deriveAuditDetails } from './auditInterceptor';

describe('admin audit details', () => {
  it('uses the created doctor ID from an API data envelope without copying sensitive request fields', () => {
    const details = deriveAuditDetails(
      'POST',
      '/api/doctors',
      { accountId: 'account-id', password: 'secret-value' },
      { data: { id: 'doctor-id', accountId: 'account-id' } },
    );

    expect(details.action).toBe('DOCTOR_PROFILE_CREATED');
    expect(details.aggregateId).toBe('doctor-id');
    expect(JSON.stringify(details.metadata)).not.toContain('secret-value');
  });
});
