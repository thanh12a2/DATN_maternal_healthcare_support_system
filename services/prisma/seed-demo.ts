import argon2 from 'argon2';
import { PrismaClient as AuthPrismaClient, AuthRoleCode } from '@prisma/client';
import { PrismaClient as PatientPrismaClient } from '@prisma/patient-client';
import { PrismaClient as CatalogPrismaClient } from '../generated/catalog-client';
import { PrismaClient as DoctorPrismaClient } from '../generated/doctor-client';
import { PrismaClient as AppointmentPrismaClient } from '../generated/appointment-client';
import { PrismaClient as BillingPrismaClient } from '../generated/billing-client';
import { PrismaClient as QueuePrismaClient } from '../generated/queue-client';

const ids = {
  patientAccount: '00000000-0000-4000-8000-000000000001',
  doctorAccount: '00000000-0000-4000-8000-000000000002',
  receptionistAccount: '00000000-0000-4000-8000-000000000003',
  adminAccount: '00000000-0000-4000-8000-000000000004',
  patient: '10000000-0000-4000-8000-000000000001',
  doctor: '20000000-0000-4000-8000-000000000001',
  specialty: '21000000-0000-4000-8000-000000000001',
  room: '23000000-0000-4000-8000-000000000001',
  service: '30000000-0000-4000-8000-000000000001',
  category: '31000000-0000-4000-8000-000000000001',
  price: '32000000-0000-4000-8000-000000000001',
  appointment: '40000000-0000-4000-8000-000000000001',
  invoice: '50000000-0000-4000-8000-000000000001',
  invoiceLine: '51000000-0000-4000-8000-000000000001',
  journey: '60000000-0000-4000-8000-000000000001',
  stage: '61000000-0000-4000-8000-000000000001',
  ticket: '62000000-0000-4000-8000-000000000001',
  encounter: '70000000-0000-4000-8000-000000000001',
};

const localDatabaseUrls: Record<string, string> = {
  AUTH_DATABASE_URL:
    'postgresql://auth:authpass@127.0.0.1:5433/auth?schema=public',
  PATIENT_DATABASE_URL:
    'postgresql://patient:patientpass@127.0.0.1:5434/patient?schema=public',
  DOCTOR_DATABASE_URL:
    'postgresql://doctor:doctorpass@127.0.0.1:5435/doctor?schema=public',
  CATALOG_DATABASE_URL:
    'postgresql://catalog:catalogpass@127.0.0.1:5437/catalog?schema=public',
  APPOINTMENT_DATABASE_URL:
    'postgresql://appointment:appointmentpass@127.0.0.1:5438/appointment?schema=public',
  BILLING_DATABASE_URL:
    'postgresql://billing:billingpass@127.0.0.1:5439/billing?schema=public',
  QUEUE_DATABASE_URL:
    'postgresql://queue:queuepass@127.0.0.1:5441/queue?schema=public',
};

for (const [name, value] of Object.entries(localDatabaseUrls)) {
  process.env[name] ??= value;
}

const auth = new AuthPrismaClient();
const patient = new PatientPrismaClient();
const catalog = new CatalogPrismaClient();
const doctor = new DoctorPrismaClient();
const appointment = new AppointmentPrismaClient();
const billing = new BillingPrismaClient();
const queue = new QueuePrismaClient();

const demoPassword = process.env.DEMO_SEED_PASSWORD ?? 'Demo@123456';
const now = new Date();
const tomorrow = new Date(now);
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(9, 0, 0, 0);
const tomorrowEnd = new Date(tomorrow);
tomorrowEnd.setMinutes(tomorrowEnd.getMinutes() + 30);
const businessDate = new Date(tomorrow);
businessDate.setHours(0, 0, 0, 0);

