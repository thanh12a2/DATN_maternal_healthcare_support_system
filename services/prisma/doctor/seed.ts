import { PrismaClient } from '../../generated/doctor-client';

const prisma = new PrismaClient();

async function main() {
  // The specification does not define initial specialty records.
  // Keep the seed idempotent and intentionally data-neutral.
  await prisma.$queryRaw`SELECT 1`;
  console.log(
    'Doctor database seed completed (no initial domain data specified).',
  );
}

main()
  .catch((error) => {
    console.error('Failed to seed doctor database', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
