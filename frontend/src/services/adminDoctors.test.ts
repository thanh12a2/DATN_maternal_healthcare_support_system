import { describe, expect, it, vi } from 'vitest';
import { createDoctor, updateDoctor } from './adminDoctors';
import type { Requester } from './catalog';

describe('admin doctor API contract', () => {
  it('creates a doctor with an existing account, rank and primary specialty', async () => {
    const call = vi.fn(async (_path: string, _options?: { body?: string }) => ({ data: { id: 'doctor-id' } }));
    await createDoctor(call as unknown as Requester, {
      accountId: 'account-id', licenseNumber: 'QA-LICENSE',
      consultationRank: 'BASIC', specialtyId: 'specialty-id',
      profile: { fullName: 'QA Doctor' },
    });

    expect(call.mock.calls[0][0]).toBe('/api/doctors');
    expect(JSON.parse(call.mock.calls[0][1]?.body ?? '{}')).toMatchObject({
      accountId: 'account-id', consultationRank: 'BASIC',
      specialtyId: 'specialty-id',
    });
  });

  it('sends profile fields at the top level for doctor PATCH', async () => {
    const call = vi.fn(async (_path: string, _options?: { body?: string; headers?: Record<string, string> }) => ({ data: { id: 'doctor-id' } }));
    await updateDoctor(call as unknown as Requester, 'doctor-id', 2, {
      licenseNumber: 'QA-LICENSE', consultationRank: 'SPECIALIST_I',
      profile: { fullName: 'QA Doctor Edited', biography: 'Verified bio' },
    });

    expect(call.mock.calls[0][1]?.headers).toMatchObject({ 'if-match': '2' });
    const body = JSON.parse(call.mock.calls[0][1]?.body ?? '{}');
    expect(body).toMatchObject({
      licenseNumber: 'QA-LICENSE', consultationRank: 'SPECIALIST_I',
      fullName: 'QA Doctor Edited', biography: 'Verified bio',
    });
    expect(body).not.toHaveProperty('profile');
  });
});
