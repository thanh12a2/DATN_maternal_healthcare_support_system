import { AccountsRepository } from './accounts.repository';

describe('verified patient email', () => {
  const findFirst = jest.fn();
  const repository = new AccountsRepository({ account: { findFirst } } as any);
  beforeEach(() => findFirst.mockReset());
  it('returns only an address matching the verified address', async () => {
    findFirst.mockResolvedValueOnce({ email: 'patient@example.test', verifiedEmail: 'patient@example.test', emailVerifiedAt: new Date() });
    await expect(repository.findVerifiedPatientEmail('account')).resolves.toBe('patient@example.test');
    findFirst.mockResolvedValueOnce({ email: 'new@example.test', verifiedEmail: 'old@example.test', emailVerifiedAt: new Date() });
    await expect(repository.findVerifiedPatientEmail('account')).resolves.toBeNull();
    findFirst.mockResolvedValueOnce({ email: 'patient@example.test', verifiedEmail: null, emailVerifiedAt: null });
    await expect(repository.findVerifiedPatientEmail('account')).resolves.toBeNull();
  });
});
