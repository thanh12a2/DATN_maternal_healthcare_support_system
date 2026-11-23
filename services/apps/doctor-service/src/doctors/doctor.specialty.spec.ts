import { DoctorDomainService } from './doctor.service';

describe('doctor specialty administration', () => {
  const admin = { role: 'ADMIN', userId: 'admin-id' } as any;

  function setup() {
    const prisma = {
      specialty: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      doctorSpecialty: { count: jest.fn() },
      doctor: { findMany: jest.fn() },
      consultationRank: { findMany: jest.fn(), findUnique: jest.fn() },
    };
    const service = Object.create(DoctorDomainService.prototype) as DoctorDomainService;
    (service as any).prisma = prisma;
    return { service, prisma };
  }

  it('creates a specialty inactive in one request and lists inactive records for admins', async () => {
    const { service, prisma } = setup();
    prisma.specialty.findFirst.mockResolvedValue(null);
    prisma.specialty.create.mockResolvedValue({ id: 'specialty-id', status: 'INACTIVE' });
    prisma.specialty.findMany.mockResolvedValue([{ id: 'specialty-id', code: 'QA', name: 'QA', status: 'INACTIVE' }]);

    await service.createSpecialty(
      { code: 'qa', name: 'QA', status: 'INACTIVE' } as any,
      admin,
      'qa-key',
    );
    expect(prisma.specialty.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: 'QA', status: 'INACTIVE' }),
    });

    const list = await service.listSpecialties({ limit: 100 }, admin);
    expect(list.data).toHaveLength(1);
    expect(prisma.specialty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('rejects deactivation when the specialty has active doctors', async () => {
    const { service, prisma } = setup();
    prisma.specialty.findUnique.mockResolvedValue({
      id: 'specialty-id', name: 'QA', status: 'ACTIVE',
    });
    prisma.doctorSpecialty.count.mockResolvedValue(1);

    await expect(
      service.updateSpecialty('specialty-id', { status: 'INACTIVE' } as any, admin),
    ).rejects.toMatchObject({ status: 409 });
    expect(prisma.specialty.update).not.toHaveBeenCalled();
  });

  it('shows all doctor statuses to admins while keeping public listings active only', async () => {
    const { service, prisma } = setup();
    prisma.doctor.findMany.mockResolvedValue([{
      id: 'doctor-id', status: 'DRAFT', consultationRank: 'BASIC',
      accountId: 'account-id', licenseNumber: 'QA-LICENSE', version: 2,
      profile: { fullName: 'QA Doctor' }, rank: null,
      specialties: [{ specialty: { id: 'specialty-id', code: 'QA', name: 'QA', status: 'INACTIVE' }, isPrimary: true }],
      schedules: [], availabilities: [],
    }]);

    const adminList = await service.listDoctors({ limit: 10 }, admin);
    expect(prisma.doctor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
    expect(adminList.data[0]).toMatchObject({
      accountId: 'account-id', licenseNumber: 'QA-LICENSE', version: 2,
    });
    expect(adminList.data[0].specialties).toHaveLength(1);

    const publicList = await service.listDoctors({ limit: 10 });
    expect(prisma.doctor.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE', deletedAt: null } }),
    );
    expect(publicList.data[0]).not.toHaveProperty('accountId');
    expect(publicList.data[0].specialties).toHaveLength(0);
  });

  it('includes inactive consultation ranks for admins only', async () => {
    const { service, prisma } = setup();
    prisma.consultationRank.findMany.mockResolvedValue([]);

    await service.listConsultationRanks(admin);
    expect(prisma.consultationRank.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
    await service.listConsultationRanks();
    expect(prisma.consultationRank.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE' } }),
    );
  });

  it('creates doctor rank and primary specialty with the verified account in one database transaction', async () => {
    const { service, prisma } = setup();
    const verifyAccount = jest.spyOn(service as any, 'verifyAccount').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'auditOutbox').mockResolvedValue(undefined);
    prisma.consultationRank.findUnique.mockResolvedValue({ code: 'BASIC', status: 'ACTIVE', experienceYearsMin: 0 });
    prisma.specialty.findUnique.mockResolvedValue({ id: 'specialty-id', status: 'ACTIVE' });
    const tx = {
      doctor: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'doctor-id', accountId: 'account-id', licenseNumber: 'QA-LICENSE',
          version: 1, status: 'DRAFT', consultationRank: 'BASIC',
          profile: { fullName: 'QA Doctor' }, rank: null,
          specialties: [{ specialty: { id: 'specialty-id', code: 'QA', name: 'QA', status: 'ACTIVE' }, isPrimary: true }],
          schedules: [], availabilities: [],
        }),
      },
    };
    (prisma as any).$transaction = jest.fn().mockImplementation((operation) => operation(tx));

    const result = await service.createDoctor({
      accountId: 'account-id', licenseNumber: 'qa-license',
      consultationRank: 'BASIC', specialtyId: 'specialty-id',
      profile: { fullName: 'QA Doctor' },
    } as any, admin, 'qa-doctor-key');

    expect(verifyAccount).toHaveBeenCalledWith('account-id');
    expect(tx.doctor.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        accountId: 'account-id', licenseNumber: 'QA-LICENSE', consultationRank: 'BASIC',
        specialties: { create: { specialtyId: 'specialty-id', isPrimary: true } },
      }),
    }));
    expect(result.data.specialties).toHaveLength(1);
  });
});
