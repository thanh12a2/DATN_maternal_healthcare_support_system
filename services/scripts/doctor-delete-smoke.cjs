// Runs against the local Compose stack and cleans up only records created by this script.
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
require(path.join(root, 'services/node_modules/dotenv')).config({ path: path.join(root, '.env'), quiet: true });
const { PrismaClient } = require(path.join(root, 'services/generated/doctor-client'));

if (process.env.QA_DOCTOR_DELETE_SMOKE !== '1' || !process.env.QA_ADMIN_PASSWORD)
  throw new Error('Set QA_DOCTOR_DELETE_SMOKE=1 and QA_ADMIN_PASSWORD for the local Compose stack');

const base = process.env.QA_API_BASE_URL || 'http://localhost:8080';
const suffix = randomUUID().slice(0, 8);
const name = `QA Delete ${suffix}`;
const qaPassword = `Qa!${randomUUID()}aA1`;
let adminToken;
let accountId;
let doctorId;

async function request(route, method = 'GET', body, expected = 200, extraHeaders = {}) {
  const response = await fetch(base + route, {
    method,
    headers: {
      ...(adminToken ? { authorization: `Bearer ${adminToken}` } : {}),
      ...(method === 'POST' ? { 'idempotency-key': randomUUID() } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...extraHeaders,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status !== expected) {
    const text = await response.text();
    throw new Error(`${method} ${route}: expected ${expected}, got ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

async function main() {
  const auth = await request('/auth/login', 'POST', {
    email: 'admin@antam.local', password: process.env.QA_ADMIN_PASSWORD,
  });
  adminToken = auth.accessToken;
  if (!adminToken) throw new Error('Admin login did not return an access token');

  const account = await request('/auth/admin/users', 'POST', {
    email: `qa.delete.${suffix}@example.invalid`,
    password: qaPassword, role: 'DOCTOR',
  }, 201);
  accountId = account.id;
  const doctorAuth = await request('/auth/login', 'POST', {
    email: `qa.delete.${suffix}@example.invalid`, password: qaPassword,
  });

  const specialties = await request('/api/doctors/specialties?limit=100');
  const specialty = specialties.data.find((item) => item.status === 'ACTIVE');
  if (!specialty) throw new Error('No active specialty for the QA doctor');

  const created = await request('/api/doctors', 'POST', {
    accountId, licenseNumber: `QA-DELETE-${suffix}`,
    consultationRank: 'BASIC', specialtyId: specialty.id,
    profile: { fullName: name, practiceStartYear: 2015 },
  }, 201);
  doctorId = created.data.id;
  const version = created.data.version;
  const route = `/api/doctors/${doctorId}`;

  await request(route, 'DELETE', undefined, 403, {
    'if-match': String(version), authorization: `Bearer ${doctorAuth.accessToken}`,
  });
  const activeError = await request(route, 'DELETE', undefined, 409, { 'if-match': String(version) });
  if (activeError.error?.code !== 'DOCTOR_ACCOUNT_MUST_BE_DISABLED')
    throw new Error(`Unexpected active-account error: ${JSON.stringify(activeError).slice(0, 300)}`);
  const before = await request(`/api/doctors?q=${encodeURIComponent(name)}&limit=100`);
  if (!before.data.some((item) => item.id === doctorId)) throw new Error('QA doctor missing before deletion');

  await request(`/auth/admin/users/${accountId}`, 'PATCH', { status: 'DISABLED' });
  const deleted = await request(route, 'DELETE', undefined, 200, { 'if-match': String(version) });
  if (deleted.data?.id !== doctorId || deleted.data?.deleted !== true) throw new Error('Unexpected delete response');

  await request(route, 'GET', undefined, 404);
  const after = await request(`/api/doctors?q=${encodeURIComponent(name)}&limit=100`);
  if (after.data.some((item) => item.id === doctorId)) throw new Error('Deleted doctor remains in listings');

  const accountAfter = await request(`/auth/admin/users/${accountId}`);
  if (accountAfter.status !== 'DISABLED') throw new Error('Doctor account is not disabled');

  const databaseUrl = process.env.DOCTOR_DATABASE_URL ||
    `postgresql://${encodeURIComponent(process.env.DOCTOR_DB_USER || 'doctor')}:${encodeURIComponent(process.env.DOCTOR_DB_PASSWORD || 'doctorpass')}@localhost:${process.env.DOCTOR_DB_PORT || 5435}/${process.env.DOCTOR_DB_NAME || 'doctor'}?schema=public`;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const stored = await prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!stored?.deletedAt || stored.status !== 'INACTIVE') throw new Error('Doctor history was not retained as inactive');
    const audit = await prisma.auditRecord.findFirst({ where: { doctorId, eventType: 'doctor.deleted' } });
    if (!audit) throw new Error('Doctor deletion audit record missing');
  } finally {
    await prisma.$disconnect();
  }
  console.log(JSON.stringify({ result: 'PASS', checks: ['non-admin rejected', 'active account rejected', 'account disabled', 'doctor hidden', 'history retained', 'audit recorded'] }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  if (!adminToken) return;
  if (doctorId) {
    const databaseUrl = process.env.DOCTOR_DATABASE_URL ||
      `postgresql://${encodeURIComponent(process.env.DOCTOR_DB_USER || 'doctor')}:${encodeURIComponent(process.env.DOCTOR_DB_PASSWORD || 'doctorpass')}@localhost:${process.env.DOCTOR_DB_PORT || 5435}/${process.env.DOCTOR_DB_NAME || 'doctor'}?schema=public`;
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await prisma.auditRecord.deleteMany({ where: { doctorId } });
      await prisma.doctor.delete({ where: { id: doctorId } });
    } catch (error) {
      console.error(`QA doctor cleanup failed: ${error.message}`);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  }
  if (accountId) {
    try { await request(`/auth/admin/users/${accountId}`, 'DELETE'); }
    catch (error) { console.error(`QA account cleanup failed: ${error.message}`); process.exitCode = 1; }
  }
});
