// Run only against a disposable local Compose stack. Creates and removes QA accounts and one doctor.
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
require(path.join(root, 'services/node_modules/dotenv')).config({ path: path.join(root, '.env'), quiet: true });
const sharp = require(path.join(root, 'services/node_modules/sharp'));
const { PrismaClient } = require(path.join(root, 'services/generated/doctor-client'));

if (process.env.QA_PROFILE_IMAGE_SMOKE !== '1' || !process.env.QA_ADMIN_PASSWORD)
  throw new Error('Set QA_PROFILE_IMAGE_SMOKE=1 and QA_ADMIN_PASSWORD for the disposable local stack');

const base = process.env.QA_API_BASE_URL || 'http://localhost:8080';
const suffix = randomUUID().slice(0, 8);
const qaPassword = `Qa!${randomUUID()}aA1`;
const accounts = [];
const tokens = {};
let doctorId;
let adminToken;

async function request(route, method = 'GET', token, body, expected = 200) {
  let response;
  try {
    response = await fetch(base + route, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(method === 'POST' ? { 'idempotency-key': randomUUID() } : {}),
        ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Error(`${method} ${route}: ${error.message}`);
  }
  if (response.status !== expected) {
    const error = await response.text();
    throw new Error(`${method} ${route}: expected ${expected}, got ${response.status}: ${error.slice(0, 300)}`);
  }
  return response;
}

async function json(route, method, token, body, expected = 200) {
  return (await request(route, method, token, body, expected)).json();
}

async function login(email, password) {
  const result = await json('/auth/login', 'POST', undefined, { email, password });
  if (!result.accessToken) throw new Error(`Missing token for ${email}`);
  return result.accessToken;
}

async function upload(route, token, image, expected = 201) {
  const form = new FormData();
  form.append('file', new Blob([image], { type: 'image/png' }), 'qa.png');
  return request(route, 'POST', token, form, expected);
}

async function assertWebp(route, token) {
  const response = await request(route, 'GET', token);
  if (!response.headers.get('content-type')?.includes('image/webp')) throw new Error(`${route}: wrong content type`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const dimensions = await sharp(bytes).metadata();
  if (dimensions.format !== 'webp' || dimensions.width !== 512 || dimensions.height !== 512)
    throw new Error(`${route}: image was not normalized to 512px WebP`);
}

async function main() {
  adminToken = await login('admin@antam.local', process.env.QA_ADMIN_PASSWORD);
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#1688cc' } }).png().toBuffer();
  for (const role of ['PATIENT', 'RECEPTIONIST', 'DOCTOR']) {
    const email = `qa.profile.${role.toLowerCase()}.${suffix}@example.invalid`;
    const account = await json('/auth/admin/users', 'POST', adminToken, { email, password: qaPassword, role }, 201);
    accounts.push(account.id);
    tokens[role] = await login(email, qaPassword);
  }

  for (const [role, route] of [
    ['PATIENT', '/api/patients/me/avatar'],
    ['RECEPTIONIST', '/api/receptionists/me/avatar'],
  ]) {
    await request(route, 'GET', tokens[role], undefined, 404);
    await upload(route, tokens[role], image);
    await assertWebp(route, tokens[role]);
    await request(route, 'GET', undefined, undefined, 401);
    const otherRole = role === 'PATIENT' ? 'RECEPTIONIST' : 'PATIENT';
    await request(route, 'GET', tokens[otherRole], undefined, 403);
  }

  const specialties = await json('/api/doctors/specialties?limit=100', 'GET', adminToken);
  const specialty = specialties.data.find((item) => item.status === 'ACTIVE');
  if (!specialty) throw new Error('No active specialty for QA doctor');
  const doctor = await json('/api/doctors', 'POST', adminToken, {
    accountId: accounts[2], licenseNumber: `QA-PHOTO-${suffix}`,
    consultationRank: 'BASIC', specialtyId: specialty.id,
    profile: { fullName: `QA Photo ${suffix}`, practiceStartYear: 2015 },
  }, 201);
  doctorId = doctor.data.id;
  const route = `/api/doctors/${doctorId}/photo`;
  await upload(route, tokens.PATIENT, image, 403);
  await upload(route, tokens.DOCTOR, image);
  await assertWebp(route);
  const detail = await json(`/api/doctors/${doctorId}`, 'GET', adminToken);
  if (detail.data.profile.photoUrl !== `${base}${route}` || detail.data.profile.photoStorageKey !== undefined)
    throw new Error('Doctor profile did not expose the managed URL correctly');
  const invalid = new FormData();
  invalid.append('file', new Blob(['<svg/>'], { type: 'image/svg+xml' }), 'invalid.svg');
  await request(route, 'POST', adminToken, invalid, 400);

  // Keep uploaded files while the services restart, then verify them in this invocation.
  if (process.env.QA_PROFILE_IMAGE_PAUSE === '1') {
    console.log(JSON.stringify({ stage: 'uploaded', doctorId, accounts, suffix }));
    await new Promise((resolve) => process.stdin.once('data', resolve));
    process.stdin.pause();
    await assertWebp('/api/patients/me/avatar', tokens.PATIENT);
    await assertWebp('/api/receptionists/me/avatar', tokens.RECEPTIONIST);
    await assertWebp(route);
  }

  await request('/api/patients/me/avatar', 'DELETE', tokens.PATIENT);
  await request('/api/receptionists/me/avatar', 'DELETE', tokens.RECEPTIONIST);
  await request(route, 'DELETE', tokens.DOCTOR);
  for (const [role, avatarRoute] of [
    ['PATIENT', '/api/patients/me/avatar'], ['RECEPTIONIST', '/api/receptionists/me/avatar'],
  ]) await request(avatarRoute, 'GET', tokens[role], undefined, 404);
  await request(route, 'GET', undefined, undefined, 404);
  console.log(JSON.stringify({ result: 'PASS', portals: ['doctor', 'patient', 'receptionist'], validated: ['roles', 'format', 'privacy', 'delete'] }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  if (!adminToken) return;
  for (const [role, route] of [
    ['PATIENT', '/api/patients/me/avatar'],
    ['RECEPTIONIST', '/api/receptionists/me/avatar'],
  ]) {
    if (tokens[role]) await request(route, 'DELETE', tokens[role]).catch(() => undefined);
  }
  if (doctorId) await request(`/api/doctors/${doctorId}/photo`, 'DELETE', adminToken).catch(() => undefined);
  const databaseUrl = process.env.DOCTOR_DATABASE_URL ||
    `postgresql://${encodeURIComponent(process.env.DOCTOR_DB_USER || 'doctor')}:${encodeURIComponent(process.env.DOCTOR_DB_PASSWORD || 'doctorpass')}@localhost:${process.env.DOCTOR_DB_PORT || 5435}/${process.env.DOCTOR_DB_NAME || 'doctor'}?schema=public`;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    if (doctorId) {
      await prisma.auditRecord.deleteMany({ where: { doctorId } });
      await prisma.doctor.delete({ where: { id: doctorId } });
    }
    for (const accountId of accounts.reverse())
      await request(`/auth/admin/users/${accountId}`, 'DELETE', adminToken);
    console.log('QA accounts and doctor cleaned');
  } catch (error) {
    console.error(`QA cleanup failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
});
