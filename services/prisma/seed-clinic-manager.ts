import argon2 from 'argon2';
import { AuthRoleCode, PrismaClient } from '@prisma/client';

process.env.AUTH_DATABASE_URL ??= 'postgresql://auth:authpass@127.0.0.1:5433/auth?schema=public';

const prisma = new PrismaClient();
const email = (process.env.CLINIC_MANAGER_SEED_EMAIL ?? 'clinic.manager@antam.local').trim().toLowerCase();
const password = process.env.CLINIC_MANAGER_SEED_PASSWORD ?? process.env.SEED_DEFAULT_PASSWORD ?? 'Demo@123456';

async function main() {
  const existing = await prisma.account.findUnique({
    where: { email },
    include: { credential: true, roles: { include: { role: true } } },
  });
  if (existing) {
    const ready = existing.status === 'ACTIVE' && !!existing.credential &&
      existing.roles.some(({ role }) => role.code === AuthRoleCode.CLINIC_MANAGER);
    if (!ready) throw new Error(`Account ${email} already exists without an active Clinic Manager login`);
    console.log(`Clinic Manager already seeded: ${email}`);
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.$transaction(async (tx) => {
    const role = await tx.role.upsert({
      where: { code: AuthRoleCode.CLINIC_MANAGER },
      update: {},
      create: { code: AuthRoleCode.CLINIC_MANAGER, description: 'Clinic operations manager' },
    });
    const account = await tx.account.create({ data: { email, status: 'ACTIVE' } });
    await tx.credential.create({ data: { accountId: account.id, passwordHash } });
    await tx.accountRole.create({ data: { accountId: account.id, roleId: role.id } });
  });
  console.log(`Created Clinic Manager: ${email}`);
}

main()
  .catch((error) => {
    console.error('Failed to seed Clinic Manager', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