async function seedAuth(passwordHash: string) {
  const roles = [
    [AuthRoleCode.PATIENT, 'Patient / Thai phụ'],
    [AuthRoleCode.DOCTOR, 'Doctor / Bác sĩ'],
    [AuthRoleCode.RECEPTIONIST, 'Receptionist / Lễ tân'],
    [AuthRoleCode.CLINIC_MANAGER, 'Clinic operations manager'],
    [AuthRoleCode.ADMIN, 'System administrator'],
  ] as const;

  const roleRows = new Map<AuthRoleCode, { id: string }>();
  for (const [code, description] of roles) {
    roleRows.set(
      code,
      await auth.role.upsert({
        where: { code },
        update: { description },
        create: { code, description },
      }),
    );
  }

  const accounts = [
    {
      id: ids.patientAccount,
      email: 'demo.patient@antam.local',
      role: AuthRoleCode.PATIENT,
    },
    {
      id: ids.doctorAccount,
      email: 'demo.doctor@antam.local',
      role: AuthRoleCode.DOCTOR,
    },
    {
      id: ids.receptionistAccount,
      email: 'demo.receptionist@antam.local',
      role: AuthRoleCode.RECEPTIONIST,
    },
    {
      id: ids.adminAccount,
      email: 'demo.admin@antam.local',
      role: AuthRoleCode.ADMIN,
    },
  ];

  for (const account of accounts) {
    const accountRow = await auth.account.upsert({
      where: { email: account.email },
      update: { status: 'ACTIVE' },
      create: { id: account.id, email: account.email, status: 'ACTIVE' },
    });
    account.id = accountRow.id;
    if (account.role === AuthRoleCode.PATIENT)
      ids.patientAccount = accountRow.id;
    if (account.role === AuthRoleCode.DOCTOR) ids.doctorAccount = accountRow.id;
    if (account.role === AuthRoleCode.RECEPTIONIST)
      ids.receptionistAccount = accountRow.id;
    if (account.role === AuthRoleCode.ADMIN) ids.adminAccount = accountRow.id;
    await auth.credential.upsert({
      where: { accountId: accountRow.id },
      update: { passwordHash },
      create: { accountId: accountRow.id, passwordHash },
    });
    await auth.accountRole.upsert({
      where: {
        accountId_roleId: {
          accountId: accountRow.id,
          roleId: roleRows.get(account.role)!.id,
        },
      },
      update: {},
      create: {
        accountId: accountRow.id,
        roleId: roleRows.get(account.role)!.id,
      },
    });
  }
}

async function seedPatient() {
  const patientRow = await patient.patient.upsert({
    where: { authAccountId: ids.patientAccount },
    update: {
      fullName: 'Nguyễn Minh Anh',
      normalizedFullName: 'NGUYEN MINH ANH',
      phoneNumber: '0901000001',
      address: '12 Nguyễn Du, Hà Nội',
      updatedByAccountId: ids.patientAccount,
    },
    create: {
      id: ids.patient,
      authAccountId: ids.patientAccount,
      fullName: 'Nguyễn Minh Anh',
      normalizedFullName: 'NGUYEN MINH ANH',
      dateOfBirth: new Date('1995-06-15T00:00:00.000Z'),
      phoneNumber: '0901000001',
      address: '12 Nguyễn Du, Hà Nội',
      createdByAccountId: ids.patientAccount,
      updatedByAccountId: ids.patientAccount,
    },
  });
  ids.patient = patientRow.id;
  const emergencyContact = await patient.emergencyContact.findFirst({
    where: { patientId: ids.patient },
  });
  const emergencyContactData = {
    fullName: 'Trần Văn Bình',
    phoneNumber: '0901000002',
    relationship: 'Chồng',
    isPrimary: true,
    priority: 1,
  };
  if (emergencyContact) {
    await patient.emergencyContact.update({
      where: { id: emergencyContact.id },
      data: emergencyContactData,
    });
  } else {
    await patient.emergencyContact.create({
      data: {
        id: '11000000-0000-4000-8000-000000000001',
        patientId: ids.patient,
        ...emergencyContactData,
      },
    });
  }
}

