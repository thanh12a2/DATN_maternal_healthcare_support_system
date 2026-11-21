import { AuditService } from './audit.service';

describe('admin client audit records', () => {
  it('takes the actor from the verified caller and drops arbitrary request metadata', async () => {
    const create = jest.fn().mockImplementation(async ({ data }) => ({
      id: 'created-entry',
      eventId: data.eventId,
    }));
    const service = new AuditService(
      { auditEntry: { create } } as any,
      {} as any,
      {} as any,
    );

    const result = await service.recordAdminClientLog({
      action: 'USER_ACCOUNT_CREATED',
      aggregateType: 'USER_ACCOUNT',
      aggregateId: 'qa-account',
      result: 'SUCCESS',
      changedFields: ['email', 'password'],
      metadata: {
        description: 'Created QA account',
        targetService: 'auth-service',
        password: 'must-not-be-persisted',
        actorId: 'forged-id',
      },
    }, 'verified-admin-id');

    const data = create.mock.calls[0][0].data;
    expect(result.id).toBe('created-entry');
    expect(data.actorId).toBe('verified-admin-id');
    expect(data.sourceService).toBe('admin-frontend');
    expect(data.eventType).toBe('admin.client.USER_ACCOUNT_CREATED');
    expect(data.metadata).toEqual({
      description: 'Created QA account',
      targetService: 'auth-service',
      origin: 'client-reported',
    });
    expect(JSON.stringify(data)).not.toContain('must-not-be-persisted');
  });
});
