import { BadRequestException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService account ID filtering', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const prisma = { account: { findMany, count } };
  const service = new AdminUsersService(prisma as never, {} as never);

  beforeEach(() => {
    findMany.mockClear();
    count.mockClear();
  });

  it('restricts the query to the requested account IDs', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    await service.listUsers({ ids: id, page: 1, limit: 50 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [id] } } }),
    );
    expect(count).toHaveBeenCalledWith({ where: { id: { in: [id] } } });
  });

  it('rejects malformed account IDs', async () => {
    await expect(service.listUsers({ ids: 'not-a-uuid', page: 1, limit: 50 }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
