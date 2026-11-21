import { PatientsService } from './patients.service';
describe('Minimal patient assistant context', () => {
  it('selects only profile version/time and never invokes identifier crypto', async () => {
    const findUnique = jest.fn().mockResolvedValue({ version: 4, updatedAt: new Date('2026-11-14T00:00:00Z') });
    const decrypt = jest.fn(() => { throw new Error('Must not decrypt'); });
    const service = new PatientsService({ patient: { findUnique } } as any, { decrypt } as any);
    const result = await service.getMyAssistantContext({ userId: 'owner', role: 'PATIENT', tokenId: 'test' });
    expect(findUnique).toHaveBeenCalledWith({ where: { authAccountId: 'owner' }, select: { version: true, updatedAt: true } });
    expect(Object.keys(result).sort()).toEqual(['profileStatus','updatedAt','version']);
    expect(result.profileStatus).toBe('COMPLETE'); expect(decrypt).not.toHaveBeenCalled();
  });
  it('denies staff and represents a missing profile without inventing data', async () => {
    const findUnique=jest.fn().mockResolvedValue(null);
    const service=new PatientsService({patient:{findUnique}} as any,{} as any);
    await expect(service.getMyAssistantContext({userId:'staff',role:'DOCTOR',tokenId:'test'})).rejects.toThrow();
    expect(findUnique).not.toHaveBeenCalled();
    expect(await service.getMyAssistantContext({userId:'owner',role:'PATIENT',tokenId:'test'})).toEqual({profileStatus:'MISSING',version:null,updatedAt:null});
  });
});