async function seedCatalog() {
  const categoryRow = await catalog.catalogTag.upsert({
    where: { code: 'PRENATAL' },
    update: { name: 'Khám thai', status: 'ACTIVE', group: 'LABEL' },
    create: {
      id: ids.category,
      code: 'PRENATAL',
      slug: 'kham-thai',
      name: 'Khám thai',
      group: 'LABEL',
      status: 'ACTIVE',
      sortOrder: 1,
    },
  });
  ids.category = categoryRow.id;
  const serviceRow = await catalog.medicalService.upsert({
    where: { code: 'PRENATAL_BASIC' },
    update: {
      name: 'Khám thai định kỳ',
      specialtyId: ids.specialty,
      status: 'ACTIVE',
      bookingEnabled: true,
    },
    create: {
      id: ids.service,
      code: 'PRENATAL_BASIC',
      slug: 'kham-thai-dinh-ky',
      name: 'Khám thai định kỳ',
      summary: 'Khám và theo dõi thai kỳ định kỳ',
      kind: 'CONSULTATION',
      specialtyId: ids.specialty,
      durationMinutes: 30,
      bookingEnabled: true,
      doctorRankSelectionPolicy: 'BASIC_INCLUDED',
      status: 'ACTIVE',
      publishedAt: now,
    },
  });
  ids.service = serviceRow.id;
  await catalog.medicalServiceTag.upsert({
    where: {
      medicalServiceId_tagId: {
        medicalServiceId: ids.service,
        tagId: ids.category,
      },
    },
    update: {},
    create: { medicalServiceId: ids.service, tagId: ids.category },
  });
  const priceRow = await catalog.basePrice.upsert({
    where: { id: ids.price },
    update: { amountMinor: BigInt(350000), status: 'ACTIVE' },
    create: {
      id: ids.price,
      medicalServiceId: ids.service,
      amountMinor: BigInt(350000),
      currency: 'VND',
      effectiveFrom: now,
      status: 'ACTIVE',
    },
  });
  ids.price = priceRow.id;
}

async function seedDoctor() {
  const specialtyRow = await doctor.specialty.upsert({
    where: { code: 'OBGYN' },
    update: { name: 'Sản - Phụ khoa', status: 'ACTIVE' },
    create: {
      id: ids.specialty,
      code: 'OBGYN',
      name: 'Sản - Phụ khoa',
      status: 'ACTIVE',
    },
  });
  ids.specialty = specialtyRow.id;
  const roomRow = await doctor.clinicRoom.upsert({
    where: { code: 'P.201' },
    update: { name: 'Phòng khám Sản Phụ khoa 201', status: 'ACTIVE' },
    create: {
      id: ids.room,
      code: 'P.201',
      name: 'Phòng khám Sản Phụ khoa 201',
      status: 'ACTIVE',
    },
  });
  ids.room = roomRow.id;
  const doctorRow = await doctor.doctor.upsert({
    where: { accountId: ids.doctorAccount },
    update: { status: 'ACTIVE', consultationRank: 'BASIC' },
    create: {
      id: ids.doctor,
      accountId: ids.doctorAccount,
      licenseNumber: 'BS-DEMO-001',
      consultationRank: 'BASIC',
      status: 'ACTIVE',
    },
  });
  ids.doctor = doctorRow.id;
  await doctor.doctorProfile.upsert({
    where: { doctorId: ids.doctor },
    update: {
      fullName: 'BS. Lê Thu Hà',
      professionalTitle: 'Bác sĩ Sản - Phụ khoa',
      practiceStartYear: 2012,
      languages: ['vi'],
    },
    create: {
      doctorId: ids.doctor,
      fullName: 'BS. Lê Thu Hà',
      professionalTitle: 'Bác sĩ Sản - Phụ khoa',
      practiceStartYear: 2012,
      languages: ['vi'],
    },
  });
  await doctor.doctorSpecialty.upsert({
    where: {
      doctorId_specialtyId: {
        doctorId: ids.doctor,
        specialtyId: ids.specialty,
      },
    },
    update: { isPrimary: true },
    create: {
      doctorId: ids.doctor,
      specialtyId: ids.specialty,
      isPrimary: true,
    },
  });
  for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek += 1) {
    const scheduleId = `22000000-0000-4000-8000-${String(dayOfWeek).padStart(12, '0')}`;
    await doctor.doctorSchedule.upsert({
      where: { id: scheduleId },
      update: {
        status: 'ACTIVE',
        dayOfWeek,
        roomId: ids.room,
        effectiveFrom: businessDate,
        effectiveTo: null,
        startTime: '08:00:00',
        endTime: '17:00:00',
        slotDurationMinutes: 30,
      },
      create: {
        id: scheduleId,
        doctorId: ids.doctor,
        dayOfWeek,
        roomId: ids.room,
        startTime: '08:00:00',
        endTime: '17:00:00',
        slotDurationMinutes: 30,
        effectiveFrom: businessDate,
        status: 'ACTIVE',
      },
    });
  }
}

