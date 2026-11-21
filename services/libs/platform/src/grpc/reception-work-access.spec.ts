import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { ReceptionWorkAccess } from './reception-work-access';

describe('reception work access', () => {
  const unary = jest.fn();
  const grpc = { client: jest.fn().mockReturnValue({}), metadata: jest.fn().mockReturnValue({}), unary };
  const access = new ReceptionWorkAccess({ get: () => undefined } as any, grpc as any);
  beforeEach(() => unary.mockReset());

  it('holds the case for the duration of the mutation and releases it afterward', async () => {
    unary.mockResolvedValueOnce({ allowed: true, token: 'token' }).mockResolvedValueOnce({ released: true });
    const action = jest.fn().mockResolvedValue('done');
    await expect(access.run('appointment', 'account', action)).resolves.toBe('done');
    expect(unary.mock.calls.map(call => call[1])).toEqual(['beginOperation', 'endOperation']);
    expect(unary.mock.calls[1][2]).toEqual({ token: 'token' });
  });

  it('releases the case if the mutation fails', async () => {
    unary.mockResolvedValueOnce({ allowed: true, token: 'token' }).mockResolvedValueOnce({ released: true });
    await expect(access.run('appointment', 'account', async () => { throw new Error('failure'); })).rejects.toThrow('failure');
    expect(unary).toHaveBeenCalledTimes(2);
  });

  it('does not execute a mutation for another owner or an unavailable service', async () => {
    const action = jest.fn();
    unary.mockResolvedValueOnce({ allowed: false, token: '' });
    await expect(access.run('appointment', 'other', action)).rejects.toBeInstanceOf(ConflictException);
    unary.mockRejectedValueOnce(new Error('unavailable'));
    await expect(access.run('appointment', 'owner', action)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(action).not.toHaveBeenCalled();
  });
});
