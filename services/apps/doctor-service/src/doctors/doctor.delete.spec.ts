import { DoctorDomainService } from './doctor.service';

describe('doctor deletion', () => {
  const admin = { role: 'ADMIN', userId: 'admin-id' } as any;
  const doctor = {
    id: 'doctor-id', accountId: 'account-id', version: 3,
    status: 'ACTIVE', deletedAt: null,
    profile: { photoStorageKey: 'profile-images/doctor-id/photo.jpg' },
  };

  function setup(accountStatus = 'ACCOUNT_STATUS_DISABLED') {
    const tx = {
      doctor: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      doctorSchedule: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      doctorAvailability: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      doctorProfile: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      doctor: { findUnique: jest.fn().mockResolvedValue(doctor) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const grpc = {
      client: jest.fn().mockReturnValue({}), metadata: jest.fn().mockReturnValue({}),
      unary: jest.fn().mockResolvedValue({ account: { status: accountStatus } }),
    };
    const images = { remove: jest.fn().mockResolvedValue(undefined) };
    const service = Object.create(DoctorDomainService.prototype) as DoctorDomainService;
    Object.assign(service, {
      prisma, grpc, images, config: { get: jest.fn().mockReturnValue(undefined) },
    });
    jest.spyOn(service as any, 'auditOutbox').mockResolvedValue(undefined);
    return { service, prisma, grpc, images, tx };
  }

  afterEach(() => jest.restoreAllMocks());

  it('retains the doctor record and history while removing operational access', async () => {
    const { service, prisma, tx, images } = setup();
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ items: [] }),
    } as Response);

    await expect(service.deleteDoctor('doctor-id', admin, 3, 'Bearer admin-token'))
      .resolves.toEqual({ data: { id: 'doctor-id', version: 4, deleted: true } });

    expect(tx.doctor.updateMany).toHaveBeenCalledWith({
      where: { id: 'doctor-id', version: 3, deletedAt: null },
      data: { deletedAt: expect.any(Date), status: 'INACTIVE', version: { increment: 1 } },
    });
    expect(tx.doctorSchedule.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { doctorId: 'doctor-id', status: 'ACTIVE' },
    }));
    expect(tx.doctorAvailability.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { doctorId: 'doctor-id', status: 'ACTIVE' },
    }));
    expect(tx.doctorProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { photoUrl: null, photoStorageKey: null },
    }));
    expect((service as any).auditOutbox).toHaveBeenCalledWith(
      tx, 'doctor.deleted', 'admin-id', 'doctor-id', 4, undefined, { historyRetained: true },
    );
    expect(images.remove).toHaveBeenCalledWith(doctor.profile.photoStorageKey);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(prisma.doctor).not.toHaveProperty('delete');
  });

  it('rejects deletion while the login is still enabled', async () => {
    const { service, prisma } = setup('ACCOUNT_STATUS_ACTIVE');
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(service.deleteDoctor('doctor-id', admin, 3, 'Bearer admin-token'))
      .rejects.toMatchObject({ status: 409 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects deletion when the doctor has unfinished appointments', async () => {
    const { service, prisma } = setup();
    jest.spyOn(global, 'fetch').mockImplementation(async (url) => ({
      ok: true,
      json: async () => ({ items: String(url).includes('status=BOOKED') ? [{ id: 'appointment-id' }] : [] }),
    } as Response));
    await expect(service.deleteDoctor('doctor-id', admin, 3, 'Bearer admin-token'))
      .rejects.toMatchObject({ status: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
