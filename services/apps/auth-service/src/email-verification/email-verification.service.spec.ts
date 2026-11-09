import { createHash } from 'node:crypto';
import { EmailVerificationService } from './email-verification.service';

describe('patient email verification', () => {
  const auth = { verifyAccessToken: jest.fn().mockReturnValue({ userId: 'account', role: 'PATIENT' }) };
  const tx = { emailVerificationToken: { findFirst: jest.fn(), deleteMany: jest.fn() }, account: { updateMany: jest.fn() } };
  const db = { account: { findUnique: jest.fn() }, $transaction: async (fn: any) => fn(tx) };
  const service = new EmailVerificationService(db as any, auth as any, {} as any);
  beforeEach(() => jest.clearAllMocks());
  it('does not consider an unverified or changed address verified', async () => {
    db.account.findUnique.mockResolvedValueOnce({ email: 'current@example.test', status: 'ACTIVE', verifiedEmail: 'old@example.test', emailVerifiedAt: new Date() });
    await expect(service.status('Bearer token')).resolves.toEqual({ email: 'current@example.test', verified: false });
  });
  it('consumes a valid token and marks only the matching address verified', async () => {
    const token = 'a'.repeat(43), hash = createHash('sha256').update(token).digest('hex');
    tx.emailVerificationToken.findFirst.mockResolvedValue({ accountId: 'account', email: 'patient@example.test' });
    tx.emailVerificationToken.deleteMany.mockResolvedValue({ count: 1 });
    tx.account.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.confirm('Bearer token', token)).resolves.toEqual({ verified: true });
    expect(tx.emailVerificationToken.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ accountId: 'account', tokenHash: hash }) }));
    expect(tx.account.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ email: 'patient@example.test', status: 'ACTIVE' }) }));
  });
  it('rejects expired or already-used tokens', async () => {
    tx.emailVerificationToken.findFirst.mockResolvedValue(null);
    await expect(service.confirm('Bearer token', 'a'.repeat(43))).rejects.toThrow('INVALID_OR_EXPIRED_VERIFICATION_TOKEN');
    expect(tx.account.updateMany).not.toHaveBeenCalled();
  });
});
