import { PrismaClient, AuthRoleCode } from '@prisma/client';

const prisma = new PrismaClient();

const roles: Array<{ code: AuthRoleCode; description: string }> = [
  { code: AuthRoleCode.PATIENT, description: 'Patient / Thai phụ' },
  { code: AuthRoleCode.RECEPTIONIST, description: 'Receptionist / Lễ tân' },
  { code: AuthRoleCode.DOCTOR, description: 'Doctor / Bác sĩ' },
  { code: AuthRoleCode.NURSE, description: 'Nurse or Midwife / Y tá, hộ sinh' },
  { code: AuthRoleCode.ADMIN, description: 'System administrator' },
];

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { description: role.description },
      create: role,
    });
  }
}

main()
  .catch((error) => {
    console.error('Failed to seed auth roles', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