async function seedAppointmentBillingQueue() {
  const appointmentRow = await appointment.appointment.upsert({
    where: { appointmentCode: 'AT-DEMO-0001' },
    update: {
      status: 'BOOKED',
      startAt: tomorrow,
      endAt: tomorrowEnd,
      roomId: ids.room,
      roomCode: 'P.201',
      roomNameSnapshot: 'Phòng khám Sản Phụ khoa 201',
    },
    create: {
      id: ids.appointment,
      appointmentCode: 'AT-DEMO-0001',
      patientId: ids.patient,
      serviceId: ids.service,
      channel: 'ONLINE',
      selectionMode: 'DOCTOR',
      requestedDoctorId: ids.doctor,
      assignedDoctorId: ids.doctor,
      assignedRankCode: 'BASIC',
      specialtyId: ids.specialty,
      roomId: ids.room,
      roomCode: 'P.201',
      roomNameSnapshot: 'Phòng khám Sản Phụ khoa 201',
      startAt: tomorrow,
      endAt: tomorrowEnd,
      serviceNameSnapshot: 'Khám thai định kỳ',
      serviceVersion: 1,
      basePriceId: ids.price,
      baseAmountMinor: BigInt(350000),
      rankSurchargeAmountMinor: BigInt(0),
      estimatedTotalMinor: BigInt(350000),
      availabilityVersion: BigInt(1),
      status: 'BOOKED',
    },
  });
  ids.appointment = appointmentRow.id;
  const invoiceRow = await billing.invoice.upsert({
    where: { invoiceNumber: 'INV-DEMO-0001' },
    update: { status: 'OPEN', balanceMinor: BigInt(350000) },
    create: {
      id: ids.invoice,
      invoiceNumber: 'INV-DEMO-0001',
      patientId: ids.patient,
      appointmentId: ids.appointment,
      type: 'BASE',
      status: 'OPEN',
      subtotalMinor: BigInt(350000),
      totalMinor: BigInt(350000),
      paidMinor: BigInt(0),
      balanceMinor: BigInt(350000),
      sourceVersion: BigInt(1),
      dueAt: tomorrow,
    },
  });
  ids.invoice = invoiceRow.id;
  await billing.invoiceLine.upsert({
    where: { id: ids.invoiceLine },
    update: { lineAmountMinor: BigInt(350000) },
    create: {
      id: ids.invoiceLine,
      invoiceId: ids.invoice,
      lineNo: 1,
      source: 'APPOINTMENT_SNAPSHOT',
      sourceReferenceId: ids.appointment,
      serviceId: ids.service,
      descriptionSnapshot: 'Khám thai định kỳ',
      quantity: 1,
      unitAmountMinor: BigInt(350000),
      lineAmountMinor: BigInt(350000),
    },
  });
  const stageRow = await queue.queueStage.upsert({
    where: { code: 'REGISTRATION' },
    update: { name: 'Tiếp nhận', active: true, roomCode: 'P.101' },
    create: {
      id: ids.stage,
      code: 'REGISTRATION',
      name: 'Tiếp nhận',
      active: true,
      roomCode: 'P.101',
    },
  });
  ids.stage = stageRow.id;
  const journeyRow = await queue.queueJourney.upsert({
    where: { appointmentId: ids.appointment },
    update: { state: 'ACTIVE', patientId: ids.patientAccount },
    create: {
      id: ids.journey,
      appointmentId: ids.appointment,
      patientId: ids.patientAccount,
      encounterId: ids.encounter,
      businessDate,
      state: 'ACTIVE',
    },
  });
  ids.journey = journeyRow.id;
  await queue.stageTicket.upsert({
    where: { id: ids.ticket },
    update: { state: 'WAITING', roomCode: 'P.201' },
    create: {
      id: ids.ticket,
      journeyId: ids.journey,
      stageId: ids.stage,
      roomCode: 'P.201',
      businessDate,
      ordinal: 1,
      ticketCode: 'A001',
      state: 'WAITING',
      basePriority: 'ROUTINE',
      enqueueSequence: BigInt(1),
    },
  });
}

async function main() {
  const passwordHash = await argon2.hash(demoPassword);
  await seedAuth(passwordHash);
  await seedPatient();
  await seedCatalog();
  await seedDoctor();
  await seedAppointmentBillingQueue();
  console.log(
    'Demo seed completed. Demo password is controlled by DEMO_SEED_PASSWORD.',
  );
}

main()
  .catch((error) => {
    console.error('Demo seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([
      auth.$disconnect(),
      patient.$disconnect(),
      catalog.$disconnect(),
      doctor.$disconnect(),
      appointment.$disconnect(),
      billing.$disconnect(),
      queue.$disconnect(),
    ]);
  });
