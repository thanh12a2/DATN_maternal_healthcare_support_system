/**
 * seed_system_data.js
 *
 * Toàn diện kịch bản Seed Data cho Hệ thống Hỗ trợ Y tế Thai sản & Sản Phụ khoa An Tâm (AnTam Maternal Care)
 * Khớp 100% với toàn bộ Prisma Schemas & Database Tables của tất cả các microservices:
 * 1. Auth Service (accounts, credentials, roles, account_roles)
 * 2. Doctor Service (specialties, consultation_ranks, doctors, doctor_profiles, doctor_specialties, doctor_schedules)
 * 3. Receptionist Service (receptionists, receptionist_profiles)
 * 4. Catalog Service (service_categories, catalog_tags, doctor_rank_surcharges, medical_services, base_prices, links)
 * 5. Patient Service (patients, emergency_contacts với mã hóa AES-256-GCM + HMAC-SHA256 lookup hash)
 * 6. Appointment Service (appointments, slot_holds, appointment_assignment_history)
 * 7. Billing Service (invoices, invoice_lines, payments)
 * 8. Queue Service (queue_stages, queue_journeys, stage_tickets)
 * 9. Medical Record Service (pregnancy_episodes, clinical_encounters, vital_signs, clinical_notes, diagnoses, clinical_service_orders)
 * 10. Prescription Service (medication_catalog, prescriptions, prescription_items)
 * 11. Treatment Plan Service (treatment_plans, treatment_plan_items)
 * 12. Consultation Service (consultation_threads, consultation_messages)
 * 13. Notification Service (notifications)
 * 14. Audit Log Service (audit_entries)
 */

const { Client } = require('pg');
const argon2 = require('argon2');
const crypto = require('crypto');

// Cấu hình Database URLs cục bộ
const DB_CONFIGS = {
  auth: process.env.AUTH_DATABASE_URL || 'postgresql://auth:authpass@localhost:5433/auth?sslmode=disable',
  doctor: process.env.DOCTOR_DATABASE_URL || 'postgresql://doctor:doctorpass@localhost:5435/doctor?sslmode=disable',
  receptionist: process.env.RECEPTIONIST_DATABASE_URL || 'postgresql://receptionist:receptionistpass@localhost:5436/receptionist?sslmode=disable',
  catalog: process.env.CATALOG_DATABASE_URL || 'postgresql://catalog:catalogpass@localhost:5437/catalog?sslmode=disable',
  patient: process.env.PATIENT_DATABASE_URL || 'postgresql://patient:patientpass@localhost:5434/patient?sslmode=disable',
  appointment: process.env.APPOINTMENT_DATABASE_URL || 'postgresql://appointment:appointmentpass@localhost:5438/appointment?sslmode=disable',
  billing: process.env.BILLING_DATABASE_URL || 'postgresql://billing:billingpass@localhost:5439/billing?sslmode=disable',
  queue: process.env.QUEUE_DATABASE_URL || 'postgresql://queue:queuepass@localhost:5441/queue?sslmode=disable',
  medicalRecord: process.env.MEDICAL_RECORD_DATABASE_URL || 'postgresql://medical_record:medical_recordpass@localhost:5440/medical_record?sslmode=disable',
  prescription: process.env.PRESCRIPTION_DATABASE_URL || 'postgresql://prescription:prescriptionpass@localhost:5443/prescription?sslmode=disable',
  treatmentPlan: process.env.TREATMENT_PLAN_DATABASE_URL || 'postgresql://treatment_plan:treatment_planpass@localhost:5444/treatment_plan?sslmode=disable',
  consultation: process.env.CONSULTATION_DATABASE_URL || 'postgresql://consultation:consultationpass@localhost:5448/consultation?sslmode=disable',
  notification: process.env.NOTIFICATION_DATABASE_URL || 'postgresql://notification:notificationpass@localhost:5445/notification?sslmode=disable',
  auditLog: process.env.AUDIT_LOG_DATABASE_URL || 'postgresql://audit_log:audit_logpass@localhost:5446/audit_log?sslmode=disable',
};

// Cấu hình Mã hóa Căn cước công dân (National ID)
const NATIONAL_ID_PEPPER = process.env.PATIENT_NATIONAL_ID_LOOKUP_PEPPER || 'd1a3011149525501818e85f551c880f07e2c556c50d86d04033dee5cead0ef34';
const NATIONAL_ID_KEY_BASE64 = process.env.PATIENT_NATIONAL_ID_ENCRYPTION_KEY || 'oZu5EErVRbGFz2JEnP+cutgk8uLbsvWruE08vG/wpmg=';

function encryptNationalId(val) {
  const key = Buffer.from(NATIONAL_ID_KEY_BASE64, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(val, 'utf8'), cipher.final()]);
  const ciphertext = [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    enc.toString('base64url'),
  ].join('.');
  const lookupHash = crypto.createHmac('sha256', NATIONAL_ID_PEPPER).update(val).digest('hex');
  return { ciphertext, lookupHash };
}

function removeAccents(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase();
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function normalizePhone(v) {
  if (!v) return v;
  let r = v.trim().replace(/[\s().-]/g, '');
  if (r.startsWith('00')) r = '+' + r.slice(2);
  if (/^0\d{9}$/.test(r)) r = '+84' + r.slice(1);
  if (/^84\d{9}$/.test(r)) r = '+' + r;
  return r;
}

function normalizeSearchName(v) {
  if (!v) return '';
  return v.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('vi-VN');
}

// Mật khẩu mặc định cho tất cả tài khoản Seed
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Demo@123456';

async function main() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU QUÁ TRÌNH SEED DỮ LIỆU TOÀN DIỆN CHO TOÀN BỘ HỆ THỐNG');
  console.log('================================================================\n');

  const clients = {};
  for (const [key, url] of Object.entries(DB_CONFIGS)) {
    clients[key] = new Client({ connectionString: url });
    await clients[key].connect();
  }
  console.log('✅ Đã kết nối thành công đến tất cả 14 Database Services.');

  // ============================================================================
  // 0. DỌN SẠCH DỮ LIỆU CŨ TRONG TẤT CẢ CÁC DATABASE (IDEMPOTENT TRUNCATE)
  // ============================================================================
  console.log('\n--- BƯỚC 0: DỌN SẠCH DỮ LIỆU CŨ THEO THỨ TỰ RÀNG BUỘC KHÓA NGOẠI ---');

  // Đảm bảo các kiểu ENUM và Bảng phát sinh mới luôn tồn tại kể cả khi Docker volume vừa được reset
  await clients.consultation.query(`
    DO $$ BEGIN
      CREATE TYPE "EscalationStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    CREATE TABLE IF NOT EXISTS consultation_escalations (
      id UUID NOT NULL PRIMARY KEY,
      thread_id UUID NOT NULL REFERENCES consultation_threads(id) ON DELETE CASCADE ON UPDATE CASCADE,
      reason_code VARCHAR(50) NOT NULL,
      detail VARCHAR(500),
      status "EscalationStatus" NOT NULL DEFAULT 'OPEN',
      raised_by_account_id UUID NOT NULL,
      raised_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      acknowledged_by_account_id UUID,
      acknowledged_at TIMESTAMPTZ(6),
      resolved_by_account_id UUID,
      resolved_at TIMESTAMPTZ(6),
      resolution_note VARCHAR(500),
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS consultation_escalations_thread_id_raised_at_idx ON consultation_escalations(thread_id, raised_at);
    CREATE INDEX IF NOT EXISTS consultation_escalations_status_raised_at_idx ON consultation_escalations(status, raised_at);
  `);

  // Đảm bảo cấu trúc bảng clinic_rooms và các cột phòng khám luôn tồn tại
  await clients.doctor.query(`
    DO $$ BEGIN
      CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'INACTIVE');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    CREATE TABLE IF NOT EXISTS clinic_rooms (
      id UUID NOT NULL PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(150) NOT NULL,
      status "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS clinic_rooms_status_code_idx ON clinic_rooms(status, code);
    ALTER TABLE doctor_availabilities ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES clinic_rooms(id) ON DELETE SET NULL ON UPDATE CASCADE;
    CREATE INDEX IF NOT EXISTS doctor_availabilities_room_id_start_at_end_at_idx ON doctor_availabilities(room_id, start_at, end_at);
  `);

  await clients.appointment.query(`
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS room_id UUID;
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS room_code VARCHAR(50);
    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS room_name_snapshot VARCHAR(150);
    CREATE INDEX IF NOT EXISTS appointments_room_id_start_at_idx ON appointments(room_id, start_at);
    CREATE INDEX IF NOT EXISTS appointments_room_code_start_at_idx ON appointments(room_code, start_at);
    ALTER TABLE slot_holds ADD COLUMN IF NOT EXISTS room_id UUID;
    ALTER TABLE slot_holds ADD COLUMN IF NOT EXISTS room_code VARCHAR(50);
    ALTER TABLE slot_holds ADD COLUMN IF NOT EXISTS room_name VARCHAR(150);
  `);

  await clients.queue.query(`
    ALTER TABLE stage_tickets ADD COLUMN IF NOT EXISTS room_code VARCHAR(50);
    CREATE INDEX IF NOT EXISTS stage_tickets_stage_id_room_code_state_idx ON stage_tickets(stage_id, room_code, state);
  `);

  await clients.consultation.query('TRUNCATE TABLE consultation_escalations, consultation_messages, consultation_assignments, consultation_threads, consultation_outbox CASCADE;');
  await clients.notification.query('TRUNCATE TABLE delivery_attempts, notification_consumed_events, notifications CASCADE;');
  await clients.treatmentPlan.query('TRUNCATE TABLE treatment_plan_versions, treatment_plan_items, treatment_plans, treatment_plan_outbox CASCADE;');
  await clients.prescription.query('TRUNCATE TABLE prescription_items, prescriptions, medication_catalog, prescription_outbox CASCADE;');
  await clients.queue.query('TRUNCATE TABLE call_attempts, stage_tickets, queue_journeys, queue_stages, queue_audit, queue_idempotency, queue_outbox CASCADE;');
  await clients.medicalRecord.query('TRUNCATE TABLE encounter_amendments, external_clinical_references, clinical_service_orders, diagnoses, clinical_notes, vital_signs, encounter_assignments, clinical_encounters, pregnancy_episodes, medical_audit, medical_idempotency, medical_outbox CASCADE;');
  await clients.billing.query('TRUNCATE TABLE credit_approvals, payments, invoice_lines, invoices, billing_audit_logs, billing_idempotency_records, billing_outbox_events CASCADE;');
  await clients.appointment.query('TRUNCATE TABLE appointment_assignment_history, appointment_audit_logs, appointment_idempotency_records, appointment_outbox_events, slot_holds, appointments CASCADE;');
  await clients.patient.query('TRUNCATE TABLE emergency_contacts, patient_audit_logs, idempotency_records, patients CASCADE;');
  await clients.catalog.query('TRUNCATE TABLE medical_service_categories, medical_service_tags, base_prices, medical_services, catalog_tags, service_categories, doctor_rank_surcharges CASCADE;');
  await clients.catalog.query('ALTER TABLE medical_service_categories ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;');
  await clients.receptionist.query('TRUNCATE TABLE admission_status_history, admissions, identity_verifications, reception_audit_logs, reception_cases, reception_idempotency_records, receptionist_profiles, receptionists CASCADE;');
  await clients.doctor.query('TRUNCATE TABLE outbox_events, idempotency_records, audit_records, doctor_availabilities, doctor_schedules, doctor_specialties, doctor_profiles, doctors, specialties, clinic_rooms CASCADE;');
  await clients.auth.query('TRUNCATE TABLE auth_sessions, password_reset_tokens, credentials, account_roles, accounts, roles CASCADE;');
  await clients.auditLog.query('TRUNCATE TABLE audit_entries CASCADE;');
  console.log('✅ Đã dọn sạch dữ liệu cũ trong tất cả các dịch vụ.');

  const passwordHash = await argon2.hash(DEFAULT_PASSWORD);
  const now = new Date();

  // Helper hàm tạo Account trong Auth
  async function createAuthAccount(email, roleCode, customId = null, status = 'ACTIVE', failedLoginCount = 0, lockedUntil = null) {
    const accRes = await clients.auth.query(
      `INSERT INTO accounts (id, email, status, created_at, updated_at)
       VALUES (COALESCE($1, gen_random_uuid()), $2, $3, NOW(), NOW())
       RETURNING id`,
      [customId, email, status]
    );
    const accountId = accRes.rows[0].id;

    await clients.auth.query(
      `INSERT INTO credentials (account_id, password_hash, password_updated_at, failed_login_count, locked_until)
       VALUES ($1, $2, NOW(), $3, $4)`,
      [accountId, passwordHash, failedLoginCount, lockedUntil]
    );

    const roleRes = await clients.auth.query(`SELECT id FROM roles WHERE code = $1`, [roleCode]);
    if (roleRes.rows.length > 0) {
      await clients.auth.query(
        `INSERT INTO account_roles (account_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [accountId, roleRes.rows[0].id]
      );
    }
    return accountId;
  }

  // ============================================================================
  // 1. AUTH ROLES & HỆ THỐNG VAI TRÒ
  // ============================================================================
  console.log('\n--- BƯỚC 1: KHỞI TẠO VAI TRÒ HỆ THỐNG (AUTH ROLES) ---');
  const rolesDef = [
    ['PATIENT', 'Thai phụ / Người bệnh'],
    ['DOCTOR', 'Bác sĩ chuyên khoa'],
    ['RECEPTIONIST', 'Nhân viên lễ tân / Tiếp đón'],
    ['NURSE', 'Y tá / Hộ sinh phòng khám'],
    ['ADMIN', 'Quản trị viên toàn hệ thống'],
  ];
  for (const [code, desc] of rolesDef) {
    await clients.auth.query(
      `INSERT INTO roles (id, code, description) VALUES (gen_random_uuid(), $1, $2)`,
      [code, desc]
    );
  }

  // Tài khoản Admin, Quản lý & Y tá
  const adminAccountId = await createAuthAccount('admin@antam.local', 'ADMIN');
  const managerAccountId = await createAuthAccount('manager@antam.local', 'ADMIN');
  const nurseAccountId = await createAuthAccount('nurse.huong@antam.local', 'NURSE');

  // Tài khoản kiểm thử trạng thái đặc biệt cho quản trị viên (Admin User Management)
  const lockedUntil = new Date(now.getTime() + 60 * 60 * 1000); // Khóa 1 giờ
  const lockedAccountId = await createAuthAccount('test.locked@antam.local', 'PATIENT', null, 'LOCKED', 5, lockedUntil);
  const pendingAccountId = await createAuthAccount('test.pending@antam.local', 'PATIENT', null, 'PENDING_VERIFICATION');
  const disabledAccountId = await createAuthAccount('test.disabled@antam.local', 'DOCTOR', null, 'DISABLED');

  // Token đặt lại mật khẩu mẫu (Password Reset Token)
  const resetTokenHash = sha256('sample-password-reset-token-2026');
  const tokenExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 giờ
  await clients.auth.query(
    `INSERT INTO password_reset_tokens (account_id, token_hash, created_at, expires_at)
     VALUES ($1, $2, NOW(), $3)`,
    [lockedAccountId, resetTokenHash, tokenExpiresAt]
  );

  // Phiên đăng nhập mẫu (Auth Sessions: Active & Revoked)
  const activeSessionTokenHash = sha256('admin-active-session-token');
  const sessionExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 ngày
  await clients.auth.query(
    `INSERT INTO auth_sessions (id, account_id, refresh_token_hash, created_at, expires_at, last_used_at)
     VALUES (gen_random_uuid(), $1, $2, NOW(), $3, NOW())`,
    [adminAccountId, activeSessionTokenHash, sessionExpiresAt]
  );

  const revokedSessionTokenHash = sha256('disabled-revoked-session-token');
  await clients.auth.query(
    `INSERT INTO auth_sessions (id, account_id, refresh_token_hash, created_at, expires_at, revoked_at, revoked_reason)
     VALUES (gen_random_uuid(), $1, $2, NOW() - INTERVAL '1 day', NOW() + INTERVAL '6 days', NOW(), 'Tài khoản bị tạm ngưng bởi quản trị viên')`,
    [disabledAccountId, revokedSessionTokenHash]
  );
  console.log(`✅ Đã tạo Roles, Admin, Tài khoản các trạng thái (ACTIVE, LOCKED, PENDING, DISABLED), Token reset mật khẩu và Sessions.`);

  // ============================================================================
  // 2. CHUYÊN KHOA BÁC SĨ & HẠNG KHÁM & PHỤ PHÍ
  // ============================================================================
  console.log('\n--- BƯỚC 2: KHỞI TẠO DANH MỤC CHUYÊN KHOA & HẠNG BÁC SĨ ---');
  const specialtiesDef = [
    {
      code: 'OBSTETRICS',
      name: 'Sản khoa',
      desc: 'Chăm sóc thai kỳ, quản lý chuyển dạ, đỡ sinh thường và phẫu thuật mổ lấy thai an toàn.',
    },
    {
      code: 'GYNECOLOGY',
      name: 'Phụ khoa',
      desc: 'Khám, chẩn đoán và điều trị bệnh phụ khoa, u xơ, u buồng trứng và tầm soát ung thư cổ tử cung.',
    },
    {
      code: 'PERINATOLOGY',
      name: 'Y học bào thai & Chẩn đoán trước sinh',
      desc: 'Siêu âm hình thái học thai nhi 4D/5D, sàng lọc dị tật bẩm sinh, can thiệp và theo dõi thai kỳ nguy cơ cao.',
    },
    {
      code: 'REPRODUCTIVE_ENDOCRINOLOGY',
      name: 'Hiếm muộn & Hỗ trợ sinh sản',
      desc: 'Khám, tư vấn vô sinh - hiếm muộn, kích thích buồng trứng, bơm tinh trùng (IUI) và thụ tinh ống nghiệm (IVF).',
    },
    {
      code: 'MATERNAL_MEDICINE',
      name: 'Bệnh lý nội khoa thai kỳ',
      desc: 'Quản lý và điều trị bệnh lý nội khoa đi kèm thai kỳ: đái tháo đường thai kỳ, tiền sản giật, tim mạch thai kỳ.',
    },
  ];

  const specialtyMap = {};
  for (const sp of specialtiesDef) {
    const res = await clients.doctor.query(
      `INSERT INTO specialties (id, code, name, description, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE', NOW(), NOW()) RETURNING id`,
      [sp.code, sp.name, sp.desc]
    );
    specialtyMap[sp.code] = res.rows[0].id;
  }

  // Danh mục Hạng bác sĩ trong Doctor Service
  const ranksDef = [
    { code: 'BASIC', name: 'Bác sĩ Sản phụ khoa', exp: 3, surcharge: 0, desc: 'Bác sĩ chuyên khoa khám, tư vấn và theo dõi thai kỳ định kỳ.' },
    { code: 'SPECIALIST_I', name: 'Bác sĩ Chuyên khoa I (CKI)', exp: 6, surcharge: 100000, desc: 'Bác sĩ đào tạo sau đại học CKI, giàu kinh nghiệm khám và xử lý thai kỳ chuyên sâu.' },
    { code: 'SPECIALIST_II', name: 'Bác sĩ Chuyên khoa II (CKII)', exp: 12, surcharge: 200000, desc: 'Bác sĩ CKI, chuyên gia đầu ngành trong phẫu thuật sản phụ khoa và chẩn đoán trước sinh.' },
    { code: 'MASTER', name: 'Thạc sĩ Bác sĩ', exp: 8, surcharge: 150000, desc: 'Thạc sĩ Sản phụ khoa, cập nhật các phác đồ y khoa hiện đại chuẩn quốc tế.' },
    { code: 'ASSOC_PROFESSOR', name: 'Phó Giáo sư, Tiến sĩ Bác sĩ', exp: 18, surcharge: 350000, desc: 'Phó Giáo sư đầu ngành, chuyên gia cố vấn cho các ca thai kỳ phức tạp.' },
    { code: 'PROFESSOR', name: 'Giáo sư, Tiến sĩ Bác sĩ', exp: 22, surcharge: 500000, desc: 'Giáo sư Sản phụ khoa, hội chẩn liên viện và điều trị bệnh lý nặng.' },
    { code: 'EXPERT', name: 'Chuyên gia Cố vấn Cao cấp', exp: 20, surcharge: 400000, desc: 'Chuyên gia cố vấn chuyên môn độc lập nhiều năm kinh nghiệm tại các bệnh viện tuyến TW.' },
    { code: 'HEAD_DOCTOR', name: 'Trưởng khoa / Chuyên gia cao cấp', exp: 15, surcharge: 250000, desc: 'Trưởng khoa lâm sàng, quản lý chuyên môn và trực tiếp phụ trách các ca khó.' },
  ];

  const rankSurchargeMap = {};
  for (const r of ranksDef) {
    // Phụ phí hạng bác sĩ trong Catalog Service
    const scRes = await clients.catalog.query(
      `INSERT INTO doctor_rank_surcharges (id, rank_code, amount_minor, currency, effective_from, status, version, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'VND', NOW(), 'ACTIVE', 1, NOW(), NOW()) RETURNING id`,
      [r.code, r.surcharge]
    );
    rankSurchargeMap[r.code] = { id: scRes.rows[0].id, amount: r.surcharge };
  }

  // Phụ phí hạng bác sĩ đặc biệt: SCHEDULED (dự kiến áp dụng đầu tháng sau), CANCELLED (hủy bỏ) và EXPIRED (hết hạn)
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthSurchargeDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  await clients.catalog.query(
    `INSERT INTO doctor_rank_surcharges (id, rank_code, amount_minor, currency, effective_from, status, version, created_at, updated_at)
     VALUES (gen_random_uuid(), 'ASSOC_PROFESSOR', 400000, 'VND', $1, 'SCHEDULED', 1, NOW(), NOW())`,
    [nextMonthSurchargeDate]
  );
  await clients.catalog.query(
    `INSERT INTO doctor_rank_surcharges (id, rank_code, amount_minor, currency, effective_from, status, version, created_at, updated_at)
     VALUES (gen_random_uuid(), 'BASIC', 50000, 'VND', NOW(), 'CANCELLED', 1, NOW(), NOW())`
  );
  await clients.catalog.query(
    `INSERT INTO doctor_rank_surcharges (id, rank_code, amount_minor, currency, effective_from, effective_to, status, version, created_at, updated_at)
     VALUES (gen_random_uuid(), 'HEAD_DOCTOR', 200000, 'VND', $1, $2, 'EXPIRED', 1, $1, $2)`,
    [oneYearAgo, startOfThisMonth]
  );
  console.log(`✅ Đã khởi tạo 5 Chuyên khoa và 8 Hạng Bác sĩ kèm Biểu phí phụ thu (ACTIVE, SCHEDULED, CANCELLED, EXPIRED).`);

  // ============================================================================
  // 3. DANH MỤC DỊCH VỤ, PHÂN LOẠI & GIÁ DỊCH VỤ (CATALOG SERVICE)
  // ============================================================================
  console.log('\n--- BƯỚC 3: KHỞI TẠO DANH MỤC DỊCH VỤ Y TẾ & BẢNG GIÁ (CATALOG) ---');
  const categoriesDef = [
    { code: 'PRENATAL', slug: 'kham-theo-doi-thai-ky', name: 'Khám & Theo dõi Thai kỳ', desc: 'Các gói khám thai định kỳ theo từng mốc phát triển quan trọng của thai nhi.', sort: 1 },
    { code: 'ULTRASOUND', slug: 'sieu-am-san-phu-khoa', name: 'Siêu âm Sản Phụ khoa Chẩn đoán', desc: 'Siêu âm 2D, Doppler màu, siêu âm 4D/5D hình thái học thai nhi độ phân giải cao.', sort: 2 },
    { code: 'TESTING', slug: 'xet-nghiem-sang-loc-truoc-sinh', name: 'Xét nghiệm Sàng lọc Trước sinh', desc: 'Sàng lọc dị tật không xâm lấn NIPT, Double test, Triple test, nghiệm pháp tiểu đường thai kỳ.', sort: 3 },
    { code: 'GYNECOLOGY', slug: 'kham-dieu-tri-phu-khoa', name: 'Khám & Điều trị Phụ khoa', desc: 'Khám phụ khoa tổng quát, soi cổ tử cung, tầm soát ung thư phụ khoa.', sort: 4 },
    { code: 'PACKAGES', slug: 'goi-thai-san-tron-goi', name: 'Gói Chăm sóc Thai sản Trọn gói', desc: 'Gói chăm sóc toàn diện từ tuần thai đầu tiên đến khi sinh nở và sau sinh.', sort: 5 },
    { code: 'POSTPARTUM', slug: 'cham-soc-sau-sinh', name: 'Chăm sóc Mẹ & Bé Sau sinh', desc: 'Khám phục hồi sàn chậu, thông tắc tia sữa, tư vấn dinh dưỡng mẹ cho con bú.', sort: 6 },
  ];

  const categoryMap = {};
  for (const c of categoriesDef) {
    const res = await clients.catalog.query(
      `INSERT INTO service_categories (id, code, slug, name, description, status, sort_order, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ACTIVE', $5, NOW(), NOW()) RETURNING id`,
      [c.code, c.slug, c.name, c.desc, c.sort]
    );
    categoryMap[c.code] = res.rows[0].id;
  }

  // Danh mục phân cấp cha - con (Subcategories có parent_id) & Danh mục DRAFT
  const subCategoriesDef = [
    { code: 'PRENATAL_ROUTINE_CAT', slug: 'kham-thai-dinh-ky-co-ban', name: 'Khám thai định kỳ cơ bản', parentCode: 'PRENATAL', status: 'ACTIVE', sort: 11 },
    { code: 'PRENATAL_HIGH_RISK_CAT', slug: 'quan-ly-thai-ky-nguy-co-cao', name: 'Quản lý thai kỳ nguy cơ cao', parentCode: 'PRENATAL', status: 'ACTIVE', sort: 12 },
    { code: 'PRENATAL_WELLNESS', slug: 'dinh-duong-yoga-tien-san', name: 'Dinh dưỡng & Tiền sản nâng cao', parentCode: null, status: 'DRAFT', sort: 13 },
  ];
  for (const sc of subCategoriesDef) {
    const parentId = sc.parentCode ? categoryMap[sc.parentCode] : null;
    const res = await clients.catalog.query(
      `INSERT INTO service_categories (id, code, slug, name, description, parent_id, status, sort_order, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
      [sc.code, sc.slug, sc.name, parentId, sc.status, sc.sort]
    );
    categoryMap[sc.code] = res.rows[0].id;
  }

  const tagsDef = [
    { code: 'TRIMESTER_1', slug: 'tam-ca-nguyet-1', name: '3 tháng đầu (0-13 tuần)', group: 'AUDIENCE', sort: 1 },
    { code: 'TRIMESTER_2', slug: 'tam-ca-nguyet-2', name: '3 tháng giữa (14-27 tuần)', group: 'AUDIENCE', sort: 2 },
    { code: 'TRIMESTER_3', slug: 'tam-ca-nguyet-3', name: '3 tháng cuối (28-40 tuần)', group: 'AUDIENCE', sort: 3 },
    { code: 'HIGH_RISK', slug: 'thai-ky-nguy-co-cao', name: 'Thai kỳ nguy cơ cao', group: 'FEATURE', sort: 4 },
    { code: 'ROUTINE', slug: 'kham-dinh-ky', name: 'Khám định kỳ', group: 'LABEL', sort: 5 },
    { code: 'POPULAR', slug: 'dich-vu-noi-bat', name: 'Dịch vụ nổi bật', group: 'LABEL', sort: 6 },
    { code: 'FEMALE_CARE', slug: 'cham-soc-nu-gioi', name: 'Chăm sóc Nữ giới & Thai phụ', group: 'GENDER', sort: 7 },
    { code: 'REPRODUCTIVE_AGE', slug: 'do-tuoi-sinh-san', name: 'Độ tuổi sinh sản 18-45', group: 'AGE', sort: 8 },
  ];

  const tagMap = {};
  for (const t of tagsDef) {
    const res = await clients.catalog.query(
      `INSERT INTO catalog_tags (id, code, slug, name, "group", description, status, sort_order, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $3, 'ACTIVE', $5, NOW(), NOW()) RETURNING id`,
      [t.code, t.slug, t.name, t.group, t.sort]
    );
    tagMap[t.code] = res.rows[0].id;
  }

  // Danh mục 12 Dịch vụ Y tế Hoàn chỉnh
  const servicesDef = [
    {
      code: 'PRENATAL_ROUTINE',
      slug: 'kham-thai-dinh-ky-chuan-y-khoa',
      name: 'Khám thai định kỳ chuẩn y khoa',
      summary: 'Theo dõi sự phát triển toàn diện của thai nhi, kiểm tra huyết áp mẹ, đo tim thai và chỉ số phát triển.',
      description: 'Gói khám định kỳ chuẩn bao gồm: Đo chỉ số sinh hiệu (huyết áp, nhịp tim, cân nặng thai phụ), đo chiều cao tử cung, vòng bụng, nghe tim thai Doppler, tư vấn chế độ dinh dưỡng và lối sống lành mạnh cho thai kỳ.',
      kind: 'CONSULTATION',
      specialtyCode: 'OBSTETRICS',
      thumbnailUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1200&q=85',
      duration: 30,
      policy: 'RANK_UPGRADE_ALLOWED',
      price: 300000,
      categoryCode: 'PRENATAL',
      tagCodes: ['ROUTINE', 'POPULAR', 'TRIMESTER_1', 'TRIMESTER_2', 'TRIMESTER_3'],
    },
    {
      code: 'PRENATAL_VIP',
      slug: 'kham-thai-chuyen-gia-tu-van-dinh-duong',
      name: 'Khám thai chuyên gia & tư vấn dinh dưỡng cá thể hóa',
      summary: 'Khám và tư vấn chuyên sâu cùng Trưởng/Phó khoa Sản, xây dựng phác đồ dinh dưỡng và vận động riêng biệt.',
      description: 'Dành riêng cho thai phụ mong muốn được theo dõi sát sao bởi các Bác sĩ Trưởng khoa/Chuyên gia cao cấp. Đánh giá chi tiết nguy cơ tiền sản giật, đái tháo đường, bất đồng nhóm máu và lập hồ sơ quản lý thai nghén riêng biệt.',
      kind: 'CONSULTATION',
      specialtyCode: 'OBSTETRICS',
      thumbnailUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=85',
      duration: 45,
      policy: 'RANK_UPGRADE_ALLOWED',
      price: 500000,
      categoryCode: 'PRENATAL',
      tagCodes: ['HIGH_RISK', 'POPULAR'],
    },
    {
      code: 'US_2D',
      slug: 'sieu-am-thai-2d-tieu-chuan',
      name: 'Siêu âm thai 2D kiểm tra tim thai & độ dài túi ối',
      summary: 'Kiểm tra vị trí thai, tuổi thai, nhịp tim thai và lượng nước ối.',
      description: 'Phương pháp siêu âm nền tảng giúp xác định thai làm tổ trong buồng tử cung, phát hiện sớm dấu hiệu tim thai từ tuần thứ 6 và đo lường sự phát triển cơ bản của thai nhi.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'OBSTETRICS',
      thumbnailUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=85',
      duration: 20,
      policy: 'NOT_REQUIRED',
      price: 200000,
      categoryCode: 'ULTRASOUND',
      tagCodes: ['TRIMESTER_1', 'ROUTINE'],
    },
    {
      code: 'US_4D_5D',
      slug: 'sieu-am-hinh-thai-thai-nhi-4d-5d-hd-live',
      name: 'Siêu âm hình thái thai nhi 4D/5D Doppler màu HD-Live',
      summary: 'Quan sát rõ nét từng chi tiết gương mặt, tay chân, cột sống, tim mạch và khảo sát dị tật hình thái học.',
      description: 'Ứng dụng công nghệ siêu âm GE Voluson Expert tân tiến nhất, tái tạo hình ảnh màu da thực tế HD-Live và khảo sát chi tiết cấu trúc giải phẫu thai nhi: hộp sọ, não thất, vòm họng, buồng tim, thận, bàng quang và chi thể.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'PERINATOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1200&q=85',
      duration: 35,
      policy: 'NOT_REQUIRED',
      price: 450000,
      categoryCode: 'ULTRASOUND',
      tagCodes: ['TRIMESTER_2', 'POPULAR'],
    },
    {
      code: 'NIPT_BASIC',
      slug: 'sang-loc-di-tat-truoc-sinh-nipt-basic',
      name: 'Sàng lọc dị tật không xâm lấn NIPT - 3 cặp NST (21, 18, 13)',
      summary: 'Phát hiện sớm hội chứng Down, Edwards, Patau từ tuần thứ 9 của thai kỳ với độ chính xác > 99.9%.',
      description: 'Phân tích ADN tự do của thai nhi trong máu mẹ bằng công nghệ giải trình tự gen thế hệ mới NGS. An toàn tuyệt đối cho mẹ và bé, không xâm lấn, giảm tối đa chỉ định chọc ối không cần thiết.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'PERINATOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1579684453423-f84349ef60b0?auto=format&fit=crop&w=1200&q=85',
      duration: 20,
      policy: 'NOT_REQUIRED',
      price: 2500000,
      categoryCode: 'TESTING',
      tagCodes: ['TRIMESTER_1', 'POPULAR'],
    },
    {
      code: 'NIPT_PRO',
      slug: 'sang-loc-di-tat-truoc-sinh-nipt-pro-toan-dien',
      name: 'Sàng lọc NIPT Pro - Toàn bộ 23 cặp NST & vi mất đoạn',
      summary: 'Khảo sát toàn diện 23 cặp nhiễm sắc thể, đột biến số lượng NST giới tính (Turner, Klinefelter) và 86 hội chứng vi mất đoạn.',
      description: 'Gói sàng lọc di truyền cao cấp nhất hiện nay. Bảo hiểm kết quả đến 500 triệu đồng và hỗ trợ chi phí chọc ối, miễn phí xét nghiệm chẩn đoán nếu phát hiện nguy cơ cao.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'PERINATOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=85',
      duration: 25,
      policy: 'NOT_REQUIRED',
      price: 5500000,
      categoryCode: 'TESTING',
      tagCodes: ['TRIMESTER_1', 'HIGH_RISK'],
    },
    {
      code: 'DOUBLE_TEST',
      slug: 'xet-nghiem-double-test-sang-loc-quy-1',
      name: 'Xét nghiệm Double Test sàng lọc quý 1',
      summary: 'Định lượng β-hCG tự do và PAPP-A kết hợp đo độ mờ da gáy tuần 11 - 13 tuần 6 ngày.',
      description: 'Phương pháp sàng lọc sinh hóa quy chuẩn của Bộ Y Tế nhằm đánh giá nguy cơ thai nhi mắc các hội chứng rối loạn nhiễm sắc thể phổ biến.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'PERINATOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1516822003754-cca485356ecb?auto=format&fit=crop&w=1200&q=85',
      duration: 15,
      policy: 'NOT_REQUIRED',
      price: 450000,
      categoryCode: 'TESTING',
      tagCodes: ['TRIMESTER_1', 'ROUTINE'],
    },
    {
      code: 'TRIPLE_TEST',
      slug: 'xet-nghiem-triple-test-sang-loc-quy-2',
      name: 'Xét nghiệm Triple Test sàng lọc quý 2',
      summary: 'Định lượng AFP, hCG và uE3 trong máu mẹ từ tuần 15 đến 20 để sàng lọc dị tật ống thần kinh.',
      description: 'Đánh giá nguy cơ dị tật khuyết tật ống thần kinh hở (chẻ đôi đốt sống, vô sọ) và các bất thường NST trong giai đoạn tam cá nguyệt thứ 2.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'PERINATOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1581595220892-b0739db3ba8c?auto=format&fit=crop&w=1200&q=85',
      duration: 15,
      policy: 'NOT_REQUIRED',
      price: 500000,
      categoryCode: 'TESTING',
      tagCodes: ['TRIMESTER_2'],
    },
    {
      code: 'OGTT_DIABETES',
      slug: 'nghiem-phap-dung-nap-glucose-tam-soat-tieu-duong',
      name: 'Nghiệm pháp dung nạp Glucose tầm soát đái tháo đường thai kỳ',
      summary: 'Uống 75g đường và xét nghiệm máu 3 lần (lúc đói, sau 1h, sau 2h) vào tuần 24 - 28.',
      description: 'Tiêu chuẩn vàng chẩn đoán sớm đái tháo đường thai kỳ theo hướng dẫn quốc tế (IADPSG/WHO), phòng tránh nguy cơ đa ối, thai to, suy hô hấp sơ sinh và tiền sản giật.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'MATERNAL_MEDICINE',
      thumbnailUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=85',
      duration: 120,
      policy: 'NOT_REQUIRED',
      price: 350000,
      categoryCode: 'TESTING',
      tagCodes: ['TRIMESTER_2', 'ROUTINE'],
    },
    {
      code: 'GYN_STANDARD',
      slug: 'kham-phu-khoa-tong-quat-soi-co-tu-cung',
      name: 'Khám phụ khoa tổng quát & Soi cổ tử cung kỹ thuật số',
      summary: 'Kiểm tra cơ quan sinh dục ngoài, âm đạo, cổ tử cung, soi máy kỹ thuật số độ phóng đại cao.',
      description: 'Tầm soát viêm nhiễm, lộ tuyến cổ tử cung, polyp và các tổn thương tiền ung thư. Tư vấn phác đồ điều trị an toàn cho phụ nữ đang chuẩn bị mang thai hoặc sau sinh.',
      kind: 'CONSULTATION',
      specialtyCode: 'GYNECOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=1200&q=85',
      duration: 30,
      policy: 'RANK_UPGRADE_ALLOWED',
      price: 350000,
      categoryCode: 'GYNECOLOGY',
      tagCodes: ['ROUTINE'],
    },
    {
      code: 'PACKAGE_BIRTH_STANDARD',
      slug: 'goi-sinh-con-thuong-tron-goi-hanh-phuc',
      name: 'Gói sinh con thường trọn gói Hạnh Phúc',
      summary: 'Theo dõi chuyển dạ bằng Monitoring tim thai liên tục, giảm đau sản khoa và chăm sóc mẹ bé 2 ngày tại viện.',
      description: 'Bao gồm: Kíp bác sĩ Sản khoa và hộ sinh đỡ đẻ; gây tê ngoài màng cứng giảm đau; phòng lưu viện tiêu chuẩn; tiêm vitamin K1 và vắc xin Viêm gan B cho bé; tắm bé và chăm sóc vết khâu tầng sinh môn.',
      kind: 'PACKAGE',
      specialtyCode: 'OBSTETRICS',
      thumbnailUrl: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=85',
      duration: 120,
      policy: 'NOT_REQUIRED',
      price: 18000000,
      categoryCode: 'PACKAGES',
      tagCodes: ['POPULAR'],
    },
    {
      code: 'PACKAGE_BIRTH_SURGERY',
      slug: 'goi-sinh-mo-chu-dong-tron-goi-binh-an',
      name: 'Gói sinh mổ chủ động trọn gói Bình An',
      summary: 'Kíp mổ chuyên gia, phòng mổ vô khuẩn một chiều, giảm đau đa tầng và lưu viện 4 ngày phòng riêng cao cấp.',
      description: 'Áp dụng cho các trường hợp mổ chỉ định hoặc mổ chủ động theo nguyện vọng. Kỹ thuật mổ thẩm mỹ đường rạch nhỏ, khâu chỉ tự tiêu thẩm mỹ, chăm sóc toàn diện 24/7.',
      kind: 'PACKAGE',
      specialtyCode: 'OBSTETRICS',
      thumbnailUrl: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1200&q=85',
      duration: 150,
      policy: 'NOT_REQUIRED',
      price: 28000000,
      categoryCode: 'PACKAGES',
      tagCodes: ['POPULAR'],
    },
    // Thủ thuật y khoa (PROCEDURE) & Chính sách BASIC_INCLUDED
    {
      code: 'IUI_PROCEDURE',
      slug: 'bom-tinh-trung-vao-buong-tu-cung-iui',
      name: 'Thủ thuật bơm tinh trùng vào buồng tử cung (IUI)',
      summary: 'Kỹ thuật hỗ trợ sinh sản hiện đại, lọc rửa tinh trùng và bơm trực tiếp vào buồng tử cung.',
      description: 'Phương pháp hỗ trợ sinh sản đầu tay an toàn, hiệu quả cho các cặp vợ chồng hiếm muộn, chuẩn bị noãn và tinh trùng tối ưu trước khi thực hiện.',
      kind: 'PROCEDURE',
      specialtyCode: 'REPRODUCTIVE_ENDOCRINOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=85',
      duration: 45,
      policy: 'BASIC_INCLUDED',
      price: 4500000,
      categoryCode: 'PACKAGES',
      tagCodes: ['POPULAR', 'FEMALE_CARE'],
      status: 'ACTIVE',
    },
    // Tiêm chủng vắc xin thai kỳ (VACCINATION)
    {
      code: 'VAC_TETANUS',
      slug: 'tiem-phong-uon-van-thai-ky-vat',
      name: 'Tiêm phòng vắc xin Uốn ván thai kỳ (VAT)',
      summary: 'Vắc xin phòng ngừa uốn ván sơ sinh cho mẹ và con khi sinh nở, thực hiện từ tuần 20 trở đi.',
      description: 'Tiêm bắp sâu vắc xin giải độc tố uốn ván hấp phụ VAT. Khám sàng lọc trước tiêm và theo dõi phản ứng sau tiêm 30 phút tại phòng tiêm chủng.',
      kind: 'VACCINATION',
      specialtyCode: 'OBSTETRICS',
      thumbnailUrl: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=85',
      duration: 15,
      policy: 'NOT_REQUIRED',
      price: 150000,
      categoryCode: 'PRENATAL',
      tagCodes: ['ROUTINE', 'TRIMESTER_2', 'TRIMESTER_3'],
      status: 'ACTIVE',
    },
    // Tư vấn chuyên sâu khác (OTHER)
    {
      code: 'GENETIC_COUNSELING',
      slug: 'tu-van-di-truyen-tien-hon-nhan-va-truoc-sinh',
      name: 'Tư vấn di truyền trước sinh & Tiền hôn nhân',
      summary: 'Tư vấn phả hệ, phân tích nguy cơ dị tật thai kỳ và giải thích kết quả xét nghiệm di truyền.',
      description: 'Bác sĩ chuyên gia di truyền phân tích tiền sử gia đình, đánh giá nguy cơ đột biến gen, lệch bội nhiễm sắc thể và định hướng các xét nghiệm chẩn đoán xác định.',
      kind: 'OTHER',
      specialtyCode: 'PERINATOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=85',
      duration: 45,
      policy: 'RANK_UPGRADE_ALLOWED',
      price: 600000,
      categoryCode: 'TESTING',
      tagCodes: ['HIGH_RISK', 'REPRODUCTIVE_AGE'],
      status: 'ACTIVE',
    },
    // Dịch vụ tạm ngưng (INACTIVE) do hiệu chuẩn thiết bị
    {
      code: 'US_DOPPLER_TWINS',
      slug: 'sieu-am-doppler-song-thai-chuyen-sau',
      name: 'Siêu âm Doppler song thai & Đa thai chuyên sâu',
      summary: 'Tạm ngưng nhận lịch hẹn trực tuyến do thiết bị đang trong kỳ hiệu chuẩn y tế định kỳ.',
      description: 'Đánh giá chi tiết tuần hoàn hai thai, hội chứng truyền máu song thai (TTTS). Dịch vụ tạm dừng tiếp nhận hẹn mới trên hệ thống.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'PERINATOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=85',
      duration: 40,
      policy: 'NOT_REQUIRED',
      price: 650000,
      categoryCode: 'ULTRASOUND',
      tagCodes: ['HIGH_RISK'],
      status: 'INACTIVE',
      bookingEnabled: false,
    },
    // Dịch vụ đang dự thảo (DRAFT)
    {
      code: 'PACKAGE_STEM_CELL',
      slug: 'goi-thu-thap-va-luu-tru-te-bao-goc-cuong-ron',
      name: 'Gói thu thập & Lưu trữ Tế bào gốc Máu cuống rốn',
      summary: 'Bảo hiểm sinh học tương lai cho trẻ sơ sinh, hợp tác cùng ngân hàng tế bào gốc quốc tế.',
      description: 'Dịch vụ đang trong giai đoạn soạn thảo quy trình kỹ thuật và chính sách giá, chuẩn bị ra mắt vào quý tới.',
      kind: 'PACKAGE',
      specialtyCode: 'OBSTETRICS',
      thumbnailUrl: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1200&q=85',
      duration: 60,
      policy: 'NOT_REQUIRED',
      price: 35000000,
      categoryCode: 'PACKAGES',
      tagCodes: ['POPULAR'],
      status: 'DRAFT',
      bookingEnabled: false,
    },
    // Dịch vụ cũ đã lưu trữ (ARCHIVED)
    {
      code: 'OLD_COVID_SCREENING',
      slug: 'xet-nghiem-nhanh-sars-cov-2-tien-phau',
      name: 'Xét nghiệm nhanh kháng nguyên SARS-CoV-2 tiền phẫu',
      summary: 'Dịch vụ sàng lọc y tế giai đoạn cũ, hiện đã lưu trữ hồ sơ và ngừng cung cấp.',
      description: 'Quy trình xét nghiệm nhanh Covid-19 phục vụ sàng lọc dịch tễ thời kỳ trước, đã lưu trữ.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'MATERNAL_MEDICINE',
      thumbnailUrl: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=85',
      duration: 15,
      policy: 'NOT_REQUIRED',
      price: 100000,
      categoryCode: 'TESTING',
      tagCodes: [],
      status: 'ARCHIVED',
      bookingEnabled: false,
    },
  ];

  const serviceMap = {};
  for (const s of servicesDef) {
    const specialtyId = specialtyMap[s.specialtyCode] || null;
    const svcStatus = s.status || 'ACTIVE';
    const bookingEnabled = s.bookingEnabled !== undefined ? s.bookingEnabled : true;
    const publishedAt = svcStatus === 'DRAFT' ? null : now;

    const sRes = await clients.catalog.query(
      `INSERT INTO medical_services (id, code, slug, name, summary, description, kind, specialty_id, thumbnail_url, duration_minutes, booking_enabled, doctor_rank_selection_policy, status, version, published_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, $13, NOW(), NOW()) RETURNING id`,
      [s.code, s.slug, s.name, s.summary, s.description, s.kind, specialtyId, s.thumbnailUrl, s.duration, bookingEnabled, s.policy, svcStatus, publishedAt]
    );
    const serviceId = sRes.rows[0].id;

    // Giá cơ bản (BasePrice)
    const bpRes = await clients.catalog.query(
      `INSERT INTO base_prices (id, medical_service_id, amount_minor, currency, effective_from, status, version, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'VND', NOW(), 'ACTIVE', 1, NOW(), NOW()) RETURNING id`,
      [serviceId, s.price]
    );

    // Gắn danh mục chính (Primary Category)
    if (categoryMap[s.categoryCode]) {
      await clients.catalog.query(
        `INSERT INTO medical_service_categories (medical_service_id, category_id, is_primary, created_at)
         VALUES ($1, $2, true, NOW())`,
        [serviceId, categoryMap[s.categoryCode]]
      );
    }

    // Gắn thẻ (tags)
    for (const tagCode of s.tagCodes) {
      if (tagMap[tagCode]) {
        await clients.catalog.query(
          `INSERT INTO medical_service_tags (medical_service_id, tag_id, created_at)
           VALUES ($1, $2, NOW())`,
          [serviceId, tagMap[tagCode]]
        );
      }
    }

    serviceMap[s.code] = { id: serviceId, priceId: bpRes.rows[0].id, price: s.price, name: s.name, specialtyId };
  }

  // Gắn danh mục phụ (Secondary categories: is_primary = false)
  if (serviceMap['PRENATAL_VIP'] && categoryMap['PACKAGES']) {
    await clients.catalog.query(
      `INSERT INTO medical_service_categories (medical_service_id, category_id, is_primary, created_at)
       VALUES ($1, $2, false, NOW()) ON CONFLICT DO NOTHING`,
      [serviceMap['PRENATAL_VIP'].id, categoryMap['PACKAGES']]
    );
  }
  if (serviceMap['US_4D_5D'] && categoryMap['PRENATAL']) {
    await clients.catalog.query(
      `INSERT INTO medical_service_categories (medical_service_id, category_id, is_primary, created_at)
       VALUES ($1, $2, false, NOW()) ON CONFLICT DO NOTHING`,
      [serviceMap['US_4D_5D'].id, categoryMap['PRENATAL']]
    );
  }

  // Bổ sung các bản ghi BasePrice với trạng thái EXPIRED, SCHEDULED, CANCELLED
  const routineServiceId = serviceMap['PRENATAL_ROUTINE'].id;
  const vipServiceId = serviceMap['PRENATAL_VIP'].id;
  const niptServiceId = serviceMap['NIPT_BASIC'].id;

  // 1. Giá cũ EXPIRED của Khám thai định kỳ (250.000đ áp dụng từ 1 năm trước đến đầu tháng này)
  await clients.catalog.query(
    `INSERT INTO base_prices (id, medical_service_id, amount_minor, currency, effective_from, effective_to, status, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 250000, 'VND', $2, $3, 'EXPIRED', 1, $2, $3)`,
    [routineServiceId, oneYearAgo, startOfThisMonth]
  );

  // 2. Giá mới SCHEDULED của Khám thai VIP (550.000đ áp dụng từ đầu tháng tới)
  const nextMonthPriceDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  await clients.catalog.query(
    `INSERT INTO base_prices (id, medical_service_id, amount_minor, currency, effective_from, effective_to, status, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 550000, 'VND', $2, NULL, 'SCHEDULED', 1, NOW(), NOW())`,
    [vipServiceId, nextMonthPriceDate]
  );

  // 3. Giá bị CANCELLED của NIPT Basic (dự thảo giá bị hủy bỏ)
  await clients.catalog.query(
    `INSERT INTO base_prices (id, medical_service_id, amount_minor, currency, effective_from, effective_to, status, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 2900000, 'VND', NOW(), NULL, 'CANCELLED', 1, NOW(), NOW())`,
    [niptServiceId]
  );

  console.log(`✅ Đã khởi tạo 18 Dịch vụ Y tế (Tất cả Kinds & Statuses), Danh mục phân cấp, Thẻ, Bảng giá đa trạng thái (ACTIVE, EXPIRED, SCHEDULED, CANCELLED).`);

  // ============================================================================
  // 4. KHU VỰC & CÁC BƯỚC ĐIỀU PHỐI HÀNG ĐỢI (QUEUE STAGES)
  // ============================================================================
  console.log('\n--- BƯỚC 4: KHỞI TẠO CÁC CHẶNG HÀNG ĐỢI PHÒNG KHÁM (QUEUE STAGES) ---');
  const queueStagesDef = [
    { code: 'RECEPTION', name: 'Tiếp đón & Đăng ký khám', roomCode: 'P.101' },
    { code: 'VITALS', name: 'Đo sinh hiệu & Tiền sàng lọc', roomCode: 'P.102' },
    { code: 'CONSULTATION', name: 'Phòng khám Bác sĩ Chuyên khoa', roomCode: 'P.201' },
    { code: 'ULTRASOUND', name: 'Phòng Siêu âm Chẩn đoán', roomCode: 'P.301' },
    { code: 'LAB_SAMPLE', name: 'Phòng Lấy mẫu Xét nghiệm', roomCode: 'P.105' },
    { code: 'PROCEDURE', name: 'Phòng Thủ thuật & Can thiệp Sản khoa', roomCode: 'P.401' },
    { code: 'IMMUNIZATION', name: 'Phòng Tiêm chủng Vắc xin Thai kỳ', roomCode: 'P.108' },
    { code: 'PHARMACY', name: 'Nhà thuốc & Cấp phát thuốc', roomCode: 'P.109' },
  ];

  const stageMap = {};
  for (const st of queueStagesDef) {
    const res = await clients.queue.query(
      `INSERT INTO queue_stages (id, code, name, active, room_code, created_at)
       VALUES (gen_random_uuid(), $1, $2, true, $3, NOW()) RETURNING id`,
      [st.code, st.name, st.roomCode]
    );
    stageMap[st.code] = res.rows[0].id;
  }
  console.log(`✅ Đã khởi tạo 8 Khu vực hàng đợi (Queue Stages).`);

  // ============================================================================
  // 5. DANH MỤC THUỐC THAI KỲ & CẢNH BÁO AN TOÀN (MEDICATION CATALOG)
  // ============================================================================
  console.log('\n--- BƯỚC 5: KHỞI TẠO DANH MỤC THUỐC AN TOÀN THAI KỲ (PRESCRIPTION) ---');
  const medicationsDef = [
    {
      code: 'MED_FOLIC_400',
      name: 'Axit Folic 400mcg (Folio Forte)',
      ingredient: 'Acid Folic + Iodine + Vitamin D3',
      strength: '400 mcg',
      dosageForm: 'Viên nén',
      route: 'Uống',
      dose: '1 viên',
      freq: '1 lần/ngày',
      instruction: 'Uống sau bữa ăn sáng với nhiều nước, duy trì suốt 3 tháng đầu thai kỳ.',
      category: 'CATEGORY_A',
      warning: 'An toàn tuyệt đối cho thai phụ, phòng ngừa dị tật ống thần kinh thai nhi.',
    },
    {
      code: 'MED_IRON_FEMAT',
      name: 'Sắt hữu cơ Polymaltose (Femat)',
      ingredient: 'Sắt (III) Hydroxide Polymaltose Complex',
      strength: '50 mg',
      dosageForm: 'Viên nang mềm',
      route: 'Uống',
      dose: '1 viên',
      freq: '1 lần/ngày',
      instruction: 'Uống trước bữa ăn 30 phút hoặc 2 giờ sau ăn, không uống cùng sữa hoặc canxi.',
      category: 'CATEGORY_A',
      warning: 'Thuốc sắt hữu cơ ít gây táo bón, dùng phòng ngừa và điều trị thiếu máu thiếu sắt thai kỳ.',
    },
    {
      code: 'MED_CALCIUM_CORBIERE',
      name: 'Canxi Corbiere Sanofi 5ml',
      ingredient: 'Calcium glucoheptonate + Nicotinamide + Vitamin C',
      strength: '552.5 mg/5ml',
      dosageForm: 'Dung dịch uống ống bẻ',
      route: 'Uống',
      dose: '1 ống (5ml)',
      freq: '2 lần/ngày',
      instruction: 'Bẻ ống uống trực tiếp sau ăn sáng và ăn trưa. Tránh uống vào buổi tối.',
      category: 'CATEGORY_A',
      warning: 'Cung cấp canxi phát triển khung xương thai nhi và phòng loãng xương mẹ.',
    },
    {
      code: 'MED_DHA_PRENATAL',
      name: 'Bio Island DHA for Pregnancy 210mg',
      ingredient: 'Docosahexaenoic Acid (DHA) tinh khiết từ vi tảo Schizochytrium',
      strength: '210 mg',
      dosageForm: 'Viên nang mềm',
      route: 'Uống',
      dose: '1 viên',
      freq: '1 lần/ngày',
      instruction: 'Uống ngay trong hoặc ngay sau bữa ăn có chất béo.',
      category: 'CATEGORY_A',
      warning: 'Hỗ trợ phát triển não bộ và thị giác của thai nhi từ tuần thai thứ 12.',
    },
    {
      code: 'MED_PROGESTERONE_200',
      name: 'Utrogestan 200mg (Progesterone vi hạt)',
      ingredient: 'Progesterone tự nhiên dạng vi hạt',
      strength: '200 mg',
      dosageForm: 'Viên nang đặt âm đạo/uống',
      route: 'Đặt âm đạo sâu',
      dose: '1 viên',
      freq: '1-2 lần/ngày',
      instruction: 'Đặt sâu vào âm đạo vào buổi tối trước khi đi ngủ, nằm nghỉ ít nhất 30 phút.',
      category: 'CATEGORY_B',
      warning: 'Chỉ định trong dọa sảy thai, tiền sử sảy thai liên tiếp hoặc dọa sinh non.',
    },
    {
      code: 'MED_PARACETAMOL_500',
      name: 'Paracetamol 500mg Dược Hậu Giang',
      ingredient: 'Paracetamol',
      strength: '500 mg',
      dosageForm: 'Viên nén bao phim',
      route: 'Uống',
      dose: '1 viên',
      freq: 'Khi sốt >= 38.5°C, cách nhau 4-6 giờ',
      instruction: 'Uống với nước đun sôi để nguội. Tối đa không quá 4 viên trong 24 giờ.',
      category: 'CATEGORY_B',
      warning: 'Thuốc hạ sốt và giảm đau được lựa chọn hàng đầu cho phụ nữ có thai.',
    },
    {
      code: 'MED_MAGNE_B6',
      name: 'Magne-B6 Corbiere',
      ingredient: 'Magnesium lactate dihydrate + Pyridoxine hydrochloride (B6)',
      strength: '470mg / 5mg',
      dosageForm: 'Viên bao đường',
      route: 'Uống',
      dose: '1 viên',
      freq: '2 lần/ngày',
      instruction: 'Uống cùng bữa ăn với nhiều nước.',
      category: 'CATEGORY_B',
      warning: 'Hỗ trợ giảm co cứng cơ bắp chân (chuột rút) và căng thẳng thần kinh thai kỳ.',
    },
    {
      code: 'MED_ASPIRIN_81',
      name: 'Aspirin pH8 81mg',
      ingredient: 'Acid Acetylsalicylic',
      strength: '81 mg',
      dosageForm: 'Viên bao tan trong ruột',
      route: 'Uống',
      dose: '1 viên',
      freq: '1 lần/ngày vào buổi tối',
      instruction: 'Uống nguyên viên trước khi ngủ, duy trì từ tuần 12 đến tuần 36 theo chỉ định.',
      category: 'CATEGORY_B',
      warning: 'Liều thấp dự phòng tiền sản giật ở thai phụ có yếu tố nguy cơ cao.',
    },
    // Thuốc CATEGORY_C: Thận trọng, cân nhắc kỹ lợi ích và nguy cơ
    {
      code: 'MED_CLOTRIMAZOLE_100',
      name: 'Canesten 100mg viên đặt phụ khoa',
      ingredient: 'Clotrimazole',
      strength: '100 mg',
      dosageForm: 'Viên nén đặt âm đạo',
      route: 'Đặt âm đạo sâu',
      dose: '1 viên',
      freq: '1 lần/ngày vào buổi tối',
      instruction: 'Đặt sâu vào âm đạo liên tục 6 ngày trước khi đi ngủ. Không dùng dụng cụ thụt rửa.',
      category: 'CATEGORY_C',
      warning: 'Điều trị viêm âm đạo do nấm Candida ở thai phụ 3 tháng giữa và 3 tháng cuối khi có chỉ định bác sĩ.',
    },
    {
      code: 'MED_DEXAMETHASONE_4',
      name: 'Dexamethasone 4mg/1ml Vinphaco',
      ingredient: 'Dexamethasone natri phosphat',
      strength: '4 mg/1ml',
      dosageForm: 'Dung dịch tiêm',
      route: 'Tiêm bắp',
      dose: '6 mg (1.5 ống)',
      freq: 'Mỗi 12 giờ x 4 liều',
      instruction: 'Tiêm bắp sâu theo phác đồ cấp cứu kích thích trưởng thành phổi thai nhi.',
      category: 'CATEGORY_C',
      warning: 'Áp dụng cho thai kỳ nguy cơ dọa sinh non từ tuần 24 đến 34 để kích thích sản xuất surfactant phổi bé.',
    },
    // Thuốc CATEGORY_D: Có bằng chứng nguy cơ đối với thai nhi ở người
    {
      code: 'MED_ENALAPRIL_5',
      name: 'Enalapril Stella 5mg (Hạ áp ức chế men chuyển)',
      ingredient: 'Enalapril maleat',
      strength: '5 mg',
      dosageForm: 'Viên nén',
      route: 'Uống',
      dose: '1 viên',
      freq: '1 lần/ngày',
      instruction: 'Uống buổi sáng. Phải ngừng ngay lập tức và chuyển sang Methyldopa/Labetalol khi phát hiện có thai.',
      category: 'CATEGORY_D',
      warning: 'CẢNH BÁO NGUY HIỂM: Gây thiểu ối, hạ huyết áp sơ sinh, suy thận vô niệu và biến dạng sọ thai nhi.',
    },
    // Thuốc CATEGORY_X: Chống chỉ định tuyệt đối trong thai kỳ (Quái thai)
    {
      code: 'MED_ISOTRETINOIN_10',
      name: 'Acnotin 10mg (Isotretinoin trị mụn nặng)',
      ingredient: 'Isotretinoin',
      strength: '10 mg',
      dosageForm: 'Viên nang mềm',
      route: 'Uống',
      dose: '1 viên',
      freq: '1 lần/ngày',
      instruction: 'CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI CHO PHỤ NỮ MANG THAI HOẶC CHUẨN BỊ MANG THAI.',
      category: 'CATEGORY_X',
      warning: 'ĐỘC TÍNH CỰC CAO: Gây dị tật bẩm sinh nặng nề (não úng thủy, dị tật tim, sọ mặt). Bắt buộc ngừa thai 1 tháng trước và sau dùng thuốc.',
    },
    // Thuốc ngưng lưu hành (isActive = false)
    {
      code: 'MED_RANITIDINE_150',
      name: 'Ranitidine 150mg viên nén (Thu hồi)',
      ingredient: 'Ranitidine hydrochloride',
      strength: '150 mg',
      dosageForm: 'Viên nén bao phim',
      route: 'Uống',
      dose: '1 viên',
      freq: '2 lần/ngày',
      instruction: 'Thuốc đã bị cơ quan quản lý dược phẩm thu hồi lưu hành toàn quốc do nhiễm tạp chất NDMA.',
      category: 'CATEGORY_B',
      warning: 'Thuốc đã bị đình chỉ lưu hành và vô hiệu hóa trên hệ thống dược viện.',
      isActive: false,
    },
  ];

  const medicationMap = {};
  for (const med of medicationsDef) {
    const isActive = med.isActive !== undefined ? med.isActive : true;
    const res = await clients.prescription.query(
      `INSERT INTO medication_catalog (id, code, name, active_ingredient, strength, dosage_form, route, default_dose, default_frequency, default_instruction, pregnancy_category, pregnancy_warning, is_active, version, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, NOW(), NOW()) RETURNING id`,
      [med.code, med.name, med.ingredient, med.strength, med.dosageForm, med.route, med.dose, med.freq, med.instruction, med.category, med.warning, isActive]
    );
    medicationMap[med.code] = { id: res.rows[0].id, ...med };
  }
  console.log(`✅ Đã khởi tạo 13 Thuốc chuẩn Thai kỳ (Đầy đủ cả 5 phân loại FDA: A, B, C, D, X và thuốc ngừng hoạt động).`);

  // ============================================================================
  // 6. ĐỘI NGŨ BÁC SĨ & LỊCH LÀM VIỆC (DOCTORS & SCHEDULES)
  // ============================================================================
  console.log('\n--- BƯỚC 6: KHỞI TẠO PHÒNG KHÁM (CLINIC ROOMS), ĐỘI NGŨ BÁC SĨ & LỊCH KHÁM ---');
  const clinicRoomsDef = [
    { code: 'P.101', name: 'Phòng Tiếp đón & Tư vấn 101', status: 'ACTIVE' },
    { code: 'P.102', name: 'Phòng Đo sinh hiệu & Tiền sàng lọc 102', status: 'ACTIVE' },
    { code: 'P.105', name: 'Phòng Lấy mẫu Xét nghiệm 105', status: 'ACTIVE' },
    { code: 'P.108', name: 'Phòng Tiêm chủng Vắc xin 108', status: 'ACTIVE' },
    { code: 'P.109', name: 'Quầy Dược & Cấp phát thuốc 109', status: 'ACTIVE' },
    { code: 'P.201', name: 'Phòng khám Sản Phụ khoa 201', status: 'ACTIVE' },
    { code: 'P.202', name: 'Phòng khám & Chẩn đoán trước sinh 202', status: 'ACTIVE' },
    { code: 'P.203', name: 'Phòng khám Sản Phụ khoa 203', status: 'ACTIVE' },
    { code: 'P.204', name: 'Phòng khám Y học bào thai 204', status: 'ACTIVE' },
    { code: 'P.205', name: 'Phòng khám Hỗ trợ sinh sản 205', status: 'ACTIVE' },
    { code: 'P.206', name: 'Phòng khám Nội tiết & Bệnh lý thai kỳ 206', status: 'ACTIVE' },
    { code: 'P.207', name: 'Phòng khám Sản Phụ khoa 207', status: 'ACTIVE' },
    { code: 'P.208', name: 'Phòng khám Chuyên gia Cố vấn 208', status: 'ACTIVE' },
    { code: 'P.301', name: 'Phòng Siêu âm 4D/5D 301', status: 'ACTIVE' },
    { code: 'P.302', name: 'Phòng Siêu âm Doppler 302', status: 'ACTIVE' },
    { code: 'P.401', name: 'Phòng Thủ thuật Sản khoa 401', status: 'ACTIVE' },
    { code: 'P.209', name: 'Phòng khám Dự phòng 209 (Tạm ngưng bảo trì)', status: 'INACTIVE' },
  ];

  const roomMap = {};
  for (const rm of clinicRoomsDef) {
    const rmRes = await clients.doctor.query(
      `INSERT INTO clinic_rooms (id, code, name, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW()) RETURNING id, code, name, status`,
      [rm.code, rm.name, rm.status]
    );
    roomMap[rm.code] = rmRes.rows[0];
  }

  const doctorRoomCodes = ['P.201', 'P.202', 'P.203', 'P.204', 'P.205', 'P.206', 'P.207', 'P.208'];
  const doctorsDef = [
    {
      email: 'dr.lethuha@antam.local',
      fullName: 'BS. CKII. Lê Thu Hà',
      phone: '0903112001',
      license: '001234/BYT-CCHN',
      rank: 'HEAD_DOCTOR',
      title: 'Bác sĩ CKII - Trưởng khoa Sản',
      startYear: 2008,
      specialtyCode: 'OBSTETRICS',
      photoUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80',
      bio: 'Hơn 18 năm kinh nghiệm trong lĩnh vực Sản khoa và Phẫu thuật phụ khoa. Từng tu nghiệp tại Đại học Y khoa Paris Descartes (Pháp). Chuyên gia đầu ngành về quản lý thai kỳ nguy cơ cao và phẫu thuật lấy thai an toàn.',
    },
    {
      email: 'dr.nguyenquangminh@antam.local',
      fullName: 'PGS. TS. BS. Nguyễn Quang Minh',
      phone: '0903112002',
      license: '002345/BYT-CCHN',
      rank: 'ASSOC_PROFESSOR',
      title: 'Phó Giáo sư, Tiến sĩ Bác sĩ Chẩn đoán hình ảnh',
      startYear: 2002,
      specialtyCode: 'PERINATOLOGY',
      photoUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=80',
      bio: 'Phó Giáo sư đầu ngành về Y học bào thai và Chẩn đoán trước sinh. Giảng viên cao cấp bộ môn Chẩn đoán hình ảnh. Chuyên gia siêu âm hình thái học thai nhi 4D/5D và sàng lọc dị tật bẩm sinh phức tạp.',
    },
    {
      email: 'dr.tranthanhmai@antam.local',
      fullName: 'ThS. BS. Trần Thanh Mai',
      phone: '0903112003',
      license: '003456/BYT-CCHN',
      rank: 'MASTER',
      title: 'Thạc sĩ Bác sĩ Sản Phụ khoa',
      startYear: 2014,
      specialtyCode: 'OBSTETRICS',
      photoUrl: 'https://images.unsplash.com/photo-1594824813501-489564c718b9?auto=format&fit=crop&w=800&q=80',
      bio: 'Tốt nghiệp Thạc sĩ Sản phụ khoa loại Xuất sắc tại Đại học Y Hà Nội. Tận tâm, ân cần, được nhiều mẹ bầu tin cậy đồng hành trong suốt thai kỳ và quá trình sinh nở tự nhiên.',
    },
    {
      email: 'dr.dangkimoanh@antam.local',
      fullName: 'BS. CKI. Đặng Kim Oanh',
      phone: '0903112004',
      license: '004567/BYT-CCHN',
      rank: 'SPECIALIST_I',
      title: 'Bác sĩ CKI Y học bào thai',
      startYear: 2016,
      specialtyCode: 'PERINATOLOGY',
      photoUrl: 'https://images.unsplash.com/photo-1614608682850-e0d6ed316d47?auto=format&fit=crop&w=800&q=80',
      bio: 'Chứng chỉ Siêu âm Sản phụ khoa thực hành của Hiệp hội Siêu âm Sản Phụ khoa Quốc tế (ISUOG). Có bề dày kinh nghiệm trong sàng lọc NIPT và chẩn đoán trước sinh.',
    },
    {
      email: 'dr.vuhoanglong@antam.local',
      fullName: 'BS. CKII. Vũ Hoàng Long',
      phone: '0903112005',
      license: '005678/BYT-CCHN',
      rank: 'SPECIALIST_II',
      title: 'Bác sĩ CKII Hiếm muộn & Hỗ trợ sinh sản',
      startYear: 2010,
      specialtyCode: 'REPRODUCTIVE_ENDOCRINOLOGY',
      photoUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=800&q=80',
      bio: 'Chuyên gia hỗ trợ sinh sản và điều trị vô sinh - hiếm muộn. Tỷ lệ điều trị thụ tinh ống nghiệm IVF thành công cao. Tư vấn các phương pháp hỗ trợ sinh sản hiện đại và đồng hành cùng các cặp vợ chồng hiếm muộn.',
    },
    {
      email: 'dr.phamthuyduong@antam.local',
      fullName: 'BS. CKI. Phạm Thùy Dương',
      phone: '0903112006',
      license: '006789/BYT-CCHN',
      rank: 'SPECIALIST_I',
      title: 'Bác sĩ CKI Nội tiết & Bệnh lý thai kỳ',
      startYear: 2015,
      specialtyCode: 'MATERNAL_MEDICINE',
      photoUrl: 'https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&w=800&q=80',
      bio: 'Chuyên sâu quản lý bệnh lý nội khoa thai kỳ: Đái tháo đường thai kỳ, bệnh lý tuyến giáp thai kỳ, tăng huyết áp thai kỳ và dự phòng tiền sản giật sớm.',
    },
    {
      email: 'dr.nguyenhongnhung@antam.local',
      fullName: 'BS. Nguyễn Hồng Nhung',
      phone: '0903112007',
      license: '007890/BYT-CCHN',
      rank: 'BASIC',
      title: 'Bác sĩ Sản Phụ khoa',
      startYear: 2019,
      specialtyCode: 'OBSTETRICS',
      photoUrl: 'https://images.unsplash.com/photo-1623854767648-e7bb8009f0db?auto=format&fit=crop&w=800&q=80',
      bio: 'Bác sĩ Sản phụ khoa năng động, chu đáo, tốt nghiệp Đại học Y Dược TP.HCM. Phụ trách khám thai định kỳ, tư vấn tiền sản và theo dõi sức khỏe mẹ bé chu đáo.',
    },
    {
      email: 'dr.doanvanbac@antam.local',
      fullName: 'TS. BS. Đoàn Văn Bắc',
      phone: '0903112008',
      license: '008901/BYT-CCHN',
      rank: 'EXPERT',
      title: 'Tiến sĩ Bác sĩ Chuyên gia Cố vấn Sản Phụ khoa',
      startYear: 2004,
      specialtyCode: 'OBSTETRICS',
      photoUrl: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=800&q=80',
      bio: 'Tiến sĩ Y khoa, nguyên Phó khoa Phụ Sản Bệnh viện Phụ sản TW. Hơn 22 năm cống hiến trong ngành, xử lý thành công hàng ngàn ca thai kỳ nguy cơ cao và phẫu thuật phụ khoa phức tạp.',
    },
  ];

  const doctorList = [];
  const effectiveDate = new Date(now.getFullYear(), now.getMonth(), 1);

  for (let docIdx = 0; docIdx < doctorsDef.length; docIdx++) {
    const doc = doctorsDef[docIdx];
    const assignedRoom = roomMap[doctorRoomCodes[docIdx]] || roomMap['P.201'];
    const accId = await createAuthAccount(doc.email, 'DOCTOR');

    const docRes = await clients.doctor.query(
      `INSERT INTO doctors (id, account_id, license_number, consultation_rank, status, version, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE', 1, NOW(), NOW()) RETURNING id`,
      [accId, doc.license, doc.rank]
    );
    const doctorId = docRes.rows[0].id;

    await clients.doctor.query(
      `INSERT INTO doctor_profiles (doctor_id, full_name, professional_title, biography, practice_start_year, languages, photo_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, ARRAY['vi', 'en'], $6, NOW(), NOW())`,
      [doctorId, doc.fullName, doc.title, doc.bio, doc.startYear, doc.photoUrl]
    );

    const specId = specialtyMap[doc.specialtyCode];
    if (specId) {
      await clients.doctor.query(
        `INSERT INTO doctor_specialties (doctor_id, specialty_id, is_primary, created_at)
         VALUES ($1, $2, true, NOW())`,
        [doctorId, specId]
      );
    }

    // Lịch làm việc cả tuần từ Chủ nhật đến Thứ 7 (day_of_week: 1 -> 7) gắn với phòng khám cố định của bác sĩ
    for (let day = 1; day <= 7; day++) {
      await clients.doctor.query(
        `INSERT INTO doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, room_id, effective_from, timezone, status, version, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, '08:00:00', '17:00:00', 30, $3, $4, 'Asia/Ho_Chi_Minh', 'ACTIVE', 1, NOW(), NOW())`,
        [doctorId, day, assignedRoom.id, effectiveDate]
      );
    }

    doctorList.push({
      id: doctorId,
      accountId: accId,
      roomId: assignedRoom.id,
      roomCode: assignedRoom.code,
      roomName: assignedRoom.name,
      ...doc,
    });
  }

  // Chuyên khoa phụ (Secondary specialty) cho Trưởng khoa BS. Lê Thu Hà: Thêm Phụ khoa
  const gynSpecId = specialtyMap['GYNECOLOGY'];
  if (gynSpecId && doctorList.length > 0) {
    await clients.doctor.query(
      `INSERT INTO doctor_specialties (doctor_id, specialty_id, is_primary, created_at)
       VALUES ($1, $2, false, NOW()) ON CONFLICT DO NOTHING`,
      [doctorList[0].id, gynSpecId]
    );
  }

  // Bác sĩ trạng thái INACTIVE (liên kết với test.disabled@antam.local)
  const inactiveDocRes = await clients.doctor.query(
    `INSERT INTO doctors (id, account_id, license_number, consultation_rank, status, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, '009999/BYT-CCHN', 'SPECIALIST_I', 'INACTIVE', 1, NOW(), NOW()) RETURNING id`,
    [disabledAccountId]
  );
  const inactiveDocId = inactiveDocRes.rows[0].id;
  await clients.doctor.query(
    `INSERT INTO doctor_profiles (doctor_id, full_name, professional_title, biography, practice_start_year, languages, photo_url, created_at, updated_at)
     VALUES ($1, 'BS. CKI. Nguyễn Văn Tạm Ngưng', 'Bác sĩ CKI (Tài khoản tạm ngưng)', 'Bác sĩ đang tạm ngưng công tác tại phòng khám để tham gia chương trình nghiên cứu.', 2017, ARRAY['vi'], 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=800&q=80', NOW(), NOW())`,
    [inactiveDocId]
  );
  if (specialtyMap['OBSTETRICS']) {
    await clients.doctor.query(
      `INSERT INTO doctor_specialties (doctor_id, specialty_id, is_primary, created_at)
       VALUES ($1, $2, true, NOW())`,
      [inactiveDocId, specialtyMap['OBSTETRICS']]
    );
  }

  // Bác sĩ trạng thái DRAFT (Bác sĩ mới nộp hồ sơ, chờ duyệt chứng chỉ hành nghề)
  const draftAccountId = await createAuthAccount('dr.draft@antam.local', 'DOCTOR', null, 'PENDING_VERIFICATION');
  const draftDocRes = await clients.doctor.query(
    `INSERT INTO doctors (id, account_id, license_number, consultation_rank, status, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, '010001/BYT-CCHN', 'BASIC', 'DRAFT', 1, NOW(), NOW()) RETURNING id`,
    [draftAccountId]
  );
  const draftDocId = draftDocRes.rows[0].id;
  await clients.doctor.query(
    `INSERT INTO doctor_profiles (doctor_id, full_name, professional_title, biography, practice_start_year, languages, photo_url, created_at, updated_at)
     VALUES ($1, 'BS. Hoàng Minh Tuấn', 'Bác sĩ thực hành nội trú', 'Bác sĩ nội trú tốt nghiệp loại Giỏi, đang hoàn thiện hồ sơ đăng ký hành nghề chính thức.', 2023, ARRAY['vi', 'en'], 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=80', NOW(), NOW())`,
    [draftDocId]
  );
  if (specialtyMap['OBSTETRICS']) {
    await clients.doctor.query(
      `INSERT INTO doctor_specialties (doctor_id, specialty_id, is_primary, created_at)
       VALUES ($1, $2, true, NOW())`,
      [draftDocId, specialtyMap['OBSTETRICS']]
    );
  }

  // Khởi tạo Lịch khả dụng đặc biệt & Nghỉ phép (Doctor Availabilities)
  const trainingStart = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  trainingStart.setHours(8, 0, 0, 0);
  const trainingEnd = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  trainingEnd.setHours(17, 0, 0, 0);

  // 1. BS. Đặng Kim Oanh nghỉ tập huấn ISUOG
  await clients.doctor.query(
    `INSERT INTO doctor_availabilities (id, doctor_id, type, start_at, end_at, reason_code, note, status, created_by, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 'UNAVAILABLE', $2, $3, 'TRAINING', 'Tham gia khóa đào tạo chuyên sâu về Siêu âm hình thái tim thai ISUOG', 'ACTIVE', $4, 1, NOW(), NOW())`,
    [doctorList[3].id, trainingStart, trainingEnd, adminAccountId]
  );

  // 2. BS. Lê Thu Hà tăng cường ca trực hội chẩn ngoài giờ (EXTRA_AVAILABLE)
  const extraShiftStart = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  extraShiftStart.setHours(17, 0, 0, 0);
  const extraShiftEnd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  extraShiftEnd.setHours(20, 0, 0, 0);

  await clients.doctor.query(
    `INSERT INTO doctor_availabilities (id, doctor_id, type, start_at, end_at, room_id, reason_code, note, status, created_by, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 'EXTRA_AVAILABLE', $2, $3, $4, 'EXTRA_SHIFT', 'Tăng cường ca hội chẩn thai kỳ nguy cơ cao ngoài giờ tại P.201', 'ACTIVE', $5, 1, NOW(), NOW())`,
    [doctorList[0].id, extraShiftStart, extraShiftEnd, doctorList[0].roomId, adminAccountId]
  );

  // 3. BS. Trần Thanh Mai xin nghỉ phép cá nhân nhưng đã hủy (CANCELLED)
  const leaveStart = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  leaveStart.setHours(8, 0, 0, 0);
  const leaveEnd = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  leaveEnd.setHours(12, 0, 0, 0);

  await clients.doctor.query(
    `INSERT INTO doctor_availabilities (id, doctor_id, type, start_at, end_at, reason_code, note, status, created_by, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, 'UNAVAILABLE', $2, $3, 'PERSONAL_LEAVE', 'Bận việc gia đình cá nhân (đã hủy lịch xin nghỉ)', 'CANCELLED', $4, 1, NOW(), NOW())`,
    [doctorList[2].id, leaveStart, leaveEnd, adminAccountId]
  );

  // Khởi tạo Nhật ký thay đổi (Doctor Audit Records)
  await clients.doctor.query(
    `INSERT INTO audit_records (id, event_type, actor_id, doctor_id, details, created_at)
     VALUES (gen_random_uuid(), 'DOCTOR_PROFILE_UPDATED', $1, $2, $3, NOW())`,
    [adminAccountId, doctorList[0].id, JSON.stringify({ field: 'professional_title', change: 'Bổ nhiệm Trưởng khoa Sản' })]
  );
  await clients.doctor.query(
    `INSERT INTO audit_records (id, event_type, actor_id, doctor_id, details, created_at)
     VALUES (gen_random_uuid(), 'SCHEDULE_CONFIGURED', $1, $2, $3, NOW())`,
    [adminAccountId, doctorList[1].id, JSON.stringify({ action: 'WEEKLY_SCHEDULE_INITIALIZED', days: [2, 3, 4, 5, 6, 7], slotDurationMinutes: 30 })]
  );

  // Khởi tạo Outbox Event mẫu
  await clients.doctor.query(
    `INSERT INTO outbox_events (id, event_type, aggregate_type, aggregate_id, aggregate_version, payload, status, attempts, occurred_at, created_at)
     VALUES (gen_random_uuid(), 'doctor.availability_changed', 'DOCTOR', $1, 1, $2, 'PROCESSED', 1, NOW(), NOW())`,
    [doctorList[3].id, JSON.stringify({ doctorId: doctorList[3].id, event: 'AVAILABILITY_OVERRIDE_ADDED', reason: 'TRAINING' })]
  );

  console.log(`✅ Đã khởi tạo 10 Bác sĩ (ACTIVE, INACTIVE, DRAFT), Chuyên khoa chính/phụ, Lịch trực tuần, Lịch khả dụng (TRAINING, EXTRA_SHIFT, CANCELLED), Audit Records và Outbox.`);

  // ============================================================================
  // 7. NHÂN VIÊN LỄ TÂN & TIẾP ĐÓN (RECEPTIONISTS)
  // ============================================================================
  console.log('\n--- BƯỚC 7: KHỞI TẠO BỘ PHẬN LỄ TÂN TIẾP ĐÓN (RECEPTIONIST) ---');
  const receptionistsDef = [
    {
      email: 'reception.hoangyen@antam.local',
      fullName: 'Hoàng Thị Yến',
      phone: '0904001001',
      code: 'REC-001',
      dept: 'Quầy Tiếp đón Trung tâm Tầng 1',
      gender: 'FEMALE',
      address: '25 Tràng Thi, Hoàn Kiếm, Hà Nội',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
      status: 'ACTIVE',
      authStatus: 'ACTIVE',
    },
    {
      email: 'reception.maiphuong@antam.local',
      fullName: 'Lê Mai Phương',
      phone: '0904001002',
      code: 'REC-002',
      dept: 'Khu vực Tiếp đón Khoa Khám bệnh Tầng 2',
      gender: 'FEMALE',
      address: '88 Giảng Võ, Ba Đình, Hà Nội',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=800&q=80',
      status: 'ACTIVE',
      authStatus: 'ACTIVE',
    },
    {
      email: 'demo.receptionist@antam.local',
      fullName: 'Trần Thu Ngân (Demo Lễ tân)',
      phone: '0904001003',
      code: 'REC-000',
      dept: 'Ban Tiếp đón & Chăm sóc Khách hàng',
      gender: 'FEMALE',
      address: '12 Nguyễn Du, Hai Bà Trưng, Hà Nội',
      avatarUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=800&q=80',
      status: 'ACTIVE',
      authStatus: 'ACTIVE',
    },
    {
      email: 'reception.quocanh@antam.local',
      fullName: 'Phạm Quốc Anh',
      phone: '0904001004',
      code: 'REC-003',
      dept: 'Quầy Tiếp đón & Hướng dẫn Cấp cứu Tầng 1',
      gender: 'MALE',
      address: '15 Lê Duẩn, Ba Đình, Hà Nội',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
      status: 'ACTIVE',
      authStatus: 'ACTIVE',
    },
    {
      email: 'reception.thuthao@antam.local',
      fullName: 'Đặng Thu Thảo',
      phone: '0904001005',
      code: 'REC-004',
      dept: 'Khu Tiếp đón Sản khoa Tầng 2 (Tạm nghỉ thai sản)',
      gender: 'FEMALE',
      address: '42 Phố Huế, Hoàn Kiếm, Hà Nội',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
      status: 'INACTIVE',
      authStatus: 'DISABLED',
    },
    {
      email: 'reception.thuytrang@antam.local',
      fullName: 'Nguyễn Thùy Trang',
      phone: '0904001006',
      code: 'REC-005',
      dept: 'Tập sự Bộ phận Tiếp đón Khách hàng',
      gender: 'FEMALE',
      address: '77 Đội Cấn, Ba Đình, Hà Nội',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=800&q=80',
      status: 'DRAFT',
      authStatus: 'PENDING_VERIFICATION',
    },
  ];

  const receptionistList = [];
  for (const rec of receptionistsDef) {
    const accId = await createAuthAccount(rec.email, 'RECEPTIONIST', null, rec.authStatus);

    const recRes = await clients.receptionist.query(
      `INSERT INTO receptionists (id, account_id, employee_code, status, version, created_by_account_id, updated_by_account_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 1, $4, $4, NOW(), NOW()) RETURNING id`,
      [accId, rec.code, rec.status, adminAccountId]
    );
    const receptionistId = recRes.rows[0].id;

    await clients.receptionist.query(
      `INSERT INTO receptionist_profiles (receptionist_id, full_name, work_phone, login_email, address, department, gender, avatar_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [receptionistId, rec.fullName, rec.phone, rec.email, rec.address, rec.dept, rec.gender, rec.avatarUrl]
    );

    receptionistList.push({ id: receptionistId, accountId: accId, ...rec });
  }

  // Nhật ký thao tác lễ tân (Reception Audit Log)
  await clients.receptionist.query(
    `INSERT INTO reception_audit_logs (id, event_type, actor_id, receptionist_id, changed_fields, reason_code, request_id, created_at)
     VALUES (gen_random_uuid(), 'RECEPTIONIST_UPDATED', $1, $2, ARRAY['profile.department'], 'ADMIN_PROFILE_UPDATE', gen_random_uuid(), NOW())`,
    [adminAccountId, receptionistList[0].id]
  );

  // Bản ghi kiểm soát lặp lại (Reception Idempotency Record)
  const recIdempotencyHash = sha256(JSON.stringify({ receptionistId: receptionistList[4].id, reason: 'Nghỉ thai sản' }));
  await clients.receptionist.query(
    `INSERT INTO reception_idempotency_records (id, actor_id, operation, idempotency_key, request_hash, resource_id, response_status, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, gen_random_uuid(), $3, $4, 200, NOW() + INTERVAL '24 hours', NOW())`,
    [adminAccountId, `receptionist.deactivate:${receptionistList[4].id}`, recIdempotencyHash, receptionistList[4].id]
  );

  console.log(`✅ Đã khởi tạo 6 Nhân viên Lễ tân (ACTIVE, INACTIVE, DRAFT - Nam/Nữ), Audit Log và Idempotency Record.`);

  // ============================================================================
  // 8. BỆNH NHÂN THAI PHỤ (PATIENTS WITH ENCRYPTED NATIONAL ID)
  // ============================================================================
  console.log('\n--- BƯỚC 8: KHỞI TẠO DANH SÁCH BỆNH NHÂN THAI PHỤ (PATIENTS) ---');
  const patientsDef = [
    {
      email: 'demo.patient@antam.local',
      fullName: 'Nguyễn Minh Anh',
      phone: '0901000001',
      dob: '1995-06-15',
      nationalId: '001195000101',
      address: '12 Nguyễn Du, Phường Hàng Bài, Hoàn Kiếm, Hà Nội',
      emergencyName: 'Trần Văn Bình',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901000002',
      secondaryContacts: [
        { name: 'Lê Thị Mai', rel: 'Mẹ ruột', phone: '0901000099', priority: 2 },
      ],
      gestationalWeeks: 22,
      riskLevel: 'LOW',
    },
    {
      email: 'patient.thanhhang@gmail.com',
      fullName: 'Trần Thị Thanh Hằng',
      phone: '0901234003',
      dob: '1993-09-22',
      nationalId: '001193000102',
      address: '45 Tràng Thi, Hàng Trống, Hoàn Kiếm, Hà Nội',
      emergencyName: 'Nguyễn Hoàng Long',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234004',
      secondaryContacts: [
        { name: 'Trần Thị Kim Oanh', rel: 'Chị ruột', phone: '0901234098', priority: 2 },
      ],
      gestationalWeeks: 12,
      riskLevel: 'LOW',
    },
    {
      email: 'patient.ngocmai@gmail.com',
      fullName: 'Lê Ngọc Mai',
      phone: '0901234005',
      dob: '1998-03-10',
      nationalId: '001198000103',
      address: '88 Cầu Giấy, Quan Hoa, Cầu Giấy, Hà Nội',
      emergencyName: 'Lê Văn Tuấn',
      emergencyRel: 'Bố đẻ',
      emergencyPhone: '0901234006',
      gestationalWeeks: 28,
      riskLevel: 'MODERATE',
    },
    {
      email: 'patient.quynhchi@gmail.com',
      fullName: 'Phạm Quỳnh Chi',
      phone: '0901234007',
      dob: '1992-12-05',
      nationalId: '001192000104',
      address: '156 Nguyễn Trãi, Thượng Đình, Thanh Xuân, Hà Nội',
      emergencyName: 'Vũ Mạnh Hùng',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234008',
      secondaryContacts: [
        { name: 'Vũ Thị Lan', rel: 'Mẹ chồng', phone: '0901234097', priority: 2 },
      ],
      gestationalWeeks: 34,
      riskLevel: 'HIGH',
    },
    {
      email: 'patient.thuyduong@gmail.com',
      fullName: 'Hoàng Thùy Dương',
      phone: '0901234009',
      dob: '1996-08-18',
      nationalId: '001196000105',
      address: '23 Lạc Long Quân, Bưởi, Tây Hồ, Hà Nội',
      emergencyName: 'Hoàng Văn Nam',
      emergencyRel: 'Bố đẻ',
      emergencyPhone: '0901234010',
      gestationalWeeks: 16,
      riskLevel: 'LOW',
    },
    {
      email: 'patient.kimngan@gmail.com',
      fullName: 'Vũ Thị Kim Ngân',
      phone: '0901234011',
      dob: '1994-11-30',
      nationalId: '001194000106',
      address: '74 Giải Phóng, Đồng Tâm, Hai Bà Trưng, Hà Nội',
      emergencyName: 'Đỗ Đức Thắng',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234012',
      gestationalWeeks: 10,
      riskLevel: 'LOW',
    },
    {
      email: 'patient.thutrang@gmail.com',
      fullName: 'Đỗ Thu Trang',
      phone: '0901234013',
      dob: '1997-04-25',
      nationalId: '001197000107',
      address: '102 Thái Hà, Trung Liệt, Đống Đa, Hà Nội',
      emergencyName: 'Phạm Hải Đăng',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234014',
      gestationalWeeks: 20,
      riskLevel: 'LOW',
    },
    {
      email: 'patient.phuonglinh@gmail.com',
      fullName: 'Bùi Phương Linh',
      phone: '0901234015',
      dob: '1999-01-14',
      nationalId: '001199000108',
      address: '55 Xã Đàn, Nam Đồng, Đống Đa, Hà Nội',
      emergencyName: 'Bùi Quang Vinh',
      emergencyRel: 'Bố đẻ',
      emergencyPhone: '0901234016',
      gestationalWeeks: 8,
      riskLevel: 'LOW',
    },
    {
      email: 'patient.honghanh@gmail.com',
      fullName: 'Đinh Thị Hồng Hạnh',
      phone: '0901234017',
      dob: '1991-07-08',
      nationalId: '001191000109',
      address: '36 Hoàng Hoa Thám, Thụy Khuê, Tây Hồ, Hà Nội',
      emergencyName: 'Trương Quốc Bảo',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234018',
      gestationalWeeks: 31,
      riskLevel: 'MODERATE',
    },
    {
      email: 'patient.bichthuy@gmail.com',
      fullName: 'Phan Thị Bích Thủy',
      phone: '0901234019',
      dob: '1995-10-12',
      nationalId: '001195000110',
      address: '19 Lê Văn Lương, Nhân Chính, Thanh Xuân, Hà Nội',
      emergencyName: 'Nguyễn Đình Trọng',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234020',
      gestationalWeeks: 25,
      riskLevel: 'LOW',
    },
    {
      email: 'patient.yennhi@gmail.com',
      fullName: 'Dương Yến Nhi',
      phone: '0901234021',
      dob: '2000-02-28',
      nationalId: '001200000111',
      address: '67 Trần Duy Hưng, Trung Hòa, Cầu Giấy, Hà Nội',
      emergencyName: 'Dương Thế Anh',
      emergencyRel: 'Bố đẻ',
      emergencyPhone: '0901234022',
      gestationalWeeks: 14,
      riskLevel: 'LOW',
    },
    {
      email: 'patient.baochau@gmail.com',
      fullName: 'Võ Bảo Châu',
      phone: '0901234023',
      dob: '1996-05-19',
      nationalId: '001196000112',
      address: '18 Lý Thường Kiệt, Phan Chu Trinh, Hoàn Kiếm, Hà Nội',
      emergencyName: 'Lê Quang Huy',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234024',
      gestationalWeeks: 18,
      riskLevel: 'LOW',
    },
    // Bệnh nhân vãng lai đăng ký trực tiếp tại quầy tiếp đón (authAccountId = null)
    {
      isWalkIn: true,
      email: null,
      fullName: 'Bùi Thị Ngọc Mai',
      phone: '0901234025',
      dob: '1999-12-05',
      nationalId: '001199000113',
      address: '72 Bà Triệu, Hàng Bài, Hoàn Kiếm, Hà Nội',
      emergencyName: 'Bùi Văn Hưng',
      emergencyRel: 'Bố ruột',
      emergencyPhone: '0901234026',
      gestationalWeeks: 8,
      riskLevel: 'LOW',
    },
    {
      isWalkIn: true,
      email: null,
      fullName: 'Phan Thanh Trúc',
      phone: '0901234027',
      dob: '2001-04-20',
      nationalId: '001201000114',
      address: '15 Lê Thánh Tông, Phan Chu Trinh, Hoàn Kiếm, Hà Nội',
      emergencyName: 'Đặng Quốc Anh',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234028',
      gestationalWeeks: 14,
      riskLevel: 'LOW',
    },
  ];

  const patientList = [];

  for (const pat of patientsDef) {
    let accId = null;
    let creatorAccountId = receptionistList[0].accountId;
    if (!pat.isWalkIn && pat.email) {
      accId = await createAuthAccount(pat.email, 'PATIENT');
      creatorAccountId = accId;
    }
    const { ciphertext, lookupHash } = encryptNationalId(pat.nationalId);
    const normName = normalizeSearchName(pat.fullName);
    const formattedPhone = normalizePhone(pat.phone);

    const patRes = await clients.patient.query(
      `INSERT INTO patients (id, auth_account_id, full_name, normalized_full_name, date_of_birth, phone_number, national_id_ciphertext, national_id_lookup_hash, address, version, created_by_account_id, updated_by_account_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $9, NOW(), NOW()) RETURNING id`,
      [accId, pat.fullName, normName, pat.dob, formattedPhone, ciphertext, lookupHash, pat.address, creatorAccountId]
    );
    const patientId = patRes.rows[0].id;

    // Người liên hệ khẩn cấp chính (Primary Contact, priority = 1)
    await clients.patient.query(
      `INSERT INTO emergency_contacts (id, patient_id, full_name, relationship, phone_number, is_primary, priority, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, 1, NOW(), NOW())`,
      [patientId, pat.emergencyName, pat.emergencyRel, normalizePhone(pat.emergencyPhone)]
    );

    // Người liên hệ khẩn cấp phụ (Secondary Contacts, priority >= 2)
    if (pat.secondaryContacts && Array.isArray(pat.secondaryContacts)) {
      for (const sc of pat.secondaryContacts) {
        await clients.patient.query(
          `INSERT INTO emergency_contacts (id, patient_id, full_name, relationship, phone_number, is_primary, priority, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, false, $5, NOW(), NOW())`,
          [patientId, sc.name, sc.rel, normalizePhone(sc.phone), sc.priority || 2]
        );
      }
    }

    // Hồ sơ Thai kỳ (PregnancyEpisode) trong MedicalRecord Service
    const lmpDate = new Date(now);
    lmpDate.setDate(lmpDate.getDate() - pat.gestationalWeeks * 7);
    const eddDate = new Date(lmpDate);
    eddDate.setDate(eddDate.getDate() + 280);

    const epRes = await clients.medicalRecord.query(
      `INSERT INTO pregnancy_episodes (id, patient_id, status, estimated_due_date, last_menstrual_period, risk_level, version, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'ACTIVE', $2, $3, $4, 1, NOW(), NOW()) RETURNING id`,
      [patientId, eddDate, lmpDate, pat.riskLevel]
    );
    const pregnancyEpisodeId = epRes.rows[0].id;

    patientList.push({ id: patientId, accountId: accId, pregnancyEpisodeId, ...pat, phone: formattedPhone });
  }

  // ============================================================================
  // NHẬT KÝ KIỂM TOÁN HỒ SƠ BỆNH NHÂN (PATIENT AUDIT LOGS) & IDEMPOTENCY
  // ============================================================================
  const pat1 = patientList[0]; // Nguyễn Minh Anh
  const pat2 = patientList[1]; // Trần Thị Thanh Hằng
  const walkin1 = patientList[12]; // Bùi Thị Ngọc Mai
  const walkin2 = patientList[13]; // Phan Thanh Trúc
  const rec1Acc = receptionistList[0].accountId;
  const rec2Acc = receptionistList[1].accountId;
  const doc1Acc = doctorList[0].accountId;

  // 1. Audit: Bệnh nhân tự tạo tài khoản (patient.created)
  await clients.patient.query(
    `INSERT INTO patient_audit_logs (id, event_type, actor_id, actor_role, patient_id, changed_fields, request_id, metadata, created_at)
     VALUES (gen_random_uuid(), 'patient.created', $1, 'PATIENT', $2, ARRAY[]::TEXT[], gen_random_uuid(), NULL, NOW() - INTERVAL '30 days')`,
    [pat1.accountId, pat1.id]
  );

  // 2. Audit: Lễ tân tạo hồ sơ vãng lai tại quầy (patient.created)
  await clients.patient.query(
    `INSERT INTO patient_audit_logs (id, event_type, actor_id, actor_role, patient_id, changed_fields, request_id, metadata, created_at)
     VALUES (gen_random_uuid(), 'patient.created', $1, 'RECEPTIONIST', $2, ARRAY[]::TEXT[], gen_random_uuid(), $3, NOW() - INTERVAL '2 hours')`,
    [rec1Acc, walkin1.id, JSON.stringify({ reason: 'Đăng ký hồ sơ bệnh nhân vãng lai khám lần đầu tại quầy tiếp đón' })]
  );

  // 3. Audit: Bệnh nhân cập nhật địa chỉ thường trú (patient.updated)
  await clients.patient.query(
    `INSERT INTO patient_audit_logs (id, event_type, actor_id, actor_role, patient_id, changed_fields, request_id, metadata, created_at)
     VALUES (gen_random_uuid(), 'patient.updated', $1, 'PATIENT', $2, ARRAY['address']::TEXT[], gen_random_uuid(), $3, NOW() - INTERVAL '15 days')`,
    [pat1.accountId, pat1.id, JSON.stringify({ reason: 'Cập nhật số nhà và phường mới sau khi chuyển chỗ ở' })]
  );

  // 4. Audit: Lễ tân cập nhật số điện thoại cho bệnh nhân (patient.updated)
  await clients.patient.query(
    `INSERT INTO patient_audit_logs (id, event_type, actor_id, actor_role, patient_id, changed_fields, request_id, metadata, created_at)
     VALUES (gen_random_uuid(), 'patient.updated', $1, 'RECEPTIONIST', $2, ARRAY['phoneNumber']::TEXT[], gen_random_uuid(), $3, NOW() - INTERVAL '1 day')`,
    [rec2Acc, pat2.id, JSON.stringify({ reason: 'Thay đổi số điện thoại liên lạc theo xác nhận căn cước trực tiếp' })]
  );

  // 5. Audit: Lễ tân xem chi tiết hồ sơ lúc tiếp đón check-in (patient.viewed)
  await clients.patient.query(
    `INSERT INTO patient_audit_logs (id, event_type, actor_id, actor_role, patient_id, changed_fields, request_id, metadata, created_at)
     VALUES (gen_random_uuid(), 'patient.viewed', $1, 'RECEPTIONIST', $2, ARRAY[]::TEXT[], gen_random_uuid(), $3, NOW() - INTERVAL '30 minutes')`,
    [rec1Acc, pat1.id, JSON.stringify({ purpose: 'CHECK_IN' })]
  );

  // 6. Audit: Bác sĩ xem hồ sơ bệnh án trước khi thăm khám (patient.viewed)
  await clients.patient.query(
    `INSERT INTO patient_audit_logs (id, event_type, actor_id, actor_role, patient_id, changed_fields, request_id, metadata, created_at)
     VALUES (gen_random_uuid(), 'patient.viewed', $1, 'DOCTOR', $2, ARRAY[]::TEXT[], gen_random_uuid(), $3, NOW() - INTERVAL '10 minutes')`,
    [doc1Acc, pat1.id, JSON.stringify({ purpose: 'CLINICAL_CONSULTATION' })]
  );

  // 7. Audit: Lễ tân tra cứu bệnh nhân theo SĐT (patient.searched)
  await clients.patient.query(
    `INSERT INTO patient_audit_logs (id, event_type, actor_id, actor_role, patient_id, changed_fields, request_id, metadata, created_at)
     VALUES (gen_random_uuid(), 'patient.searched', $1, 'RECEPTIONIST', $2, ARRAY[]::TEXT[], gen_random_uuid(), $3, NOW() - INTERVAL '35 minutes')`,
    [rec1Acc, pat1.id, JSON.stringify({ searchType: ['PHONE'], resultCount: 1 })]
  );

  // 8. Audit: Lễ tân tra cứu bệnh nhân theo CCCD (patient.searched)
  await clients.patient.query(
    `INSERT INTO patient_audit_logs (id, event_type, actor_id, actor_role, patient_id, changed_fields, request_id, metadata, created_at)
     VALUES (gen_random_uuid(), 'patient.searched', $1, 'RECEPTIONIST', $2, ARRAY[]::TEXT[], gen_random_uuid(), $3, NOW() - INTERVAL '25 minutes')`,
    [rec2Acc, pat2.id, JSON.stringify({ searchType: ['NATIONAL_ID'], resultCount: 1 })]
  );

  // 9. Audit: Bệnh nhân thêm người liên hệ khẩn cấp thứ 2 (emergency_contact.changed)
  await clients.patient.query(
    `INSERT INTO patient_audit_logs (id, event_type, actor_id, actor_role, patient_id, changed_fields, request_id, metadata, created_at)
     VALUES (gen_random_uuid(), 'emergency_contact.changed', $1, 'PATIENT', $2, ARRAY[]::TEXT[], gen_random_uuid(), $3, NOW() - INTERVAL '20 days')`,
    [pat1.accountId, pat1.id, JSON.stringify({ action: 'added', priority: 2, relationship: 'Mẹ ruột' })]
  );

  // 10. Bản ghi kiểm soát lặp lại (Idempotency Records)
  const reqHash1 = sha256(JSON.stringify({ fullName: walkin1.fullName, phone: walkin1.phone, nationalId: walkin1.nationalId }));
  await clients.patient.query(
    `INSERT INTO idempotency_records (id, actor_id, operation, idempotency_key, request_hash, patient_id, status, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, 'patient.create', gen_random_uuid(), $2, $3, 'COMPLETED', NOW() + INTERVAL '24 hours', NOW() - INTERVAL '2 hours')`,
    [rec1Acc, reqHash1, walkin1.id]
  );

  const reqHash2 = sha256(JSON.stringify({ fullName: walkin2.fullName, phone: walkin2.phone, nationalId: walkin2.nationalId }));
  await clients.patient.query(
    `INSERT INTO idempotency_records (id, actor_id, operation, idempotency_key, request_hash, patient_id, status, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, 'patient.create', gen_random_uuid(), $2, $3, 'COMPLETED', NOW() + INTERVAL '24 hours', NOW() - INTERVAL '1 hour')`,
    [rec2Acc, reqHash2, walkin2.id]
  );

  console.log(`✅ Đã khởi tạo 14 Bệnh nhân thai phụ (12 trực tuyến + 2 vãng lai) với mã hóa AES-256-GCM, Người liên hệ khẩn cấp đa cấp, Audit Logs và Idempotency Records.`);

  // ============================================================================
  // 9. LỊCH HẸN KHÁM, HÓA ĐƠN, THANH TOÁN & BỆNH ÁN LÂM SÀNG
  // ============================================================================
  console.log('\n--- BƯỚC 9: KHỞI TẠO LỊCH HẸN KHÁM, HÓA ĐƠN & BỆNH ÁN LÂM SÀNG ---');

  // Lập kịch bản lịch hẹn:
  // 1. Quá khứ (Đã khám xong - COMPLETED)
  // 2. Hôm nay (Đang khám / Đã check-in - CHECKED_IN, IN_CLINICAL_CARE, COMPLETED)
  // 3. Ngày mai & Tương lai (Đã đặt lịch - BOOKED)

  const appointmentsData = [
    // Lịch khám HÔM NAY - Nguyễn Minh Anh
    {
      patientIdx: 0,
      doctorIdx: 0, // BS. Lê Thu Hà
      serviceCode: 'PRENATAL_VIP',
      dayOffset: 0,
      startHour: 9,
      startMinute: 0,
      channel: 'ONLINE',
      selectionMode: 'DOCTOR',
      status: 'IN_CLINICAL_CARE',
      invoiceStatus: 'PAID',
      code: 'AT-2026-0001',
      vitals: { sys: 115, dia: 75, hr: 82, temp: 36.6, weight: 58.5 },
      complaint: 'Khám thai mốc 22 tuần, khảo sát hình thái học thai nhi và tư vấn dinh dưỡng.',
      summary: 'Thai 22 tuần phát triển tốt tương đương tuổi thai. Chiều dài xương đùi và chu vi đầu bình thường. Không phát hiện bất thường hình thái trên siêu âm. Tim thai 148 ck/p đều rõ.',
      diagnosis: { code: 'Z34.0', desc: 'Giám sát thai nghén con so bình thường tuần thứ 22' },
      medications: ['MED_FOLIC_400', 'MED_CALCIUM_CORBIERE', 'MED_DHA_PRENATAL'],
    },
    // Lịch khám HÔM NAY - Trần Thị Thanh Hằng
    {
      patientIdx: 1,
      doctorIdx: 1, // PGS. Nguyễn Quang Minh
      serviceCode: 'US_4D_5D',
      dayOffset: 0,
      startHour: 10,
      startMinute: 0,
      channel: 'RECEPTION',
      selectionMode: 'DOCTOR',
      status: 'CHECKED_IN',
      invoiceStatus: 'CREDIT_APPROVED',
      code: 'AT-2026-0002',
      vitals: { sys: 110, dia: 70, hr: 78, temp: 36.5, weight: 52.0 },
      complaint: 'Siêu âm 4D sàng lọc hình thái và đo độ mờ da gáy tuần 12.',
      summary: 'Đã check-in tiếp đón, hoàn tất đo sinh hiệu và chuyển tiếp đến phòng Siêu âm P.301.',
      diagnosis: null,
      medications: [],
    },
    // Lịch khám HÔM NAY - Lê Ngọc Mai
    {
      patientIdx: 2,
      doctorIdx: 5, // BS. Phạm Thùy Dương
      serviceCode: 'OGTT_DIABETES',
      dayOffset: 0,
      startHour: 8,
      startMinute: 30,
      channel: 'WALK_IN',
      selectionMode: 'RANK',
      status: 'COMPLETED',
      invoiceStatus: 'PAID',
      code: 'AT-2026-0003',
      vitals: { sys: 120, dia: 80, hr: 84, temp: 36.7, weight: 64.2 },
      complaint: 'Thực hiện nghiệm pháp dung nạp đường huyết 75g tầm soát đái tháo đường tuần 28.',
      summary: 'Đường huyết lúc đói: 4.8 mmol/L, sau 1h: 8.2 mmol/L, sau 2h: 7.1 mmol/L. Các chỉ số đều nằm trong giới hạn an toàn. Bác sĩ tư vấn duy trì chế độ ăn giảm đường tinh luyện.',
      diagnosis: { code: 'Z34.8', desc: 'Giám sát thai nghén bình thường khác, đường huyết kiểm soát tốt' },
      medications: ['MED_IRON_FEMAT', 'MED_CALCIUM_CORBIERE'],
    },
    // Lịch khám QUÁ KHỨ (3 ngày trước) - Phạm Quỳnh Chi
    {
      patientIdx: 3,
      doctorIdx: 0, // BS. Lê Thu Hà
      serviceCode: 'PRENATAL_ROUTINE',
      dayOffset: -3,
      startHour: 14,
      startMinute: 0,
      channel: 'ONLINE',
      selectionMode: 'DOCTOR',
      status: 'COMPLETED',
      invoiceStatus: 'PAID',
      code: 'AT-2026-0004',
      vitals: { sys: 125, dia: 82, hr: 80, temp: 36.6, weight: 68.0 },
      complaint: 'Khám thai định kỳ tuần 34, kiểm tra nước ối và vị trí ngôi thai.',
      summary: 'Ngôi đầu, tim thai 142 ck/p, cử động thai tốt. Nước ối AFI 12cm trong giới hạn bình thường. Hướng dẫn thai phụ theo dõi cử động thai (đếm thai máy hàng ngày).',
      diagnosis: { code: 'Z34.0', desc: 'Giám sát thai nghén bình thường 34 tuần' },
      medications: ['MED_CALCIUM_CORBIERE', 'MED_MAGNE_B6'],
    },
    // Lịch khám QUÁ KHỨ (5 ngày trước) - Hoàng Thùy Dương
    {
      patientIdx: 4,
      doctorIdx: 3, // BS. Đặng Kim Oanh
      serviceCode: 'NIPT_BASIC',
      dayOffset: -5,
      startHour: 9,
      startMinute: 30,
      channel: 'ONLINE',
      selectionMode: 'RANK',
      status: 'COMPLETED',
      invoiceStatus: 'PAID',
      code: 'AT-2026-0005',
      vitals: { sys: 112, dia: 72, hr: 76, temp: 36.5, weight: 55.4 },
      complaint: 'Lấy mẫu xét nghiệm NIPT Basic sàng lọc 3 cặp NST 21, 18, 13.',
      summary: 'Đã lấy máu tĩnh mạch thành công và chuyển phòng xét nghiệm di truyền. Kết quả: Nguy cơ rất thấp (Low risk) với hội chứng Down, Edwards và Patau.',
      diagnosis: { code: 'Z34.0', desc: 'Sàng lọc dị tật thai nhi trước sinh bình thường' },
      medications: ['MED_FOLIC_400'],
    },
    // Lịch khám NGÀY MAI - Vũ Thị Kim Ngân
    {
      patientIdx: 5,
      doctorIdx: 2, // ThS. BS. Trần Thanh Mai
      serviceCode: 'PRENATAL_ROUTINE',
      dayOffset: 1,
      startHour: 8,
      startMinute: 30,
      channel: 'RECEPTION',
      selectionMode: 'DOCTOR',
      status: 'BOOKED',
      invoiceStatus: 'PAYMENT_PENDING_VERIFICATION',
      code: 'AT-2026-0006',
      vitals: null,
      complaint: 'Đặt lịch khám thai định kỳ tuần 10.',
      summary: null,
      diagnosis: null,
      medications: [],
    },
    // Lịch khám NGÀY MAI - Đỗ Thu Trang
    {
      patientIdx: 6,
      doctorIdx: 1, // PGS. Nguyễn Quang Minh
      serviceCode: 'US_4D_5D',
      dayOffset: 1,
      startHour: 10,
      startMinute: 30,
      channel: 'ONLINE',
      selectionMode: 'DOCTOR',
      status: 'BOOKED',
      invoiceStatus: 'OUTSTANDING',
      code: 'AT-2026-0007',
      vitals: null,
      complaint: 'Đặt lịch siêu âm hình thái 4D tuần 20.',
      summary: null,
      diagnosis: null,
      medications: [],
    },
    // Lịch khám 3 NGÀY NỮA - Bùi Phương Linh
    {
      patientIdx: 7,
      doctorIdx: 6, // BS. Nguyễn Hồng Nhung
      serviceCode: 'US_2D',
      dayOffset: 3,
      startHour: 14,
      startMinute: 0,
      channel: 'ONLINE',
      selectionMode: 'DOCTOR',
      status: 'BOOKED',
      invoiceStatus: 'OUTSTANDING',
      code: 'AT-2026-0008',
      vitals: null,
      complaint: 'Đặt lịch siêu âm 2D kiểm tra tim thai lần đầu.',
      summary: null,
      diagnosis: null,
      medications: [],
    },
    // Lịch khám 4 NGÀY NỮA - Đinh Thị Hồng Hạnh
    {
      patientIdx: 8,
      doctorIdx: 5, // BS. Phạm Thùy Dương
      serviceCode: 'PRENATAL_VIP',
      dayOffset: 4,
      startHour: 9,
      startMinute: 0,
      channel: 'RECEPTION',
      selectionMode: 'RANK',
      status: 'BOOKED',
      invoiceStatus: 'OPEN',
      code: 'AT-2026-0009',
      vitals: null,
      complaint: 'Tư vấn và theo dõi huyết áp thai kỳ tuần 31.',
      summary: null,
      diagnosis: null,
      medications: [],
    },
    // Lịch khám HÔM NAY - Phan Thị Bích Thủy (Cần chuyển giao bác sĩ: REASSIGNMENT_REQUIRED)
    {
      patientIdx: 9,
      doctorIdx: 0, // BS. Lê Thu Hà
      serviceCode: 'PRENATAL_ROUTINE',
      dayOffset: 0,
      startHour: 15,
      startMinute: 30,
      channel: 'ONLINE',
      selectionMode: 'RANK',
      status: 'REASSIGNMENT_REQUIRED',
      invoiceStatus: 'OPEN',
      code: 'AT-2026-0010',
      vitals: null,
      complaint: 'Theo dõi thai định kỳ tuần 16. Bác sĩ phụ trách có lịch mổ cấp cứu đột xuất.',
      summary: null,
      diagnosis: null,
      medications: [],
    },
    // Lịch khám HÔM QUA - Dương Yến Nhi (Bị hủy: CANCELLED)
    {
      patientIdx: 10,
      doctorIdx: 4, // BS. CKII. Vũ Hoàng Long
      serviceCode: 'IUI_PROCEDURE',
      dayOffset: -1,
      startHour: 10,
      startMinute: 0,
      channel: 'RECEPTION',
      selectionMode: 'DOCTOR',
      status: 'CANCELLED',
      cancellationReason: 'Thai phụ bận công tác đột xuất, gọi điện xin hủy lịch hẹn và hẹn lại sau 1 tuần.',
      invoiceStatus: 'CANCELLED',
      code: 'AT-2026-0011',
      vitals: null,
      complaint: 'Tư vấn hiếm muộn & hỗ trợ sinh sản.',
      summary: null,
      diagnosis: null,
      medications: [],
    },
    // Lịch khám 2 NGÀY TRƯỚC - Võ Bảo Châu (Vắng mặt: NO_SHOW)
    {
      patientIdx: 11,
      doctorIdx: 6, // BS. Nguyễn Hồng Nhung
      serviceCode: 'US_2D',
      dayOffset: -2,
      startHour: 16,
      startMinute: 0,
      channel: 'WALK_IN',
      selectionMode: 'DOCTOR',
      status: 'NO_SHOW',
      invoiceStatus: 'OPEN',
      code: 'AT-2026-0012',
      vitals: null,
      complaint: 'Đăng ký siêu âm 2D nhưng không có mặt tại phòng khám quá thời hạn quy định.',
      summary: null,
      diagnosis: null,
      medications: [],
    },
  ];

  let ticketCounter = 1;
  const seededAppointments = [];

  for (const app of appointmentsData) {
    let paymentId = null;
    let encounterId = null;
    let journeyId = null;
    let ticketId = null;
    let prescriptionId = null;

    const pat = patientList[app.patientIdx];
    const doc = doctorList[app.doctorIdx];
    const srv = serviceMap[app.serviceCode];
    const rankInfo = rankSurchargeMap[doc.rank] || { id: null, amount: 0 };

    const appDate = new Date(now);
    appDate.setDate(appDate.getDate() + app.dayOffset);
    appDate.setHours(app.startHour, app.startMinute, 0, 0);

    const appEndDate = new Date(appDate);
    appEndDate.setMinutes(appEndDate.getMinutes() + 30);

    const baseAmount = srv.price;
    const surchargeAmount = rankInfo.amount;
    const totalAmount = baseAmount + surchargeAmount;

    const appChannel = app.channel || 'ONLINE';
    const appSelectionMode = app.selectionMode || 'DOCTOR';
    const requestedDoctor = appSelectionMode === 'DOCTOR' ? doc.id : null;
    const requestedRank = appSelectionMode === 'RANK' ? doc.rank : null;
    const checkedInTime = ['CHECKED_IN', 'IN_CLINICAL_CARE', 'COMPLETED'].includes(app.status) ? appDate : null;
    const clinicalStartedTime = ['IN_CLINICAL_CARE', 'COMPLETED'].includes(app.status) ? new Date(appDate.getTime() + 10 * 60 * 1000) : null;
    const completedTime = app.status === 'COMPLETED' ? appEndDate : null;

    // 1. Tạo Lịch hẹn (Appointment) kèm đầy đủ thông tin Phòng khám (room_id, room_code, room_name_snapshot)
    const appRes = await clients.appointment.query(
      `INSERT INTO appointments (
        id, appointment_code, patient_id, service_id, channel, selection_mode,
        requested_doctor_id, requested_rank_code, assigned_doctor_id, assigned_rank_code,
        specialty_id, room_id, room_code, room_name_snapshot,
        start_at, end_at, status, service_name_snapshot, service_version,
        base_price_id, base_amount_minor, rank_surcharge_price_id, rank_surcharge_amount_minor,
        estimated_total_minor, currency, availability_version, queue_estimate_minutes,
        checked_in_at, clinical_started_at, completed_at, cancellation_reason, reschedule_count,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $24, $25, $26,
        $11, $12, $13, $14, 1,
        $15, $16, $17, $18,
        $19, 'VND', 1, 15,
        $20, $21, $22, $23, 0,
        NOW(), NOW()
      ) RETURNING id`,
      [
        app.code, pat.id, srv.id, appChannel, appSelectionMode,
        requestedDoctor, requestedRank, doc.id, doc.rank,
        srv.specialtyId, appDate, appEndDate, app.status, srv.name,
        srv.priceId, baseAmount, rankInfo.id, surchargeAmount,
        totalAmount,
        checkedInTime, clinicalStartedTime, completedTime, app.cancellationReason || null,
        doc.roomId, doc.roomCode, doc.roomName
      ]
    );
    const appointmentId = appRes.rows[0].id;

    // 2. Tạo Hóa đơn (Billing Invoice & Lines & Payments & Credits)
    const invNumber = `INV-${app.code.replace('AT-', '')}`;
    const paidMinor = app.invoiceStatus === 'PAID' ? totalAmount : 0;
    const balanceMinor = (app.invoiceStatus === 'PAID' || app.invoiceStatus === 'CANCELLED') ? 0 : totalAmount;

    const invRes = await clients.billing.query(
      `INSERT INTO invoices (
        id, invoice_number, patient_id, appointment_id, type, status,
        currency, subtotal_minor, total_minor, paid_minor, balance_minor, source_version,
        due_at, paid_at, version, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'BASE', $4,
        'VND', $5, $5, $6, $7, 1,
        $8, $9, 1, NOW(), NOW()
      ) RETURNING id`,
      [
        invNumber, pat.id, appointmentId, app.invoiceStatus,
        totalAmount, paidMinor, balanceMinor,
        appDate, app.invoiceStatus === 'PAID' ? appDate : null,
      ]
    );
    const invoiceId = invRes.rows[0].id;

    // Dòng hóa đơn dịch vụ (Line 1: APPOINTMENT_SNAPSHOT)
    await clients.billing.query(
      `INSERT INTO invoice_lines (
        id, invoice_id, line_no, source, source_reference_id, service_id,
        description_snapshot, quantity, unit_amount_minor, line_amount_minor,
        price_reference_id, created_at
      ) VALUES (
        gen_random_uuid(), $1, 1, 'APPOINTMENT_SNAPSHOT', $2, $3,
        $4, 1, $5, $5,
        $6, NOW()
      )`,
      [invoiceId, appointmentId, srv.id, srv.name, baseAmount, srv.priceId]
    );

    // Dòng hóa đơn phụ thu bác sĩ (Line 2: APPOINTMENT_SNAPSHOT - nếu có)
    if (surchargeAmount > 0 && rankInfo.id) {
      await clients.billing.query(
        `INSERT INTO invoice_lines (
          id, invoice_id, line_no, source, source_reference_id, service_id,
          description_snapshot, quantity, unit_amount_minor, line_amount_minor,
          price_reference_id, created_at
        ) VALUES (
          gen_random_uuid(), $1, 2, 'APPOINTMENT_SNAPSHOT', gen_random_uuid(), $2,
          $3, 1, $4, $4,
          $5, NOW()
        )`,
        [invoiceId, srv.id, `Phụ thu chuyên môn: ${doc.title}`, surchargeAmount, rankInfo.id]
      );
    }

    // Ghi nhận Audit Log & Outbox khi phát hành hóa đơn gốc
    await clients.billing.query(
      `INSERT INTO billing_audit_logs (id, event_type, actor_id, invoice_id, reason, request_id, created_at)
       VALUES (gen_random_uuid(), 'billing.invoice_issued.v1', NULL, $1, $2, $3, NOW() - INTERVAL '15 minutes')`,
      [invoiceId, `Phát hành hóa đơn gốc ${invNumber} cho lịch hẹn ${app.code}`, crypto.randomUUID()]
    );

    await clients.billing.query(
      `INSERT INTO billing_outbox_events (id, event_type, aggregate_id, aggregate_version, payload, status, attempts, occurred_at, published_at)
       VALUES (gen_random_uuid(), 'billing.invoice_issued.v1', $1, 1, $2, 'PUBLISHED', 0, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '14 minutes')`,
      [invoiceId, JSON.stringify({ eventVersion: 1, aggregateType: 'invoice', aggregateId: invoiceId, data: { invoiceId, appointmentId, status: app.invoiceStatus } })]
    );

    await clients.billing.query(
      `INSERT INTO billing_idempotency_records (id, scope, key, request_hash, resource_id, response_status, response_body, created_at)
       VALUES (gen_random_uuid(), 'base-invoice', $1, $2, $3, 201, $4, NOW() - INTERVAL '15 minutes')`,
      [
        `base-inv-${appointmentId}`,
        sha256(`create_base_invoice_${appointmentId}`),
        invoiceId,
        JSON.stringify({ invoiceNumber: invNumber, appointmentId, totalMinor: totalAmount })
      ]
    );

    // 1. Kịch bản Đã thanh toán (PAID)
    if (app.invoiceStatus === 'PAID') {
      const isCash = (app.code === 'AT-2026-0001');
      const payMethod = isCash ? 'CASH' : 'MANUAL_BANK_TRANSFER';
      const refCode = isCash ? `REC-CASH-${app.code.replace('AT-', '')}` : `TXN-BANK-${app.code.replace('AT-', '')}`;

      const payRes = await clients.billing.query(
        `INSERT INTO payments (
          id, invoice_id, method, status, amount_minor, currency,
          received_at, verified_at, reference, recorded_by, version, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, 'VERIFIED', $3, 'VND',
          $4, $4, $5, $6, 1, NOW()
        ) RETURNING id`,
        [invoiceId, payMethod, totalAmount, appDate, refCode, receptionistList[0].id]
      );
      paymentId = payRes.rows[0].id;

      await clients.billing.query(
        `INSERT INTO billing_audit_logs (id, event_type, actor_id, invoice_id, reason, request_id, created_at)
         VALUES (gen_random_uuid(), 'billing.payment_recorded.v1', $1, $2, $3, $4, NOW() - INTERVAL '10 minutes')`,
        [receptionistList[0].id, invoiceId, `Xác nhận thanh toán ${payMethod} thành công số tiền ${totalAmount} VND`, crypto.randomUUID()]
      );
      await clients.billing.query(
        `INSERT INTO billing_outbox_events (id, event_type, aggregate_id, aggregate_version, payload, status, attempts, occurred_at, published_at)
         VALUES (gen_random_uuid(), 'billing.payment_recorded.v1', $1, 2, $2, 'PUBLISHED', 0, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '9 minutes')`,
        [invoiceId, JSON.stringify({ eventVersion: 1, aggregateType: 'invoice', aggregateId: invoiceId, data: { invoiceId, appointmentId, paymentId, status: 'PAID' } })]
      );

      await clients.billing.query(
        `INSERT INTO billing_idempotency_records (id, scope, key, request_hash, resource_id, response_status, response_body, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 201, $5, NOW() - INTERVAL '10 minutes')`,
        [
          `payment:${invoiceId}`,
          `pay-key-${invoiceId}`,
          sha256(`pay_${invoiceId}_${totalAmount}`),
          paymentId,
          JSON.stringify({ invoiceId, paymentId, amountMinor: totalAmount, status: 'VERIFIED' })
        ]
      );
    }
    // 2. Kịch bản Bảo lãnh viện phí (CREDIT_APPROVED - AT-2026-0002)
    else if (app.invoiceStatus === 'CREDIT_APPROVED') {
      await clients.billing.query(
        `INSERT INTO credit_approvals (
          id, invoice_id, status, reason_code, reason_text, approved_by, approved_at, version
        ) VALUES (
          gen_random_uuid(), $1, 'APPROVED', 'VIP_PARTNER_CORPORATE_SPONSORSHIP',
          'Chương trình bảo lãnh viện phí VIP cho cán bộ tập đoàn đối tác chiến lược An Tâm',
          $2, NOW() - INTERVAL '20 minutes', 1
        )`,
        [invoiceId, adminAccountId]
      );

      await clients.billing.query(
        `INSERT INTO billing_audit_logs (id, event_type, actor_id, invoice_id, reason, request_id, created_at)
         VALUES (gen_random_uuid(), 'billing.credit_approved.v1', $1, $2, $3, $4, NOW() - INTERVAL '20 minutes')`,
        [adminAccountId, invoiceId, 'Phê duyệt bảo lãnh viện phí thai sản VIP', crypto.randomUUID()]
      );
      await clients.billing.query(
        `INSERT INTO billing_outbox_events (id, event_type, aggregate_id, aggregate_version, payload, status, attempts, occurred_at, published_at)
         VALUES (gen_random_uuid(), 'billing.credit_approved.v1', $1, 2, $2, 'PUBLISHED', 0, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '19 minutes')`,
        [invoiceId, JSON.stringify({ eventVersion: 1, aggregateType: 'invoice', aggregateId: invoiceId, data: { invoiceId, appointmentId, status: 'CREDIT_APPROVED' } })]
      );
    }
    // 3. Kịch bản Chờ đối soát thanh toán (PAYMENT_PENDING_VERIFICATION - AT-2026-0006)
    else if (app.invoiceStatus === 'PAYMENT_PENDING_VERIFICATION') {
      const payRes = await clients.billing.query(
        `INSERT INTO payments (
          id, invoice_id, method, status, amount_minor, currency,
          received_at, verified_at, reference, recorded_by, version, created_at
        ) VALUES (
          gen_random_uuid(), $1, 'MANUAL_BANK_TRANSFER', 'RECORDED', $2, 'VND',
          NOW() - INTERVAL '30 minutes', NULL, $3, $4, 1, NOW()
        ) RETURNING id`,
        [invoiceId, totalAmount, `VCB-WAIT-${app.code.replace('AT-', '')}`, receptionistList[0].id]
      );
      paymentId = payRes.rows[0].id;

      await clients.billing.query(
        `INSERT INTO billing_audit_logs (id, event_type, actor_id, invoice_id, reason, request_id, created_at)
         VALUES (gen_random_uuid(), 'billing.payment_pending.v1', $1, $2, $3, $4, NOW() - INTERVAL '30 minutes')`,
        [receptionistList[0].id, invoiceId, 'Ghi nhận ủy nhiệm chi chuyển khoản ngân hàng, chờ xác thực sao kê', crypto.randomUUID()]
      );
      await clients.billing.query(
        `INSERT INTO billing_outbox_events (id, event_type, aggregate_id, aggregate_version, payload, status, attempts, occurred_at, published_at)
         VALUES (gen_random_uuid(), 'billing.payment_pending.v1', $1, 2, $2, 'PENDING', 0, NOW() - INTERVAL '30 minutes', NULL)`,
        [invoiceId, JSON.stringify({ eventVersion: 1, aggregateType: 'invoice', aggregateId: invoiceId, data: { invoiceId, appointmentId, status: 'PAYMENT_PENDING_VERIFICATION' } })]
      );
    }
    // 4. Kịch bản Nợ tồn đọng (OUTSTANDING: AT-2026-0007 Chuyển khoản bị từ chối; AT-2026-0008 Thu hồi bảo lãnh)
    else if (app.invoiceStatus === 'OUTSTANDING') {
      if (app.code === 'AT-2026-0007') {
        const payRes = await clients.billing.query(
          `INSERT INTO payments (
            id, invoice_id, method, status, amount_minor, currency,
            received_at, verified_at, reference, recorded_by, version, created_at
          ) VALUES (
            gen_random_uuid(), $1, 'MANUAL_BANK_TRANSFER', 'REJECTED', $2, 'VND',
            NOW() - INTERVAL '2 hours', NULL, $3, $4, 2, NOW()
          ) RETURNING id`,
          [invoiceId, totalAmount, `BIDV-REJ-${app.code.replace('AT-', '')}`, receptionistList[1].id]
        );
        paymentId = payRes.rows[0].id;

        await clients.billing.query(
          `INSERT INTO billing_audit_logs (id, event_type, actor_id, invoice_id, reason, request_id, created_at)
           VALUES (gen_random_uuid(), 'billing.payment_rejected.v1', $1, $2, $3, $4, NOW() - INTERVAL '1 hour')`,
          [receptionistList[1].id, invoiceId, 'Giao dịch chuyển khoản bị từ chối do sai cú pháp mã lịch hẹn và không nhận được tiền', crypto.randomUUID()]
        );
      } else if (app.code === 'AT-2026-0008') {
        await clients.billing.query(
          `INSERT INTO credit_approvals (
            id, invoice_id, status, reason_code, reason_text, approved_by, approved_at, revoked_at, version
          ) VALUES (
            gen_random_uuid(), $1, 'REVOKED', 'INSURANCE_PRE_AUTH_REJECTED',
            'Công ty bảo hiểm từ chối cấp chứng thư bảo lãnh trực tiếp, chuyển sang hình thức thai phụ tự thanh toán hoàn tiền sau',
            $2, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour', 2
          )`,
          [invoiceId, adminAccountId]
        );

        await clients.billing.query(
          `INSERT INTO billing_audit_logs (id, event_type, actor_id, invoice_id, reason, request_id, created_at)
           VALUES (gen_random_uuid(), 'billing.credit_revoked.v1', $1, $2, $3, $4, NOW() - INTERVAL '1 hour')`,
          [adminAccountId, invoiceId, 'Thu hồi bảo lãnh viện phí do hồ sơ bảo lãnh ngoài mạng lưới không hợp lệ', crypto.randomUUID()]
        );
      }
    }
    // 5. Kịch bản Hủy hóa đơn (CANCELLED - AT-2026-0011)
    else if (app.invoiceStatus === 'CANCELLED') {
      await clients.billing.query(
        `INSERT INTO billing_audit_logs (id, event_type, actor_id, invoice_id, reason, request_id, created_at)
         VALUES (gen_random_uuid(), 'billing.invoice_cancelled.v1', $1, $2, $3, $4, NOW() - INTERVAL '24 hours')`,
        [receptionistList[1].id, invoiceId, 'Hủy hóa đơn do thai phụ thông báo hủy lịch hẹn trước giờ khám', crypto.randomUUID()]
      );
    }

    // 3. Khám lâm sàng (Clinical Encounter) bao phủ đầy đủ cả 5 trạng thái
    const shouldCreateEncounter = (
      app.status === 'COMPLETED' ||
      app.status === 'IN_CLINICAL_CARE' ||
      app.status === 'CHECKED_IN' ||
      app.code === 'AT-2026-0006'
    );

    if (shouldCreateEncounter) {
      let encState = 'DRAFT';
      let reviewReadyTime = null;
      let startedTime = null;
      let finalizedTime = null;

      if (app.code === 'AT-2026-0001') {
        encState = 'IN_PROGRESS';
        startedTime = appDate;
      } else if (app.code === 'AT-2026-0002') {
        encState = 'AWAITING_RESULTS';
        startedTime = appDate;
      } else if (app.code === 'AT-2026-0003') {
        encState = 'READY_FOR_REVIEW';
        startedTime = appDate;
        reviewReadyTime = new Date(appDate.getTime() + 25 * 60 * 1000);
      } else if (app.status === 'COMPLETED') {
        encState = 'FINALIZED';
        startedTime = appDate;
        reviewReadyTime = new Date(appDate.getTime() + 25 * 60 * 1000);
        finalizedTime = appEndDate;
      }

      const encRes = await clients.medicalRecord.query(
        `INSERT INTO clinical_encounters (
          id, appointment_id, patient_id, pregnancy_episode_id, primary_doctor_id,
          state, chief_complaint, clinical_summary, started_at, review_ready_at, finalized_at,
          version, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, $6, $7, $8, $9, $10,
          1, NOW(), NOW()
        ) RETURNING id`,
        [
          appointmentId, pat.id, pat.pregnancyEpisodeId, doc.id,
          encState, app.complaint, app.summary,
          startedTime, reviewReadyTime, finalizedTime,
        ]
      );
      encounterId = encRes.rows[0].id;

      // Cập nhật encounter_id ngược lại appointment
      await clients.appointment.query(`UPDATE appointments SET encounter_id = $1 WHERE id = $2`, [encounterId, appointmentId]);

      // Sinh hiệu (Vital signs)
      if (app.vitals) {
        await clients.medicalRecord.query(
          `INSERT INTO vital_signs (
            id, encounter_id, systolic, diastolic, heart_rate, temperature, weight, recorded_by, recorded_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW()
          )`,
          [encounterId, app.vitals.sys, app.vitals.dia, app.vitals.hr, app.vitals.temp, app.vitals.weight, nurseAccountId]
        );
      }

      // Ghi chú lâm sàng (Clinical Notes)
      if (app.summary) {
        await clients.medicalRecord.query(
          `INSERT INTO clinical_notes (id, encounter_id, text, author_id, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
          [encounterId, app.summary, doc.accountId]
        );
      }

      // Chẩn đoán (Diagnoses)
      if (app.diagnosis) {
        await clients.medicalRecord.query(
          `INSERT INTO diagnoses (id, encounter_id, code, description, doctor_id, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
          [encounterId, app.diagnosis.code, app.diagnosis.desc, doc.id]
        );
      }

      // Kê đơn thuốc (Prescription) nếu có thuốc
      if (app.medications && app.medications.length > 0) {
        const prescRes = await clients.prescription.query(
          `INSERT INTO prescriptions (
            id, encounter_id, patient_id, pregnancy_episode_id, prescribing_doctor_id,
            status, version, issued_at, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4,
            'ISSUED', 1, NOW(), NOW(), NOW()
          ) RETURNING id`,
          [encounterId, pat.id, pat.pregnancyEpisodeId, doc.id]
        );
        prescriptionId = prescRes.rows[0].id;

        let medSort = 1;
        for (const medCode of app.medications) {
          const med = medicationMap[medCode];
          if (med) {
            await clients.prescription.query(
              `INSERT INTO prescription_items (
                id, prescription_id, medication_code, medication_name, strength,
                dosage_form, route, dose, frequency, duration_days, instruction, sort_order
              ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4,
                $5, $6, $7, $8, 30, $9, $10
              )`,
              [prescriptionId, med.code, med.name, med.strength, med.dosageForm, med.route, med.dose, med.freq, med.instruction, medSort++]
            );
          }
        }
      }

      // 4. Hàng đợi phòng khám (Queue Journey & Stage Tickets) cho lịch khám hôm nay
      if (app.dayOffset === 0) {
        const businessDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (app.code === 'AT-2026-0001') {
          // Lịch 1: Nguyễn Minh Anh - Khám VIP đang diễn ra (ACTIVE)
          const jrnRes = await clients.queue.query(
            `INSERT INTO queue_journeys (id, appointment_id, patient_id, encounter_id, business_date, late_minutes, late_demoted, state, version, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, false, 'ACTIVE', 1, NOW(), NOW()) RETURNING id`,
            [appointmentId, pat.id, encounterId, businessDate]
          );
          journeyId = jrnRes.rows[0].id;

          // Vé 1: Sinh hiệu (VITALS - COMPLETED tại P.102)
          await clients.queue.query(
            `INSERT INTO stage_tickets (id, journey_id, stage_id, room_code, business_date, ordinal, ticket_code, state, base_priority, late_demotion, enqueue_sequence, call_count, called_at, service_started_at, completed_at, version, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, 'P.102', $3, 1, 'VIT-001', 'COMPLETED', 'ROUTINE', false, 1, 1, $4, $5, $6, 1, NOW(), NOW())`,
            [journeyId, stageMap['VITALS'], businessDate, new Date(appDate.getTime() - 25 * 60000), new Date(appDate.getTime() - 20 * 60000), new Date(appDate.getTime() - 10 * 60000)]
          );

          // Vé 2: Bác sĩ chuyên khoa (CONSULTATION - IN_SERVICE tại P.201)
          const t2Res = await clients.queue.query(
            `INSERT INTO stage_tickets (id, journey_id, stage_id, room_code, business_date, ordinal, ticket_code, state, base_priority, late_demotion, enqueue_sequence, call_count, called_at, service_started_at, version, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $6, $3, 1, 'CONS-001', 'IN_SERVICE', 'ROUTINE', false, 2, 1, $4, $5, 1, NOW(), NOW()) RETURNING id`,
            [journeyId, stageMap['CONSULTATION'], businessDate, appDate, new Date(appDate.getTime() + 2 * 60000), doc.roomCode]
          );
          ticketId = t2Res.rows[0].id;

          // Lần gọi vé (Call Attempt)
          await clients.queue.query(
            `INSERT INTO call_attempts (id, ticket_id, attempt_number, called_at, expires_at, outcome, caller_account_id, room_code)
             VALUES (gen_random_uuid(), $1, 1, $2, $3, 'ANSWERED', $4, $5)`,
            [ticketId, appDate, new Date(appDate.getTime() + 5 * 60000), doc.accountId, doc.roomCode]
          );

          // Bác sĩ chỉ định siêu âm 4D bổ sung trong phiên khám
          const ordRes = await clients.medicalRecord.query(
            `INSERT INTO clinical_service_orders (id, encounter_id, catalog_service_id, stage_code, ordered_by_doctor_id, required_result, billable_snapshot, status, version, created_at)
             VALUES (gen_random_uuid(), $1, $2, 'ULTRASOUND', $3, true, true, 'ORDERED', 1, NOW()) RETURNING id`,
            [encounterId, serviceMap['US_4D_5D'].id, doc.id]
          );

          // Vé 3: Siêu âm chẩn đoán (ULTRASOUND - WAITING tại P.301)
          await clients.queue.query(
            `INSERT INTO stage_tickets (id, journey_id, stage_id, room_code, source_order_id, business_date, ordinal, ticket_code, state, base_priority, late_demotion, enqueue_sequence, call_count, version, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, 'P.301', $3, $4, 1, 'US-001', 'WAITING', 'ROUTINE', false, 3, 0, 1, NOW(), NOW())`,
            [journeyId, stageMap['ULTRASOUND'], ordRes.rows[0].id, businessDate]
          );

        } else if (app.code === 'AT-2026-0002') {
          // Lịch 2: Trần Thị Thanh Hằng - ĐẾN MUỘN 45 phút (lateDemoted = true, trạng thái CALLED)
          const jrnRes = await clients.queue.query(
            `INSERT INTO queue_journeys (id, appointment_id, patient_id, encounter_id, business_date, late_minutes, late_demoted, state, version, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 45, true, 'ACTIVE', 1, NOW(), NOW()) RETURNING id`,
            [appointmentId, pat.id, encounterId, businessDate]
          );
          journeyId = jrnRes.rows[0].id;

          // Vé 1: Đo sinh hiệu (VITALS - COMPLETED tại P.102)
          await clients.queue.query(
            `INSERT INTO stage_tickets (id, journey_id, stage_id, room_code, business_date, ordinal, ticket_code, state, base_priority, late_demotion, enqueue_sequence, call_count, service_started_at, completed_at, version, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, 'P.102', $3, 2, 'VIT-002', 'COMPLETED', 'ROUTINE', true, 4, 1, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '5 minutes', 1, NOW(), NOW())`,
            [journeyId, stageMap['VITALS'], businessDate]
          );

          // Vé 2: Phòng khám Bác sĩ (CONSULTATION - CALLED tại P.202)
          const callExp = new Date(now.getTime() + 4 * 60000);
          const t2Res = await clients.queue.query(
            `INSERT INTO stage_tickets (id, journey_id, stage_id, room_code, business_date, ordinal, ticket_code, state, base_priority, late_demotion, enqueue_sequence, call_count, called_at, call_expires_at, version, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $5, $3, 2, 'CONS-002', 'CALLED', 'ROUTINE', true, 5, 1, NOW() - INTERVAL '1 minute', $4, 1, NOW(), NOW()) RETURNING id`,
            [journeyId, stageMap['CONSULTATION'], businessDate, callExp, doc.roomCode]
          );
          ticketId = t2Res.rows[0].id;

          // Lần gọi vé (Call Attempt đang chờ bệnh nhân bước vào)
          await clients.queue.query(
            `INSERT INTO call_attempts (id, ticket_id, attempt_number, called_at, expires_at, outcome, caller_account_id, room_code)
             VALUES (gen_random_uuid(), $1, 1, NOW() - INTERVAL '1 minute', $2, 'CALLING', $3, $4)`,
            [ticketId, callExp, doc.accountId, doc.roomCode]
          );

        } else if (app.code === 'AT-2026-0003') {
          // Lịch 3: Lê Ngọc Mai - Hoàn tất mọi khâu (Journey COMPLETED)
          const jrnRes = await clients.queue.query(
            `INSERT INTO queue_journeys (id, appointment_id, patient_id, encounter_id, business_date, late_minutes, late_demoted, state, version, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, false, 'COMPLETED', 1, NOW(), NOW()) RETURNING id`,
            [appointmentId, pat.id, encounterId, businessDate]
          );
          journeyId = jrnRes.rows[0].id;

          // Vé 1: Đo sinh hiệu (VITALS - COMPLETED tại P.102)
          await clients.queue.query(
            `INSERT INTO stage_tickets (id, journey_id, stage_id, room_code, business_date, ordinal, ticket_code, state, base_priority, late_demotion, enqueue_sequence, call_count, completed_at, version, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, 'P.102', $3, 3, 'VIT-003', 'COMPLETED', 'ROUTINE', false, 6, 1, NOW() - INTERVAL '105 minutes', 1, NOW(), NOW())`,
            [journeyId, stageMap['VITALS'], businessDate]
          );

          // Vé 2: Khám Bác sĩ (CONSULTATION - COMPLETED tại P.206)
          const t2Res = await clients.queue.query(
            `INSERT INTO stage_tickets (id, journey_id, stage_id, room_code, business_date, ordinal, ticket_code, state, base_priority, late_demotion, enqueue_sequence, call_count, called_at, service_started_at, completed_at, version, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $4, $3, 3, 'CONS-003', 'COMPLETED', 'ROUTINE', false, 7, 1, NOW() - INTERVAL '105 minutes', NOW() - INTERVAL '100 minutes', NOW() - INTERVAL '70 minutes', 1, NOW(), NOW()) RETURNING id`,
            [journeyId, stageMap['CONSULTATION'], businessDate, doc.roomCode]
          );
          ticketId = t2Res.rows[0].id;

          await clients.queue.query(
            `INSERT INTO call_attempts (id, ticket_id, attempt_number, called_at, expires_at, outcome, caller_account_id, room_code)
             VALUES (gen_random_uuid(), $1, 1, NOW() - INTERVAL '105 minutes', NOW() - INTERVAL '100 minutes', 'ANSWERED', $2, $3)`,
            [ticketId, doc.accountId, doc.roomCode]
          );

          // Chỉ định xét nghiệm OGTT
          const ordRes = await clients.medicalRecord.query(
            `INSERT INTO clinical_service_orders (id, encounter_id, catalog_service_id, stage_code, ordered_by_doctor_id, required_result, billable_snapshot, status, version, created_at)
             VALUES (gen_random_uuid(), $1, $2, 'LAB_SAMPLE', $3, true, true, 'VERIFIED', 1, NOW()) RETURNING id`,
            [encounterId, serviceMap['OGTT_DIABETES'].id, doc.id]
          );

          // Vé 3: Xét nghiệm máu OGTT (LAB_SAMPLE - COMPLETED tại P.105)
          await clients.queue.query(
            `INSERT INTO stage_tickets (id, journey_id, stage_id, room_code, source_order_id, business_date, ordinal, ticket_code, state, base_priority, late_demotion, enqueue_sequence, call_count, service_started_at, completed_at, version, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, 'P.105', $3, $4, 1, 'LAB-001', 'COMPLETED', 'ROUTINE', false, 8, 1, NOW() - INTERVAL '65 minutes', NOW() - INTERVAL '25 minutes', 1, NOW(), NOW())`,
            [journeyId, stageMap['LAB_SAMPLE'], ordRes.rows[0].id, businessDate]
          );

          // Vé 4: Nhà thuốc (PHARMACY - COMPLETED tại P.109)
          await clients.queue.query(
            `INSERT INTO stage_tickets (id, journey_id, stage_id, room_code, business_date, ordinal, ticket_code, state, base_priority, late_demotion, enqueue_sequence, call_count, service_started_at, completed_at, version, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, 'P.109', $3, 1, 'PHARM-001', 'COMPLETED', 'ROUTINE', false, 9, 1, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '10 minutes', 1, NOW(), NOW())`,
            [journeyId, stageMap['PHARMACY'], businessDate]
          );
        }
      }
    }

    seededAppointments.push({
      code: app.code,
      appointmentId,
      patientId: pat.id,
      patientName: pat.fullName,
      serviceId: srv.id,
      doctorId: doc.id,
      status: app.status,
      appDate,
      appEndDate,
      cancellationReason: app.cancellationReason || null,
      invoiceId,
      paymentId,
      encounterId,
      journeyId,
      ticketId,
      prescriptionId,
    });
  }

  // ============================================================================
  // APPOINTMENT DỮ LIỆU ĐẦY ĐỦ: SLOT HOLDS, PHÂN CÔNG BÁC SĨ, AUDIT, OUTBOX & IDEMPOTENCY
  // ============================================================================
  // 1. Giữ chỗ (SlotHold) đầy đủ 4 trạng thái: CONSUMED, ACTIVE, EXPIRED, RELEASED kèm thông tin phòng khám
  const hold1Res = await clients.appointment.query(
    `INSERT INTO slot_holds (
      id, patient_id, service_id, doctor_id, rank_code, selection_mode,
      room_id, room_code, room_name,
      start_at, end_at, status, expires_at, consumed_by_appointment_id, created_at
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, 'DOCTOR',
      $9, $10, $11,
      $5, $6, 'CONSUMED', $7, $8, NOW() - INTERVAL '15 minutes'
    ) RETURNING id`,
    [
      seededAppointments[0].patientId, seededAppointments[0].serviceId, seededAppointments[0].doctorId,
      doctorList[0].rank, seededAppointments[0].appDate, seededAppointments[0].appEndDate,
      new Date(seededAppointments[0].appDate.getTime() + 5 * 60 * 1000), seededAppointments[0].appointmentId,
      doctorList[0].roomId, doctorList[0].roomCode, doctorList[0].roomName
    ]
  );
  const hold1Id = hold1Res.rows[0].id;

  const hold2Res = await clients.appointment.query(
    `INSERT INTO slot_holds (
      id, patient_id, service_id, doctor_id, rank_code, selection_mode,
      room_id, room_code, room_name,
      start_at, end_at, status, expires_at, consumed_by_appointment_id, created_at
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, 'DOCTOR',
      $7, $8, $9,
      $5, $6, 'ACTIVE', NOW() + INTERVAL '5 minutes', NULL, NOW()
    ) RETURNING id`,
    [
      patientList[5].id, serviceMap['PRENATAL_ROUTINE'].id, doctorList[2].id,
      doctorList[2].rank, new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      doctorList[2].roomId, doctorList[2].roomCode, doctorList[2].roomName
    ]
  );
  const hold2Id = hold2Res.rows[0].id;

  const hold3Res = await clients.appointment.query(
    `INSERT INTO slot_holds (
      id, patient_id, service_id, doctor_id, rank_code, selection_mode,
      room_id, room_code, room_name,
      start_at, end_at, status, expires_at, consumed_by_appointment_id, created_at
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, 'RANK',
      $7, $8, $9,
      $5, $6, 'EXPIRED', NOW() - INTERVAL '30 minutes', NULL, NOW() - INTERVAL '35 minutes'
    ) RETURNING id`,
    [
      patientList[7].id, serviceMap['US_2D'].id, doctorList[6].id,
      'BS', new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      doctorList[6].roomId, doctorList[6].roomCode, doctorList[6].roomName
    ]
  );
  const hold3Id = hold3Res.rows[0].id;

  const hold4Res = await clients.appointment.query(
    `INSERT INTO slot_holds (
      id, patient_id, service_id, doctor_id, rank_code, selection_mode,
      room_id, room_code, room_name,
      start_at, end_at, status, expires_at, consumed_by_appointment_id, created_at
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, 'RANK',
      $7, $8, $9,
      $5, $6, 'RELEASED', NOW() + INTERVAL '2 minutes', NULL, NOW() - INTERVAL '10 minutes'
    ) RETURNING id`,
    [
      patientList[8].id, serviceMap['PRENATAL_VIP'].id, doctorList[5].id,
      'CKI', new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      doctorList[5].roomId, doctorList[5].roomCode, doctorList[5].roomName
    ]
  );
  const hold4Id = hold4Res.rows[0].id;

  // 2. Lịch sử điều chuyển bác sĩ (Appointment Assignment History)
  await clients.appointment.query(
    `INSERT INTO appointment_assignment_history (id, appointment_id, from_doctor_id, to_doctor_id, rank_code, reason, actor_id, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW() - INTERVAL '1 hour')`,
    [
      seededAppointments[5].appointmentId, doctorList[0].id, doctorList[2].id,
      doctorList[2].rank, 'BS. Lê Thu Hà có ca phẫu thuật cấp cứu mổ đẻ lấy thai | Đã trao đổi qua điện thoại và thai phụ đồng ý đổi bác sĩ',
      receptionistList[0].accountId
    ]
  );
  await clients.appointment.query(
    `INSERT INTO appointment_assignment_history (id, appointment_id, from_doctor_id, to_doctor_id, rank_code, reason, actor_id, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW() - INTERVAL '2 hours')`,
    [
      seededAppointments[7].appointmentId, doctorList[2].id, doctorList[6].id,
      doctorList[6].rank, 'Điều phối cân bằng tải phòng khám chuyên khoa siêu âm buổi chiều | Xác nhận qua ứng dụng di động',
      receptionistList[1].accountId
    ]
  );

  // 3. Nhật ký kiểm toán Lịch hẹn (Appointment Audit Logs)
  const appAuditLogs = [
    {
      eventType: 'appointment.booked.v1',
      actorId: patientList[0].accountId,
      resourceId: seededAppointments[0].appointmentId,
      reason: 'Thai phụ đặt lịch khám thai VIP trực tuyến qua cổng Portal',
      requestId: crypto.randomUUID(),
    },
    {
      eventType: 'appointment.checked_in.v1',
      actorId: receptionistList[0].accountId,
      resourceId: seededAppointments[0].appointmentId,
      reason: 'Tiếp đón tại quầy T1, xác nhận BHYT và hoàn tất thủ tục check-in',
      requestId: crypto.randomUUID(),
    },
    {
      eventType: 'appointment.clinical_started.v1',
      actorId: doctorList[0].accountId,
      resourceId: seededAppointments[0].appointmentId,
      reason: 'Bác sĩ bắt đầu phiên khám lâm sàng thai 22 tuần',
      requestId: crypto.randomUUID(),
    },
    {
      eventType: 'appointment.completed.v1',
      actorId: doctorList[5].accountId,
      resourceId: seededAppointments[2].appointmentId,
      reason: 'Hoàn tất khám nghiệm pháp dung nạp đường huyết và tư vấn dinh dưỡng',
      requestId: crypto.randomUUID(),
    },
    {
      eventType: 'appointment.reassigned.v1',
      actorId: receptionistList[0].accountId,
      resourceId: seededAppointments[5].appointmentId,
      reason: 'Điều chuyển bác sĩ phụ trách ca khám do trùng lịch phẫu thuật khẩn cấp',
      requestId: crypto.randomUUID(),
    },
    {
      eventType: 'appointment.cancelled.v1',
      actorId: receptionistList[1].accountId,
      resourceId: seededAppointments[10].appointmentId,
      reason: 'Thai phụ bận công tác đột xuất, gọi điện xin hủy lịch hẹn',
      requestId: crypto.randomUUID(),
    },
    {
      eventType: 'appointment.no_show.v1',
      actorId: receptionistList[0].accountId,
      resourceId: seededAppointments[11].appointmentId,
      reason: 'Bệnh nhân vắng mặt quá 60 phút sau thời gian hẹn khám',
      requestId: crypto.randomUUID(),
    },
  ];

  for (const log of appAuditLogs) {
    await clients.appointment.query(
      `INSERT INTO appointment_audit_logs (id, event_type, actor_id, resource_id, reason, request_id, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
      [log.eventType, log.actorId, log.resourceId, log.reason, log.requestId]
    );
  }

  // 4. Sự kiện Outbox cho Lịch hẹn (Appointment Outbox Events)
  const appOutboxEvents = [
    {
      eventType: 'appointment.booked.v1',
      aggregateId: seededAppointments[0].appointmentId,
      aggregateVersion: 1,
      payload: {
        eventVersion: 1,
        aggregateType: 'appointment',
        aggregateId: seededAppointments[0].appointmentId,
        data: {
          appointmentId: seededAppointments[0].appointmentId,
          appointmentCode: seededAppointments[0].code,
          patientId: seededAppointments[0].patientId,
          status: 'BOOKED',
          startAt: seededAppointments[0].appDate,
        },
      },
      status: 'PUBLISHED',
      publishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
    {
      eventType: 'appointment.checked_in.v1',
      aggregateId: seededAppointments[0].appointmentId,
      aggregateVersion: 2,
      payload: {
        eventVersion: 1,
        aggregateType: 'appointment',
        aggregateId: seededAppointments[0].appointmentId,
        data: {
          appointmentId: seededAppointments[0].appointmentId,
          patientId: seededAppointments[0].patientId,
          status: 'CHECKED_IN',
          checkedInAt: seededAppointments[0].appDate,
        },
      },
      status: 'PUBLISHED',
      publishedAt: new Date(now.getTime() - 30 * 60 * 1000),
    },
    {
      eventType: 'appointment.completed.v1',
      aggregateId: seededAppointments[2].appointmentId,
      aggregateVersion: 3,
      payload: {
        eventVersion: 1,
        aggregateType: 'appointment',
        aggregateId: seededAppointments[2].appointmentId,
        data: {
          appointmentId: seededAppointments[2].appointmentId,
          patientId: seededAppointments[2].patientId,
          status: 'COMPLETED',
          completedAt: seededAppointments[2].appEndDate,
        },
      },
      status: 'PUBLISHED',
      publishedAt: new Date(now.getTime() - 10 * 60 * 1000),
    },
    {
      eventType: 'appointment.reassigned.v1',
      aggregateId: seededAppointments[5].appointmentId,
      aggregateVersion: 2,
      payload: {
        eventVersion: 1,
        aggregateType: 'appointment',
        aggregateId: seededAppointments[5].appointmentId,
        data: {
          appointmentId: seededAppointments[5].appointmentId,
          patientId: seededAppointments[5].patientId,
          fromDoctorId: doctorList[0].id,
          toDoctorId: doctorList[2].id,
          status: 'BOOKED',
        },
      },
      status: 'PUBLISHED',
      publishedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
    },
    {
      eventType: 'appointment.cancelled.v1',
      aggregateId: seededAppointments[10].appointmentId,
      aggregateVersion: 2,
      payload: {
        eventVersion: 1,
        aggregateType: 'appointment',
        aggregateId: seededAppointments[10].appointmentId,
        data: {
          appointmentId: seededAppointments[10].appointmentId,
          patientId: seededAppointments[10].patientId,
          status: 'CANCELLED',
          cancellationReason: seededAppointments[10].cancellationReason,
        },
      },
      status: 'PUBLISHED',
      publishedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    },
    {
      eventType: 'appointment.no_show.v1',
      aggregateId: seededAppointments[11].appointmentId,
      aggregateVersion: 2,
      payload: {
        eventVersion: 1,
        aggregateType: 'appointment',
        aggregateId: seededAppointments[11].appointmentId,
        data: {
          appointmentId: seededAppointments[11].appointmentId,
          patientId: seededAppointments[11].patientId,
          status: 'NO_SHOW',
        },
      },
      status: 'PENDING',
      publishedAt: null,
    },
  ];

  for (const ob of appOutboxEvents) {
    await clients.appointment.query(
      `INSERT INTO appointment_outbox_events (id, event_type, aggregate_id, aggregate_version, payload, status, attempts, occurred_at, published_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 0, NOW(), $6)`,
      [ob.eventType, ob.aggregateId, ob.aggregateVersion, JSON.stringify(ob.payload), ob.status, ob.publishedAt]
    );
  }

  // 5. Bản ghi kiểm soát lặp lại (Appointment Idempotency Records)
  const appRecords = [
    {
      scope: 'create-appointment',
      key: `idemp-create-app-${seededAppointments[0].appointmentId}`,
      hash: sha256(`create_app_${seededAppointments[0].code}`),
      resourceId: seededAppointments[0].appointmentId,
      status: 201,
      body: { appointmentId: seededAppointments[0].appointmentId, appointmentCode: seededAppointments[0].code, status: 'BOOKED' },
    },
    {
      scope: 'create-hold',
      key: `idemp-hold-${hold1Id}`,
      hash: sha256(`create_hold_${hold1Id}`),
      resourceId: hold1Id,
      status: 201,
      body: { holdId: hold1Id, status: 'CONSUMED' },
    },
    {
      scope: 'appointment.reassigned.v1',
      key: `idemp-reassign-${seededAppointments[5].appointmentId}`,
      hash: sha256(`reassign_${seededAppointments[5].appointmentId}`),
      resourceId: seededAppointments[5].appointmentId,
      status: 200,
      body: { appointmentId: seededAppointments[5].appointmentId, assignedDoctorId: doctorList[2].id, status: 'BOOKED' },
    },
  ];

  for (const idemp of appRecords) {
    await clients.appointment.query(
      `INSERT INTO appointment_idempotency_records (id, scope, key, request_hash, resource_id, response_status, response_body, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`,
      [idemp.scope, idemp.key, idemp.hash, idemp.resourceId, idemp.status, JSON.stringify(idemp.body)]
    );
  }

  console.log(`✅ Đã khởi tạo 12 Lịch hẹn (Tất cả 7 trạng thái, 3 kênh, 2 chế độ chọn), 4 Giữ chỗ (Tất cả trạng thái), Lịch sử phân công, Audit Logs, Outbox và Idempotency.`);

  // ============================================================================
  // BƯỚC 9.0: HÓA ĐƠN BỔ SUNG PHÁT SINH LÂM SÀNG (SUPPLEMENTARY INVOICES & PERFORMED SERVICES)
  // ============================================================================
  console.log('\n--- BƯỚC 9.0: KHỞI TẠO HÓA ĐƠN BỔ SUNG PHÁT SINH LÂM SÀNG (BILLING SUPPLEMENTARY) ---');

  // 1. Hóa đơn bổ sung 1 cho Lịch hẹn AT-2026-0001 (Nguyễn Minh Anh - COMPLETED)
  // Phát sinh thêm: Siêu âm hình thái thai nhi 4D/5D Doppler màu HD-Live (US_4D_5D - 650.000đ)
  const supp1Srv = serviceMap['US_4D_5D'];
  const supp1Amount = supp1Srv.price;
  const supp1App = seededAppointments[0];

  const supp1Res = await clients.billing.query(
    `INSERT INTO invoices (
      id, invoice_number, patient_id, appointment_id, encounter_id, type, status,
      currency, subtotal_minor, total_minor, paid_minor, balance_minor, source_version,
      due_at, paid_at, version, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), 'INV-2026-SUPP-01', $1, $2, $3, 'SUPPLEMENTARY', 'PAID',
      'VND', $4, $4, $4, 0, 1,
      NOW(), NOW(), 2, NOW() - INTERVAL '20 minutes', NOW()
    ) RETURNING id`,
    [supp1App.patientId, supp1App.appointmentId, supp1App.encounterId, supp1Amount]
  );
  const supp1Id = supp1Res.rows[0].id;

  // Dòng chi phí lâm sàng thực hiện (PERFORMED_SERVICE)
  await clients.billing.query(
    `INSERT INTO invoice_lines (
      id, invoice_id, line_no, source, source_reference_id, service_id,
      description_snapshot, quantity, unit_amount_minor, line_amount_minor,
      price_reference_id, performed_at, created_at
    ) VALUES (
      gen_random_uuid(), $1, 1, 'PERFORMED_SERVICE', gen_random_uuid(), $2,
      $3, 1, $4, $4,
      $5, NOW() - INTERVAL '25 minutes', NOW()
    )`,
    [supp1Id, supp1Srv.id, `Chỉ định lâm sàng bổ sung: ${supp1Srv.name}`, supp1Amount, supp1Srv.priceId]
  );

  // Thanh toán tiền mặt bổ sung
  const supp1PayRes = await clients.billing.query(
    `INSERT INTO payments (
      id, invoice_id, method, status, amount_minor, currency,
      received_at, verified_at, reference, recorded_by, version, created_at
    ) VALUES (
      gen_random_uuid(), $1, 'CASH', 'VERIFIED', $2, 'VND',
      NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes', 'REC-SUPP-CASH-0001', $3, 1, NOW()
    ) RETURNING id`,
    [supp1Id, supp1Amount, receptionistList[0].id]
  );

  await clients.billing.query(
    `INSERT INTO billing_audit_logs (id, event_type, actor_id, invoice_id, reason, request_id, created_at)
     VALUES (gen_random_uuid(), 'billing.invoice_issued.v1', NULL, $1, 'Phát hành hóa đơn bổ sung dịch vụ siêu âm 4D chỉ định trong phiên khám', $2, NOW() - INTERVAL '20 minutes')`,
    [supp1Id, crypto.randomUUID()]
  );
  await clients.billing.query(
    `INSERT INTO billing_audit_logs (id, event_type, actor_id, invoice_id, reason, request_id, created_at)
     VALUES (gen_random_uuid(), 'billing.payment_recorded.v1', $1, $2, 'Thu tiền mặt bổ sung tại phòng khám cho dịch vụ siêu âm 4D', $3, NOW() - INTERVAL '15 minutes')`,
    [receptionistList[0].id, supp1Id, crypto.randomUUID()]
  );
  await clients.billing.query(
    `INSERT INTO billing_outbox_events (id, event_type, aggregate_id, aggregate_version, payload, status, attempts, occurred_at, published_at)
     VALUES (gen_random_uuid(), 'billing.payment_recorded.v1', $1, 2, $2, 'PUBLISHED', 0, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '14 minutes')`,
    [supp1Id, JSON.stringify({ eventVersion: 1, aggregateType: 'invoice', aggregateId: supp1Id, data: { invoiceId: supp1Id, type: 'SUPPLEMENTARY', status: 'PAID' } })]
  );

  await clients.billing.query(
    `INSERT INTO billing_idempotency_records (id, scope, key, request_hash, resource_id, response_status, response_body, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 201, $5, NOW() - INTERVAL '15 minutes')`,
    [
      `payment:${supp1Id}`,
      `supp-pay-key-${supp1Id}`,
      sha256(`supp_pay_${supp1Id}_${supp1Amount}`),
      supp1PayRes.rows[0].id,
      JSON.stringify({ invoiceId: supp1Id, paymentId: supp1PayRes.rows[0].id, amountMinor: supp1Amount, status: 'VERIFIED' })
    ]
  );

  // 2. Hóa đơn bổ sung 2 cho Lịch hẹn AT-2026-0002 (Trần Thị Thanh Hằng - CHECKED_IN / Đang khám lâm sàng)
  // Phát sinh 2 dịch vụ lâm sàng:
  // - Xét nghiệm dung nạp đường huyết (OGTT_DIABETES - 350.000đ)
  // - Siêu âm thai 2D (US_2D - 250.000đ)
  // Trạng thái: OUTSTANDING (chưa thanh toán, chờ hoàn thành đợt khám)
  const supp2Srv1 = serviceMap['OGTT_DIABETES'];
  const supp2Srv2 = serviceMap['US_2D'];
  const supp2Total = supp2Srv1.price + supp2Srv2.price; // 600.000đ
  const supp2App = seededAppointments[1];

  const supp2Res = await clients.billing.query(
    `INSERT INTO invoices (
      id, invoice_number, patient_id, appointment_id, encounter_id, type, status,
      currency, subtotal_minor, total_minor, paid_minor, balance_minor, source_version,
      due_at, paid_at, version, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), 'INV-2026-SUPP-02', $1, $2, $3, 'SUPPLEMENTARY', 'OUTSTANDING',
      'VND', $4, $4, 0, $4, 1,
      NOW() + INTERVAL '1 day', NULL, 1, NOW() - INTERVAL '10 minutes', NOW()
    ) RETURNING id`,
    [supp2App.patientId, supp2App.appointmentId, supp2App.encounterId, supp2Total]
  );
  const supp2Id = supp2Res.rows[0].id;

  // Dòng 1: OGTT_DIABETES
  await clients.billing.query(
    `INSERT INTO invoice_lines (
      id, invoice_id, line_no, source, source_reference_id, service_id,
      description_snapshot, quantity, unit_amount_minor, line_amount_minor,
      price_reference_id, performed_at, created_at
    ) VALUES (
      gen_random_uuid(), $1, 1, 'PERFORMED_SERVICE', gen_random_uuid(), $2,
      $3, 1, $4, $4,
      $5, NOW() - INTERVAL '10 minutes', NOW()
    )`,
    [supp2Id, supp2Srv1.id, `Chỉ định lâm sàng: ${supp2Srv1.name}`, supp2Srv1.price, supp2Srv1.priceId]
  );

  // Dòng 2: US_2D
  await clients.billing.query(
    `INSERT INTO invoice_lines (
      id, invoice_id, line_no, source, source_reference_id, service_id,
      description_snapshot, quantity, unit_amount_minor, line_amount_minor,
      price_reference_id, performed_at, created_at
    ) VALUES (
      gen_random_uuid(), $1, 2, 'PERFORMED_SERVICE', gen_random_uuid(), $2,
      $3, 1, $4, $4,
      $5, NOW() - INTERVAL '5 minutes', NOW()
    )`,
    [supp2Id, supp2Srv2.id, `Chỉ định lâm sàng: ${supp2Srv2.name}`, supp2Srv2.price, supp2Srv2.priceId]
  );

  await clients.billing.query(
    `INSERT INTO billing_audit_logs (id, event_type, actor_id, invoice_id, reason, request_id, created_at)
     VALUES (gen_random_uuid(), 'billing.invoice_issued.v1', NULL, $1, 'Phát hành hóa đơn bổ sung các xét nghiệm chỉ định trong ca khám lâm sàng', $2, NOW() - INTERVAL '10 minutes')`,
    [supp2Id, crypto.randomUUID()]
  );
  await clients.billing.query(
    `INSERT INTO billing_outbox_events (id, event_type, aggregate_id, aggregate_version, payload, status, attempts, occurred_at, published_at)
     VALUES (gen_random_uuid(), 'billing.invoice_issued.v1', $1, 1, $2, 'PUBLISHED', 0, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '9 minutes')`,
    [supp2Id, JSON.stringify({ eventVersion: 1, aggregateType: 'invoice', aggregateId: supp2Id, data: { invoiceId: supp2Id, type: 'SUPPLEMENTARY', status: 'OUTSTANDING' } })]
  );

  console.log(`✅ Đã khởi tạo đầy đủ hệ thống Hóa đơn bổ sung (SUPPLEMENTARY), Chi phí lâm sàng (PERFORMED_SERVICE), Bảo lãnh viện phí, Thanh toán đa phương thức và Audit/Outbox.`);

  // ============================================================================
  // BƯỚC 9.05: TOÀN DIỆN HỆ THỐNG BỆNH ÁN LÂM SÀNG (MEDICAL RECORD SERVICE)
  // ============================================================================
  console.log('\n--- BƯỚC 9.05: KHỞI TẠO DỮ LIỆU TOÀN DIỆN BỆNH ÁN LÂM SÀNG (MEDICAL RECORD) ---');

  // 1. Hồ sơ thai kỳ tiền sử đã kết thúc thành công (CLOSED) cho Phạm Quỳnh Chi (Thai lần 1 cách đây 2 năm)
  const chiPatient = patientList[3]; // Phạm Quỳnh Chi
  const closedEdd = new Date(now.getFullYear() - 2, 5, 20);
  const closedLmp = new Date(closedEdd.getTime() - 280 * 24 * 60 * 60 * 1000);
  await clients.medicalRecord.query(
    `INSERT INTO pregnancy_episodes (
      id, patient_id, status, estimated_due_date, last_menstrual_period, risk_level, version, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1, 'CLOSED', $2, $3, 'LOW', 2, NOW() - INTERVAL '2 years', NOW() - INTERVAL '2 years'
    )`,
    [chiPatient.id, closedEdd, closedLmp]
  );

  // 2. Phân công nhân sự y tế tham gia ca khám (Encounter Assignments)
  const enc1Id = seededAppointments[0].encounterId; // Nguyễn Minh Anh - IN_PROGRESS
  const enc2Id = seededAppointments[1].encounterId; // Trần Thị Thanh Hằng - AWAITING_RESULTS
  const enc3Id = seededAppointments[2].encounterId; // Lê Ngọc Mai - READY_FOR_REVIEW
  const enc4Id = seededAppointments[3].encounterId; // Phạm Quỳnh Chi - FINALIZED
  const enc5Id = seededAppointments[4].encounterId; // Hoàng Thùy Dương - FINALIZED
  const enc6Id = seededAppointments[5].encounterId; // Vũ Thị Kim Ngân - DRAFT

  const assignmentsDef = [
    // Ca 1: Nguyễn Minh Anh (Khám VIP)
    { encId: enc1Id, staffId: doctorList[0].id, role: 'PRIMARY', status: 'ACTIVE', assignedAt: new Date(now.getTime() - 40 * 60000), endedAt: null },
    { encId: enc1Id, staffId: nurseAccountId, role: 'NURSE', status: 'ACTIVE', assignedAt: new Date(now.getTime() - 40 * 60000), endedAt: null },
    { encId: enc1Id, staffId: doctorList[1].id, role: 'CONSULTING', status: 'ACTIVE', assignedAt: new Date(now.getTime() - 25 * 60000), endedAt: null },
    { encId: enc1Id, staffId: receptionistList[0].accountId, role: 'TECHNICIAN', status: 'ACTIVE', assignedAt: new Date(now.getTime() - 25 * 60000), endedAt: null },
    { encId: enc1Id, staffId: doctorList[3].id, role: 'CONSULTING', status: 'ENDED', assignedAt: new Date(now.getTime() - 35 * 60000), endedAt: new Date(now.getTime() - 25 * 60000) },
    // Ca 2: Trần Thị Thanh Hằng (Siêu âm 4D)
    { encId: enc2Id, staffId: doctorList[1].id, role: 'PRIMARY', status: 'ACTIVE', assignedAt: new Date(now.getTime() - 30 * 60000), endedAt: null },
    { encId: enc2Id, staffId: nurseAccountId, role: 'NURSE', status: 'ACTIVE', assignedAt: new Date(now.getTime() - 30 * 60000), endedAt: null },
    // Ca 3: Lê Ngọc Mai (Nghiệm pháp OGTT)
    { encId: enc3Id, staffId: doctorList[5].id, role: 'PRIMARY', status: 'ACTIVE', assignedAt: new Date(now.getTime() - 50 * 60000), endedAt: null },
    // Ca 4: Phạm Quỳnh Chi (Khám tuần 34)
    { encId: enc4Id, staffId: doctorList[0].id, role: 'PRIMARY', status: 'ACTIVE', assignedAt: new Date(now.getTime() - 3 * 24 * 3600000), endedAt: null },
    // Ca 5: Hoàng Thùy Dương (NIPT Basic)
    { encId: enc5Id, staffId: doctorList[3].id, role: 'PRIMARY', status: 'ACTIVE', assignedAt: new Date(now.getTime() - 5 * 24 * 3600000), endedAt: null },
  ];

  for (const a of assignmentsDef) {
    if (a.encId) {
      await clients.medicalRecord.query(
        `INSERT INTO encounter_assignments (id, encounter_id, staff_id, role, status, assigned_at, ended_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
         ON CONFLICT (encounter_id, staff_id, role, status) DO NOTHING`,
        [a.encId, a.staffId, a.role, a.status, a.assignedAt, a.endedAt]
      );
    }
  }

  // 3. Chỉ định cận lâm sàng (Clinical Service Orders) đầy đủ cả 6/6 trạng thái
  const ordersDef = [
    // 1. ORDERED: Chỉ định Triple Test cho thai 12 tuần (Trần Thị Thanh Hằng)
    {
      encId: enc2Id,
      serviceId: serviceMap['TRIPLE_TEST'].id,
      stageCode: 'LAB_SAMPLE',
      doctorId: doctorList[1].id,
      status: 'ORDERED',
      result: null,
      perfAt: null,
      verAt: null,
    },
    // 2. IN_PROGRESS: Chỉ định Nghiệm pháp OGTT đang chạy mẫu (Nguyễn Minh Anh)
    {
      encId: enc1Id,
      serviceId: serviceMap['OGTT_DIABETES'].id,
      stageCode: 'LAB_SAMPLE',
      doctorId: doctorList[0].id,
      status: 'IN_PROGRESS',
      result: null,
      perfAt: null,
      verAt: null,
    },
    // 3. PERFORMED: Chỉ định Siêu âm 2D đã đo đạc xong (Phạm Quỳnh Chi)
    {
      encId: enc4Id,
      serviceId: serviceMap['US_2D'].id,
      stageCode: 'ULTRASOUND',
      doctorId: doctorList[0].id,
      status: 'PERFORMED',
      result: null,
      perfAt: new Date(now.getTime() - 3 * 24 * 3600000 + 15 * 60000),
      verAt: null,
    },
    // 4. RESULT_AVAILABLE: Nghiệm pháp OGTT đã có kết quả phân tích thô (Lê Ngọc Mai)
    {
      encId: enc3Id,
      serviceId: serviceMap['OGTT_DIABETES'].id,
      stageCode: 'LAB_SAMPLE',
      doctorId: doctorList[5].id,
      status: 'RESULT_AVAILABLE',
      result: {
        fastingGlucoseMmol: 4.8,
        glucosePost1hMmol: 8.2,
        glucosePost2hMmol: 7.1,
        normalThreshold: 'Đói < 5.1, Sau 1h < 10.0, Sau 2h < 8.5 mmol/L',
        interpretation: 'Dung nạp đường huyết trong giới hạn bình thường'
      },
      perfAt: new Date(now.getTime() - 30 * 60000),
      verAt: null,
    },
    // 5. VERIFIED: Siêu âm 4D hình thái thai nhi đã được bác sĩ ký duyệt (Nguyễn Minh Anh)
    {
      encId: enc1Id,
      serviceId: serviceMap['US_4D_5D'].id,
      stageCode: 'ULTRASOUND',
      doctorId: doctorList[0].id,
      status: 'VERIFIED',
      result: {
        gestationalAgeWeeks: '22w2d',
        biparietalDiameterMm: 54.2,
        femurLengthMm: 38.0,
        headCircumferenceMm: 198.5,
        abdominalCircumferenceMm: 178.5,
        estimatedFetalWeightGram: 495,
        fetalHeartRateBpm: 148,
        amnioticFluidIndexCm: 13.5,
        placentaLocation: 'Mặt sau nhóm 1, độ trưởng thành I',
        fetalAnatomy: 'Hình thái học não thất, tim 4 buồng, môi trên, cột sống, 2 thận, dạ dày, bàng quang và tứ chi đều bình thường, không phát hiện dị tật lớn'
      },
      perfAt: new Date(now.getTime() - 25 * 60000),
      verAt: new Date(now.getTime() - 15 * 60000),
    },
    // 6. CANCELLED: Double Test bị hủy do thai phụ đã làm NIPT (Hoàng Thùy Dương)
    {
      encId: enc5Id,
      serviceId: serviceMap['DOUBLE_TEST'].id,
      stageCode: 'LAB_SAMPLE',
      doctorId: doctorList[3].id,
      status: 'CANCELLED',
      result: { cancelReason: 'Thai phụ lựa chọn xét nghiệm NIPT Basic có độ chính xác cao hơn, hủy chỉ định Double Test sinh hóa thông thường' },
      perfAt: null,
      verAt: null,
    },
  ];

  let verifiedOrderId = null;
  for (const o of ordersDef) {
    if (o.encId) {
      const ordRes = await clients.medicalRecord.query(
        `INSERT INTO clinical_service_orders (
          id, encounter_id, catalog_service_id, stage_code, ordered_by_doctor_id,
          required_result, billable_snapshot, status, structured_result, performed_at, verified_at,
          version, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          true, true, $5, $6, $7, $8,
          1, NOW()
        ) RETURNING id`,
        [o.encId, o.serviceId, o.stageCode, o.doctorId, o.status, o.result ? JSON.stringify(o.result) : null, o.perfAt, o.verAt]
      );
      if (o.status === 'VERIFIED') {
        verifiedOrderId = ordRes.rows[0].id;
      }
    }
  }

  // 4. Liên kết tài nguyên ngoại vi (External Clinical References)
  if (enc1Id && seededAppointments[0].prescriptionId) {
    await clients.medicalRecord.query(
      `INSERT INTO external_clinical_references (id, encounter_id, resource_type, resource_id, created_at)
       VALUES (gen_random_uuid(), $1, 'PRESCRIPTION', $2, NOW())
       ON CONFLICT (resource_type, resource_id) DO NOTHING`,
      [enc1Id, seededAppointments[0].prescriptionId]
    );
  }
  if (enc1Id) {
    await clients.medicalRecord.query(
      `INSERT INTO external_clinical_references (id, encounter_id, resource_type, resource_id, created_at)
       VALUES (gen_random_uuid(), $1, 'DOCUMENT', gen_random_uuid(), NOW())
       ON CONFLICT (resource_type, resource_id) DO NOTHING`,
      [enc1Id]
    );
  }
  if (enc4Id && seededAppointments[3].prescriptionId) {
    await clients.medicalRecord.query(
      `INSERT INTO external_clinical_references (id, encounter_id, resource_type, resource_id, created_at)
       VALUES (gen_random_uuid(), $1, 'PRESCRIPTION', $2, NOW())
       ON CONFLICT (resource_type, resource_id) DO NOTHING`,
      [enc4Id, seededAppointments[3].prescriptionId]
    );
  }

  // 5. Bổ sung điều chỉnh bệnh án sau khi hoàn tất (Encounter Amendments)
  if (enc4Id) {
    await clients.medicalRecord.query(
      `INSERT INTO encounter_amendments (id, encounter_id, section, reason, patch, author_doctor_id, created_at)
       VALUES (
         gen_random_uuid(), $1, 'DIAGNOSIS',
         'Bổ sung chẩn đoán theo dõi tiền sản giật nhẹ sau khi đối chiếu chỉ số huyết áp và protein niệu vết',
         $2, $3, NOW() - INTERVAL '1 day'
       )`,
      [
        enc4Id,
        JSON.stringify({
          additionalIcdCode: 'O14.0',
          additionalDescription: 'Theo dõi tiền sản giật nhẹ thai 34 tuần',
          monitoringInstructions: 'Đo huyết áp tại nhà 2 lần/ngày (sáng - chiều), nếu huyết áp >= 140/90 mmHg hoặc đau đầu hoa mắt phải vào viện ngay'
        }),
        doctorList[0].id
      ]
    );
  }

  if (enc5Id) {
    await clients.medicalRecord.query(
      `INSERT INTO encounter_amendments (id, encounter_id, section, reason, patch, author_doctor_id, created_at)
       VALUES (
         gen_random_uuid(), $1, 'CLINICAL_SUMMARY',
         'Cập nhật kết quả phân tích di truyền cfDNA NIPT Basic từ Viện Di truyền Y học',
         $2, $3, NOW() - INTERVAL '3 days'
       )`,
      [
        enc5Id,
        JSON.stringify({
          niptResultStatus: 'LOW_RISK',
          trisomy21Down: 'Nguy cơ rất thấp (T-score: -2.85)',
          trisomy18Edwards: 'Nguy cơ rất thấp (T-score: -3.12)',
          trisomy13Patau: 'Nguy cơ rất thấp (T-score: -2.94)',
          fetalDnaFraction: '8.6%',
          recommendation: 'Tiếp tục theo dõi thai kỳ định kỳ, siêu âm hình thái học mốc 20-22 tuần'
        }),
        doctorList[3].id
      ]
    );
  }

  // 6. Nhật ký kiểm toán bệnh án (Medical Audit Logs)
  const medAudits = [
    { event: 'medical.encounter_opened.v1', actor: receptionistList[0].accountId, enc: enc1Id, reason: 'Mở bệnh án lâm sàng tiếp nhận từ lịch hẹn AT-2026-0001' },
    { event: 'medical.encounter_started.v1', actor: doctorList[0].accountId, enc: enc1Id, reason: 'Bác sĩ bắt đầu phiên khám chuyên gia VIP thai 22 tuần' },
    { event: 'medical.encounter_ready.v1', actor: doctorList[5].accountId, enc: enc3Id, reason: 'Đã nhận đủ kết quả xét nghiệm OGTT 3 thời điểm, sẵn sàng tổng duyệt' },
    { event: 'medical.encounter_finalized.v1', actor: doctorList[0].accountId, enc: enc4Id, reason: 'Hoàn tất khám, kết luận bệnh án và kê đơn canxi magie thai 34 tuần' },
    { event: 'medical.amendment_added.v1', actor: doctorList[0].accountId, enc: enc4Id, reason: 'Bác sĩ cập nhật phụ lục theo dõi tiền sản giật nhẹ' },
  ];

  for (const ma of medAudits) {
    if (ma.enc) {
      await clients.medicalRecord.query(
        `INSERT INTO medical_audit (id, event_type, actor_id, encounter_id, reason, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
        [ma.event, ma.actor, ma.enc, ma.reason]
      );
    }
  }

  // 7. Sự kiện Outbox Bệnh án (Medical Outbox Events)
  const medOutboxEvents = [
    { event: 'medical.encounter_opened.v1', enc: enc1Id, ver: 1, status: 'PUBLISHED', pubAt: new Date(now.getTime() - 35 * 60000) },
    { event: 'medical.encounter_started.v1', enc: enc1Id, ver: 2, status: 'PUBLISHED', pubAt: new Date(now.getTime() - 30 * 60000) },
    { event: 'medical.encounter_ready.v1', enc: enc3Id, ver: 2, status: 'PUBLISHED', pubAt: new Date(now.getTime() - 20 * 60000) },
    { event: 'medical.encounter_finalized.v1', enc: enc4Id, ver: 3, status: 'PUBLISHED', pubAt: new Date(now.getTime() - 15 * 60000) },
    { event: 'medical.amendment_added.v1', enc: enc4Id, ver: 4, status: 'PENDING', pubAt: null },
  ];

  for (const mo of medOutboxEvents) {
    if (mo.enc) {
      await clients.medicalRecord.query(
        `INSERT INTO medical_outbox (id, event_type, aggregate_id, aggregate_version, payload, status, occurred_at, published_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW() - INTERVAL '30 minutes', $6)`,
        [
          mo.event, mo.enc, mo.ver,
          JSON.stringify({ eventVersion: 1, aggregateType: 'clinical_encounter', aggregateId: mo.enc, eventType: mo.event }),
          mo.status, mo.pubAt
        ]
      );
    }
  }

  // 8. Bản ghi kiểm soát chống lặp bệnh án (Medical Idempotency)
  if (enc1Id) {
    await clients.medicalRecord.query(
      `INSERT INTO medical_idempotency (id, scope, key, request_hash, resource_id, response, created_at)
       VALUES (gen_random_uuid(), 'open-encounter', $1, $2, $3, $4, NOW())
       ON CONFLICT (scope, key) DO NOTHING`,
      [
        `idemp-open-${enc1Id}`,
        sha256(`open_enc_${enc1Id}`),
        enc1Id,
        JSON.stringify({ encounterId: enc1Id, status: 'OPENED' })
      ]
    );

    await clients.medicalRecord.query(
      `INSERT INTO medical_idempotency (id, scope, key, request_hash, resource_id, response, created_at)
       VALUES (gen_random_uuid(), 'add-vital', $1, $2, $3, $4, NOW())
       ON CONFLICT (scope, key) DO NOTHING`,
      [
        `idemp-vital-${enc1Id}`,
        sha256(`vital_enc_${enc1Id}`),
        enc1Id,
        JSON.stringify({ encounterId: enc1Id, status: 'RECORDED' })
      ]
    );
  }

  if (verifiedOrderId) {
    await clients.medicalRecord.query(
      `INSERT INTO medical_idempotency (id, scope, key, request_hash, resource_id, response, created_at)
       VALUES (gen_random_uuid(), 'order', $1, $2, $3, $4, NOW())
       ON CONFLICT (scope, key) DO NOTHING`,
      [
        `idemp-order-${verifiedOrderId}`,
        sha256(`order_${verifiedOrderId}`),
        verifiedOrderId,
        JSON.stringify({ orderId: verifiedOrderId, status: 'VERIFIED' })
      ]
    );
  }

  console.log(`✅ Đã khởi tạo đầy đủ hệ thống Bệnh án lâm sàng: Tất cả 5 trạng thái (DRAFT, IN_PROGRESS, AWAITING_RESULTS, READY_FOR_REVIEW, FINALIZED), Phân công nhân sự y tế đa vai trò, 6 trạng thái y lệnh cận lâm sàng kèm kết quả JSON, Phụ lục điều chỉnh (Amendments), Liên kết ngoài, Audit, Outbox và Idempotency.`);

  // ============================================================================
  // CÁC HÀNG ĐỢI ĐẶC BIỆT BỔ SUNG: URGENT (CẤP CỨU), SKIPPED (BỎ QUA), CANCELLED (HỦY)
  // ============================================================================
  const todayBusinessDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Thai phụ Cấp cứu / Ưu tiên khẩn cấp (BasePriority URGENT) - Lý Mỹ Dung (Thai 20 tuần)
  const urgentPatient = patientList[9];
  const urgentAppId = crypto.randomUUID();
  const urgentEncId = crypto.randomUUID();
  const urgentJrnRes = await clients.queue.query(
    `INSERT INTO queue_journeys (id, appointment_id, patient_id, encounter_id, business_date, late_minutes, late_demoted, state, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, false, 'ACTIVE', 1, NOW(), NOW()) RETURNING id`,
    [urgentAppId, urgentPatient.id, urgentEncId, todayBusinessDate]
  );
  const urgentJourneyId = urgentJrnRes.rows[0].id;
  const urgentTicketRes = await clients.queue.query(
    `INSERT INTO stage_tickets (id, journey_id, stage_id, room_code, business_date, ordinal, ticket_code, state, base_priority, late_demotion, enqueue_sequence, call_count, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'P.201', $3, 4, 'CONS-004', 'WAITING', 'URGENT', false, 10, 0, 1, NOW(), NOW()) RETURNING id`,
    [urgentJourneyId, stageMap['CONSULTATION'], todayBusinessDate]
  );
  const urgentTicketId = urgentTicketRes.rows[0].id;

  // 2. Bệnh nhân bị Bỏ qua (SKIPPED) do vắng mặt sau 2 lần gọi loa - Trương Thảo My
  const skippedPatient = patientList[10];
  const skippedAppId = crypto.randomUUID();
  const skippedEncId = crypto.randomUUID();
  const skippedJrnRes = await clients.queue.query(
    `INSERT INTO queue_journeys (id, appointment_id, patient_id, encounter_id, business_date, late_minutes, late_demoted, state, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, false, 'ACTIVE', 1, NOW(), NOW()) RETURNING id`,
    [skippedAppId, skippedPatient.id, skippedEncId, todayBusinessDate]
  );
  const skippedJourneyId = skippedJrnRes.rows[0].id;
  const skippedTicketRes = await clients.queue.query(
    `INSERT INTO stage_tickets (id, journey_id, stage_id, room_code, business_date, ordinal, ticket_code, state, base_priority, late_demotion, enqueue_sequence, call_count, called_at, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'P.201', $3, 5, 'CONS-005', 'SKIPPED', 'ROUTINE', false, 11, 2, NOW() - INTERVAL '20 minutes', 1, NOW(), NOW()) RETURNING id`,
    [skippedJourneyId, stageMap['CONSULTATION'], todayBusinessDate]
  );
  const skippedTicketId = skippedTicketRes.rows[0].id;

  // 2 lần gọi thất bại (CallAttempts: NO_SHOW)
  await clients.queue.query(
    `INSERT INTO call_attempts (id, ticket_id, attempt_number, called_at, expires_at, outcome, caller_account_id, room_code)
     VALUES (gen_random_uuid(), $1, 1, NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '20 minutes', 'NO_SHOW', $2, 'P.201')`,
    [skippedTicketId, nurseAccountId]
  );
  await clients.queue.query(
    `INSERT INTO call_attempts (id, ticket_id, attempt_number, called_at, expires_at, outcome, caller_account_id, room_code)
     VALUES (gen_random_uuid(), $1, 2, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '15 minutes', 'NO_SHOW', $2, 'P.201')`,
    [skippedTicketId, nurseAccountId]
  );

  // 3. Hành trình bị HỦY (Journey CANCELLED & Ticket CANCELLED) - Nguyễn Mai Hương
  const cancelledPatient = patientList[11];
  const cancelledAppId = crypto.randomUUID();
  const cancelledEncId = crypto.randomUUID();
  const cancelledJrnRes = await clients.queue.query(
    `INSERT INTO queue_journeys (id, appointment_id, patient_id, encounter_id, business_date, late_minutes, late_demoted, state, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, false, 'CANCELLED', 1, NOW(), NOW()) RETURNING id`,
    [cancelledAppId, cancelledPatient.id, cancelledEncId, todayBusinessDate]
  );
  const cancelledJourneyId = cancelledJrnRes.rows[0].id;
  const cancelledTicketRes = await clients.queue.query(
    `INSERT INTO stage_tickets (id, journey_id, stage_id, room_code, business_date, ordinal, ticket_code, state, base_priority, late_demotion, enqueue_sequence, call_count, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'P.203', $3, 6, 'CONS-006', 'CANCELLED', 'ROUTINE', false, 12, 0, 1, NOW(), NOW()) RETURNING id`,
    [cancelledJourneyId, stageMap['CONSULTATION'], todayBusinessDate]
  );
  const cancelledTicketId = cancelledTicketRes.rows[0].id;

  // ============================================================================
  // QUEUE AUDIT, IDEMPOTENCY & OUTBOX
  // ============================================================================
  // Nhật ký kiểm toán điều phối hàng đợi (QueueAudit)
  const queueAuditLogs = [
    { event: 'QUEUE_JOURNEY_CREATED', actor: receptionistList[0].accountId, ticketId: seededAppointments[0].ticketId, reason: 'Khởi tạo hành trình tiếp đón thai phụ Nguyễn Minh Anh' },
    { event: 'QUEUE_TICKET_CALLED', actor: doctorList[1].accountId, ticketId: seededAppointments[1].ticketId, reason: 'Bác sĩ gọi số thứ tự CONS-002 vào phòng P.202' },
    { event: 'QUEUE_OVERRIDE_CALLED', actor: doctorList[0].accountId, ticketId: urgentTicketId, reason: 'Bác sĩ ưu tiên gọi trước thai phụ nguy cơ cao cấp cứu' },
    { event: 'QUEUE_TICKET_SKIPPED', actor: nurseAccountId, ticketId: skippedTicketId, reason: 'Bệnh nhân vắng mặt tại sảnh sau 2 lần phát thanh gọi số' },
    { event: 'QUEUE_TICKET_CANCELLED', actor: receptionistList[0].accountId, ticketId: cancelledTicketId, reason: 'Bệnh nhân xin hủy chuyển tuyến theo nguyện vọng' },
    { event: 'QUEUE_TICKET_REQUEUED', actor: receptionistList[0].accountId, ticketId: skippedTicketId, reason: 'Bệnh nhân có mặt trở lại, xin tái xếp hàng vào cuối danh sách' },
  ];
  for (const al of queueAuditLogs) {
    await clients.queue.query(
      `INSERT INTO queue_audit (id, event_type, actor_id, ticket_id, reason, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())`,
      [al.event, al.actor, al.ticketId, al.reason]
    );
  }

  // Bản ghi chống trùng lặp (QueueIdempotency)
  await clients.queue.query(
    `INSERT INTO queue_idempotency (id, scope, key, request_hash, response, created_at)
     VALUES (gen_random_uuid(), 'create_journey', $1, $2, $3, NOW())`,
    [
      `idemp-journey-${seededAppointments[0].appointmentId}`,
      sha256(`create_journey_${seededAppointments[0].appointmentId}`),
      JSON.stringify({ success: true, journeyId: seededAppointments[0].journeyId, ticketCode: 'CONS-001' })
    ]
  );
  await clients.queue.query(
    `INSERT INTO queue_idempotency (id, scope, key, request_hash, response, created_at)
     VALUES (gen_random_uuid(), 'enqueue_stage', $1, $2, $3, NOW())`,
    [
      `idemp-stage-ultrasound-${seededAppointments[0].appointmentId}`,
      sha256(`enqueue_stage_ultrasound_${seededAppointments[0].appointmentId}`),
      JSON.stringify({ success: true, stageCode: 'ULTRASOUND', ticketCode: 'US-001' })
    ]
  );

  // Sự kiện gửi ra ngoài (QueueOutbox)
  await clients.queue.query(
    `INSERT INTO queue_outbox (id, event_type, aggregate_id, aggregate_version, payload, status, occurred_at, published_at)
     VALUES (gen_random_uuid(), 'queue.journey_created.v1', $1, 1, $2, 'PUBLISHED', NOW(), NOW())`,
    [seededAppointments[0].journeyId, JSON.stringify({ journeyId: seededAppointments[0].journeyId, patientId: seededAppointments[0].patientId, state: 'ACTIVE' })]
  );
  await clients.queue.query(
    `INSERT INTO queue_outbox (id, event_type, aggregate_id, aggregate_version, payload, status, occurred_at, published_at)
     VALUES (gen_random_uuid(), 'queue.ticket_called.v1', $1, 1, $2, 'PUBLISHED', NOW(), NOW())`,
    [seededAppointments[1].journeyId, JSON.stringify({ ticketCode: 'CONS-002', stage: 'CONSULTATION', room: 'P.202', calledAt: new Date() })]
  );
  await clients.queue.query(
    `INSERT INTO queue_outbox (id, event_type, aggregate_id, aggregate_version, payload, status, occurred_at, published_at)
     VALUES (gen_random_uuid(), 'queue.ticket_in_service.v1', $1, 1, $2, 'PUBLISHED', NOW(), NOW())`,
    [seededAppointments[0].journeyId, JSON.stringify({ ticketCode: 'CONS-001', doctorId: doctorList[0].id, startedAt: new Date() })]
  );
  await clients.queue.query(
    `INSERT INTO queue_outbox (id, event_type, aggregate_id, aggregate_version, payload, status, occurred_at, published_at)
     VALUES (gen_random_uuid(), 'queue.ticket_completed.v1', $1, 1, $2, 'PENDING', NOW(), NULL)`,
    [seededAppointments[2].journeyId, JSON.stringify({ ticketCode: 'CONS-003', state: 'COMPLETED', completedAt: new Date() })]
  );

  console.log(`✅ Đã tạo thành công 9 Lịch hẹn, Hóa đơn viện phí, Bệnh án lâm sàng và Hệ thống Hàng đợi phong phú (Tất cả trạng thái Journey & Ticket, Ưu tiên URGENT, Cuộc gọi, Audit, Idempotency, Outbox).`);

  // ============================================================================
  // ĐƠN THUỐC ĐA TRẠNG THÁI (PRESCRIPTION STATUSES: DRAFT, CANCELLED, SUPERSEDES) & OUTBOX
  // ============================================================================
  // 1. Đơn thuốc nháp đang kê dở (DRAFT) - BS. Nguyễn Quang Minh kê cho Trần Thị Thanh Hằng
  const draftPrescRes = await clients.prescription.query(
    `INSERT INTO prescriptions (id, encounter_id, patient_id, pregnancy_episode_id, prescribing_doctor_id, status, version, issued_at, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 'DRAFT', 1, NULL, NOW(), NOW()) RETURNING id`,
    [seededAppointments[1].encounterId, seededAppointments[1].patientId, patientList[1].pregnancyEpisodeId, doctorList[1].id]
  );
  const draftPrescId = draftPrescRes.rows[0].id;
  await clients.prescription.query(
    `INSERT INTO prescription_items (id, prescription_id, medication_code, medication_name, strength, dosage_form, route, dose, frequency, duration_days, instruction, sort_order)
     VALUES (gen_random_uuid(), $1, 'MED_PROGESTERONE_200', 'Utrogestan 200mg (Progesterone vi hạt)', '200 mg', 'Viên nang đặt âm đạo/uống', 'Đặt âm đạo sâu', '1 viên', '1 lần/ngày vào buổi tối', 15, 'Đặt sâu vào âm đạo buổi tối trước ngủ, nghỉ ngơi 30 phút.', 1)`,
    [draftPrescId]
  );
  await clients.prescription.query(
    `INSERT INTO prescription_items (id, prescription_id, medication_code, medication_name, strength, dosage_form, route, dose, frequency, duration_days, instruction, sort_order)
     VALUES (gen_random_uuid(), $1, 'MED_MAGNE_B6', 'Magne-B6 Corbiere', '470mg / 5mg', 'Viên bao đường', 'Uống', '1 viên', '2 lần/ngày', 30, 'Uống cùng bữa ăn với nhiều nước.', 2)`,
    [draftPrescId]
  );

  // 2. Đơn thuốc bị HỦY (CANCELLED) do thai phụ dị ứng tá dược - BS. Lê Thu Hà
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const cancelledPrescRes = await clients.prescription.query(
    `INSERT INTO prescriptions (id, encounter_id, patient_id, pregnancy_episode_id, prescribing_doctor_id, status, cancelled_at, cancel_reason, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 'CANCELLED', $5, 'Thai phụ có phản ứng dị ứng ngứa da và buồn nôn với dạng sắt viên nang, hủy đơn để chuyển sang phác đồ thay thế', 2, $5, $5) RETURNING id`,
    [seededAppointments[0].encounterId, seededAppointments[0].patientId, patientList[0].pregnancyEpisodeId, doctorList[0].id, twoDaysAgo]
  );
  const cancelledPrescId = cancelledPrescRes.rows[0].id;
  await clients.prescription.query(
    `INSERT INTO prescription_items (id, prescription_id, medication_code, medication_name, strength, dosage_form, route, dose, frequency, duration_days, instruction, sort_order)
     VALUES (gen_random_uuid(), $1, 'MED_IRON_FEMAT', 'Sắt hữu cơ Polymaltose (Femat)', '50 mg', 'Viên nang mềm', 'Uống', '1 viên', '1 lần/ngày', 30, 'Uống trước ăn 30 phút với nhiều nước.', 1)`,
    [cancelledPrescId]
  );

  // 3. Đơn thuốc THAY THẾ (ISSUED) nối với đơn cũ qua supersedes_prescription_id
  const supersedingPrescRes = await clients.prescription.query(
    `INSERT INTO prescriptions (id, encounter_id, patient_id, pregnancy_episode_id, prescribing_doctor_id, status, supersedes_prescription_id, version, issued_at, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ISSUED', $5, 1, $6, $6, $6) RETURNING id`,
    [seededAppointments[0].encounterId, seededAppointments[0].patientId, patientList[0].pregnancyEpisodeId, doctorList[0].id, cancelledPrescId, new Date(twoDaysAgo.getTime() + 15 * 60 * 1000)]
  );
  const supersedingPrescId = supersedingPrescRes.rows[0].id;
  await clients.prescription.query(
    `INSERT INTO prescription_items (id, prescription_id, medication_code, medication_name, strength, dosage_form, route, dose, frequency, duration_days, instruction, sort_order)
     VALUES (gen_random_uuid(), $1, 'MED_CALCIUM_CORBIERE', 'Canxi Corbiere Sanofi 5ml', '552.5 mg/5ml', 'Dung dịch uống ống bẻ', 'Uống', '1 ống (5ml)', '2 lần/ngày', 30, 'Uống trực tiếp sau ăn sáng và ăn trưa.', 1)`,
    [supersedingPrescId]
  );
  await clients.prescription.query(
    `INSERT INTO prescription_items (id, prescription_id, medication_code, medication_name, strength, dosage_form, route, dose, frequency, duration_days, instruction, sort_order)
     VALUES (gen_random_uuid(), $1, 'MED_DHA_PRENATAL', 'Bio Island DHA for Pregnancy 210mg', '210 mg', 'Viên nang mềm', 'Uống', '1 viên', '1 lần/ngày', 30, 'Uống ngay trong hoặc ngay sau bữa ăn có chất béo.', 2)`,
    [supersedingPrescId]
  );

  // 4. Sự kiện Outbox cho Prescription (PrescriptionOutbox)
  await clients.prescription.query(
    `INSERT INTO prescription_outbox (id, event_type, aggregate_id, payload, status, occurred_at)
     VALUES (gen_random_uuid(), 'prescription.draft_created.v1', $1, $2, 'PUBLISHED', NOW())`,
    [draftPrescId, JSON.stringify({ prescriptionId: draftPrescId, status: 'DRAFT', doctorId: doctorList[1].id })]
  );
  await clients.prescription.query(
    `INSERT INTO prescription_outbox (id, event_type, aggregate_id, payload, status, occurred_at)
     VALUES (gen_random_uuid(), 'prescription.cancelled.v1', $1, $2, 'PUBLISHED', $3)`,
    [cancelledPrescId, JSON.stringify({ prescriptionId: cancelledPrescId, status: 'CANCELLED', reason: 'Dị ứng tá dược thuốc' }), twoDaysAgo]
  );
  await clients.prescription.query(
    `INSERT INTO prescription_outbox (id, event_type, aggregate_id, payload, status, occurred_at)
     VALUES (gen_random_uuid(), 'prescription.issued.v1', $1, $2, 'PENDING', NOW())`,
    [supersedingPrescId, JSON.stringify({ prescriptionId: supersedingPrescId, supersedesPrescriptionId: cancelledPrescId, status: 'ISSUED' })]
  );

  console.log(`✅ Đã khởi tạo đầy đủ hệ thống Đơn thuốc (Tất cả trạng thái DRAFT, ISSUED, CANCELLED, Đơn thay thế SUPERSEDES và Outbox).`);

  // ============================================================================
  // 9.1 TIẾP ĐÓN, XÁC THỰC DANH TÍNH & NHẬP VIỆN (RECEPTION CASES & ADMISSIONS)
  // ============================================================================
  console.log('\n--- BƯỚC 9.1: KHỞI TẠO TIẾP ĐÓN, XÁC THỰC DANH TÍNH & NHẬP VIỆN (RECEPTION CASES) ---');

  // Case 1: Lịch hẹn AT-2026-0001 (Nguyễn Minh Anh - COMPLETED hôm nay) -> ADMITTED & COMPLETED
  const app1 = seededAppointments[0];
  const app1Arrival = new Date(app1.appDate.getTime() - 15 * 60 * 1000);
  const app1Checkin = new Date(app1.appDate.getTime() - 10 * 60 * 1000);
  const app1Complete = new Date(app1.appDate.getTime() + 30 * 60 * 1000);

  const case1Res = await clients.receptionist.query(
    `INSERT INTO reception_cases (
      id, type, appointment_id, patient_id, status, arrival_at, scheduled_start_at_snapshot,
      appointment_type_snapshot, opened_by_account_id, last_handled_by_account_id, version, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), 'SCHEDULED', $1, $2, 'ADMITTED', $3, $4,
      'SERVICE', $5, $5, 1, NOW(), NOW()
    ) RETURNING id`,
    [app1.appointmentId, app1.patientId, app1Arrival, app1.appDate, receptionistList[0].accountId]
  );
  const case1Id = case1Res.rows[0].id;

  await clients.receptionist.query(
    `INSERT INTO identity_verifications (
      id, reception_case_id, method, result, reason_code, note, verified_fields, performed_by_account_id, performed_at
    ) VALUES (
      gen_random_uuid(), $1, 'NATIONAL_ID_DOCUMENT', 'VERIFIED', 'MATCH_PERFECT',
      'Đối chiếu CCCD gắn chip và nhận diện khuôn mặt khớp 100%',
      ARRAY['fullName', 'dob', 'nationalId', 'photo'], $2, $3
    )`,
    [case1Id, receptionistList[0].accountId, app1Arrival]
  );

  const adm1Res = await clients.receptionist.query(
    `INSERT INTO admissions (
      id, reception_case_id, status, current_step, invoice_id, payment_id,
      medical_record_id, encounter_id, queue_ticket_id, queue_journey_id,
      appointment_checked_in_at, retry_count, version, created_at, updated_at, completed_at
    ) VALUES (
      gen_random_uuid(), $1, 'COMPLETED', 'DONE', $2, $3,
      $4, $4, $5, $6,
      $7, 0, 1, NOW(), NOW(), $8
    ) RETURNING id`,
    [case1Id, app1.invoiceId, app1.paymentId, app1.encounterId, app1.ticketId, app1.journeyId, app1Checkin, app1Complete]
  );
  const adm1Id = adm1Res.rows[0].id;

  // Lịch sử các bước nhập viện của Case 1
  const historyStepsCase1 = [
    { from: 'IN_PROGRESS', to: 'IN_PROGRESS', step: 'VALIDATE_APPOINTMENT', reason: 'APPOINTMENT_VALIDATED', time: app1Arrival },
    { from: 'IN_PROGRESS', to: 'IN_PROGRESS', step: 'VERIFY_PAYMENT_OR_APPROVED_CREDIT', reason: 'PAYMENT_VERIFIED', time: app1Checkin },
    { from: 'IN_PROGRESS', to: 'COMPLETED', step: 'DONE', reason: 'ADMISSION_COMPLETED', time: app1Complete },
  ];
  for (const h of historyStepsCase1) {
    await clients.receptionist.query(
      `INSERT INTO admission_status_history (
        id, admission_id, from_status, to_status, step, actor_id, reason_code, occurred_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7
      )`,
      [adm1Id, h.from, h.to, h.step, receptionistList[0].accountId, h.reason, h.time]
    );
  }

  // Case 2: Lịch hẹn AT-2026-0002 (Trần Thị Thanh Hằng - IN_CLINICAL_CARE hôm nay) -> ADMISSION_IN_PROGRESS
  const app2 = seededAppointments[1];
  const app2Arrival = new Date(app2.appDate.getTime() - 20 * 60 * 1000);
  const app2Checkin = new Date(app2.appDate.getTime() - 15 * 60 * 1000);

  const case2Res = await clients.receptionist.query(
    `INSERT INTO reception_cases (
      id, type, appointment_id, patient_id, status, arrival_at, scheduled_start_at_snapshot,
      appointment_type_snapshot, opened_by_account_id, last_handled_by_account_id, version, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), 'SCHEDULED', $1, $2, 'ADMISSION_IN_PROGRESS', $3, $4,
      'SERVICE', $5, $5, 1, NOW(), NOW()
    ) RETURNING id`,
    [app2.appointmentId, app2.patientId, app2Arrival, app2.appDate, receptionistList[1].accountId]
  );
  const case2Id = case2Res.rows[0].id;

  await clients.receptionist.query(
    `INSERT INTO identity_verifications (
      id, reception_case_id, method, result, reason_code, note, verified_fields, performed_by_account_id, performed_at
    ) VALUES (
      gen_random_uuid(), $1, 'APPOINTMENT_CODE', 'VERIFIED', 'APP_CODE_VALID',
      'Xác thực qua mã QR lịch hẹn trên ứng dụng di động An Tâm',
      ARRAY['appointmentCode', 'phone'], $2, $3
    )`,
    [case2Id, receptionistList[1].accountId, app2Arrival]
  );

  const adm2Res = await clients.receptionist.query(
    `INSERT INTO admissions (
      id, reception_case_id, status, current_step, invoice_id, payment_id,
      medical_record_id, encounter_id, queue_ticket_id, queue_journey_id,
      appointment_checked_in_at, retry_count, version, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1, 'IN_PROGRESS', 'OPEN_CLINICAL_ENCOUNTER_DRAFT', $2, $3,
      $4, $4, $5, $6,
      $7, 0, 1, NOW(), NOW()
    ) RETURNING id`,
    [case2Id, app2.invoiceId, app2.paymentId, app2.encounterId, app2.ticketId, app2.journeyId, app2Checkin]
  );
  const adm2Id = adm2Res.rows[0].id;

  await clients.receptionist.query(
    `INSERT INTO admission_status_history (
      id, admission_id, from_status, to_status, step, actor_id, reason_code, occurred_at
    ) VALUES (
      gen_random_uuid(), $1, 'IN_PROGRESS', 'IN_PROGRESS', 'OPEN_CLINICAL_ENCOUNTER_DRAFT', $2, 'ENCOUNTER_OPENED', $3
    )`,
    [adm2Id, receptionistList[1].accountId, app2Checkin]
  );

  // Case 3: Lịch hẹn AT-2026-0003 (Lê Bích Thủy - CHECKED_IN hôm nay) -> IDENTITY_VERIFIED
  const app3 = seededAppointments[2];
  const app3Arrival = new Date(app3.appDate.getTime() - 10 * 60 * 1000);

  const case3Res = await clients.receptionist.query(
    `INSERT INTO reception_cases (
      id, type, appointment_id, patient_id, status, arrival_at, scheduled_start_at_snapshot,
      appointment_type_snapshot, opened_by_account_id, last_handled_by_account_id, version, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), 'SCHEDULED', $1, $2, 'IDENTITY_VERIFIED', $3, $4,
      'SERVICE', $5, $5, 1, NOW(), NOW()
    ) RETURNING id`,
    [app3.appointmentId, app3.patientId, app3Arrival, app3.appDate, receptionistList[0].accountId]
  );
  const case3Id = case3Res.rows[0].id;

  await clients.receptionist.query(
    `INSERT INTO identity_verifications (
      id, reception_case_id, method, result, reason_code, note, verified_fields, performed_by_account_id, performed_at
    ) VALUES (
      gen_random_uuid(), $1, 'PHONE_AND_DOB', 'VERIFIED', 'PHONE_DOB_MATCH',
      'Xác nhận thông tin qua Số điện thoại và Ngày tháng năm sinh của thai phụ',
      ARRAY['phone', 'dob'], $2, $3
    )`,
    [case3Id, receptionistList[0].accountId, app3Arrival]
  );

  // Case 4: Tiếp đón Vãng lai không hẹn trước (WALK_IN - Vũ Ngọc Mai) -> OPEN
  const walkinPatient = patientList[9];
  const walkinArrival = new Date(now.getTime() - 5 * 60 * 1000);
  await clients.receptionist.query(
    `INSERT INTO reception_cases (
      id, type, appointment_id, patient_id, status, arrival_at, scheduled_start_at_snapshot,
      appointment_type_snapshot, opened_by_account_id, last_handled_by_account_id, version, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), 'WALK_IN', NULL, $1, 'OPEN', $2, NULL,
      'WALK_IN', $3, $3, 1, NOW(), NOW()
    )`,
    [walkinPatient.id, walkinArrival, receptionistList[0].accountId]
  );

  // Case 5: Tiếp đón cần kiểm tra thủ công (MANUAL_REVIEW - Vũ Thị Kim Ngân, AT-2026-0006)
  const app6 = seededAppointments[5];
  const case5Res = await clients.receptionist.query(
    `INSERT INTO reception_cases (
      id, type, appointment_id, patient_id, status, arrival_at, scheduled_start_at_snapshot,
      appointment_type_snapshot, opened_by_account_id, last_handled_by_account_id, version, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), 'SCHEDULED', $1, $2, 'MANUAL_REVIEW', NOW(), $3,
      'SERVICE', $4, $4, 1, NOW(), NOW()
    ) RETURNING id`,
    [app6.appointmentId, app6.patientId, app6.appDate, receptionistList[2].accountId]
  );
  const case5Id = case5Res.rows[0].id;

  await clients.receptionist.query(
    `INSERT INTO identity_verifications (
      id, reception_case_id, method, result, reason_code, note, verified_fields, performed_by_account_id, performed_at
    ) VALUES (
      gen_random_uuid(), $1, 'OTHER_DOCUMENT', 'INCONCLUSIVE', 'SUSPICIOUS_DOC',
      'Ảnh chụp giấy tờ tùy thân mờ góc, cần xuất trình bản gốc đối chiếu tại quầy',
      ARRAY['documentNumber'], $2, NOW()
    )`,
    [case5Id, receptionistList[2].accountId]
  );

  await clients.receptionist.query(
    `INSERT INTO admissions (
      id, reception_case_id, status, current_step, invoice_id, payment_id,
      last_error_code, retry_count, version, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1, 'AWAITING_PAYMENT', 'VERIFY_PAYMENT_OR_APPROVED_CREDIT', $2, NULL,
      'PAYMENT_NOT_CLEARED', 1, 1, NOW(), NOW()
    )`,
    [case5Id, app6.invoiceId]
  );

  // Case 6: Tiếp đón bị hủy do sai lệch thông tin danh tính (CANCELLED)
  const cancelPatient = patientList[10];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const case6Res = await clients.receptionist.query(
    `INSERT INTO reception_cases (
      id, type, appointment_id, patient_id, status, arrival_at, scheduled_start_at_snapshot,
      appointment_type_snapshot, opened_by_account_id, last_handled_by_account_id, version, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), 'SCHEDULED', NULL, $1, 'CANCELLED', $2, $2,
      'SERVICE', $3, $3, 1, $2, $2
    ) RETURNING id`,
    [cancelPatient.id, yesterday, receptionistList[0].accountId]
  );
  const case6Id = case6Res.rows[0].id;

  await clients.receptionist.query(
    `INSERT INTO identity_verifications (
      id, reception_case_id, method, result, reason_code, note, verified_fields, performed_by_account_id, performed_at
    ) VALUES (
      gen_random_uuid(), $1, 'NATIONAL_ID_DOCUMENT', 'MISMATCH', 'WRONG_PERSON',
      'Người đến tiếp đón không trùng khớp với CCCD của thai phụ đăng ký',
      ARRAY['nationalId'], $2, $3
    )`,
    [case6Id, receptionistList[0].accountId, yesterday]
  );

  // Nhật ký kiểm toán tiếp đón (Reception Audit Logs)
  await clients.receptionist.query(
    `INSERT INTO reception_audit_logs (id, event_type, actor_id, receptionist_id, case_id, admission_id, changed_fields, reason_code, request_id, created_at)
     VALUES (gen_random_uuid(), 'RECEPTION_CASE_OPENED', $1, $2, $3, NULL, ARRAY['status'], 'PATIENT_CHECKIN', gen_random_uuid(), NOW())`,
    [receptionistList[0].accountId, receptionistList[0].id, case1Id]
  );
  await clients.receptionist.query(
    `INSERT INTO reception_audit_logs (id, event_type, actor_id, receptionist_id, case_id, admission_id, changed_fields, reason_code, request_id, created_at)
     VALUES (gen_random_uuid(), 'IDENTITY_VERIFIED', $1, $2, $3, NULL, ARRAY['status'], 'IDENTITY_VERIFIED', gen_random_uuid(), NOW())`,
    [receptionistList[0].accountId, receptionistList[0].id, case1Id]
  );
  await clients.receptionist.query(
    `INSERT INTO reception_audit_logs (id, event_type, actor_id, receptionist_id, case_id, admission_id, changed_fields, reason_code, request_id, created_at)
     VALUES (gen_random_uuid(), 'PATIENT_ADMITTED', $1, $2, $3, $4, ARRAY['admission.status'], 'ADMISSION_COMPLETED', gen_random_uuid(), NOW())`,
    [receptionistList[0].accountId, receptionistList[0].id, case1Id, adm1Id]
  );

  console.log(`✅ Đã khởi tạo 6 Hồ sơ tiếp đón (SCHEDULED/WALK-IN), Xác thực danh tính (VERIFIED, MISMATCH, INCONCLUSIVE), Admissions và Lịch sử chuyển bước.`);

  // ============================================================================
  // 10. KẾ HOẠCH THEO DÕI THAI KỲ (TREATMENT PLANS TOÀN DIỆN)
  // ============================================================================
  console.log('\n--- BƯỚC 10: KHỞI TẠO KẾ HOẠCH THEO DÕI THAI KỲ TOÀN DIỆN (TREATMENT PLAN) ---');

  // Plan 1: ACTIVE (Nguyễn Minh Anh - Thai 22 tuần, Quản lý thai nghén toàn diện)
  const demoPatient = patientList[0];
  const attendingDoctor = doctorList[0]; // BS. Lê Thu Hà
  const enc1 = seededAppointments[0];

  const plan1Id = crypto.randomUUID();
  await clients.treatmentPlan.query(
    `INSERT INTO treatment_plans (
      id, patient_id, pregnancy_episode_id, source_encounter_id, author_doctor_id,
      status, title, summary, effective_from, effective_to, version, activated_at, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      'ACTIVE', $6, $7, $8, $9, 2, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', NOW()
    )`,
    [
      plan1Id,
      demoPatient.id,
      demoPatient.pregnancyEpisodeId,
      enc1.encounterId,
      attendingDoctor.id,
      'Kế hoạch theo dõi thai kỳ 40 tuần chuẩn Bộ Y Tế & Chuyên gia An Tâm',
      'Phác đồ quản lý thai nghén toàn diện dành riêng cho thai phụ Nguyễn Minh Anh: Lịch khám, siêu âm hình thái học 4D, xét nghiệm di truyền NIPT, theo dõi dung nạp đường huyết và lịch tiêm phòng uốn ván tiền sản.',
      new Date(now.getTime() - 30 * 24 * 3600000),
      new Date(now.getFullYear(), now.getMonth() + 4, 15),
    ]
  );

  // Items của Plan 1: Đủ các trạng thái DONE, IN_PROGRESS, PENDING, CANCELLED
  const plan1Items = [
    { type: 'ULTRASOUND', title: 'Siêu âm 4D hình thái thai nhi tuần 22', desc: 'Khảo sát dị tật chi tiết hộp sọ, gương mặt, tim 4 buồng và hệ vận động.', status: 'DONE', dueAt: new Date(now.getTime() - 24 * 3600000), completedAt: new Date(now.getTime() - 20 * 60000), sort: 1 },
    { type: 'LAB_TEST', title: 'Nghiệm pháp dung nạp Glucose 75g (OGTT) tuần 24-28', desc: 'Tầm soát đái tháo đường thai kỳ 3 thời điểm: Lúc đói, sau 1h và sau 2h uống đường.', status: 'IN_PROGRESS', dueAt: new Date(now.getTime() + 14 * 24 * 3600000), completedAt: null, sort: 2 },
    { type: 'VACCINATION', title: 'Tiêm phòng vắc xin Uốn ván mũi 1 (VAT 1) tuần 28', desc: 'Phòng ngừa uốn ván sơ sinh cho mẹ và con khi sinh nở.', status: 'PENDING', dueAt: new Date(now.getTime() + 42 * 24 * 3600000), completedAt: null, sort: 3 },
    { type: 'ULTRASOUND', title: 'Siêu âm Doppler màu đánh giá tuần hoàn thai nhi tuần 32', desc: 'Đo Doppler động mạch rốn và động mạch não giữa, kiểm tra lượng ối và cân nặng thai.', status: 'PENDING', dueAt: new Date(now.getTime() + 70 * 24 * 3600000), completedAt: null, sort: 4 },
    { type: 'CONSULTATION', title: 'Khám tư vấn làm hồ sơ sinh và giảm đau sản khoa tuần 36', desc: 'Đo Monitoring tim thai và cơn co tử cung NST, khám khung chậu và hướng dẫn dấu hiệu chuyển dạ.', status: 'PENDING', dueAt: new Date(now.getTime() + 98 * 24 * 3600000), completedAt: null, sort: 5 },
    { type: 'LAB_TEST', title: 'Xét nghiệm Double Test sinh hóa quý 1', desc: 'Hủy bỏ do thai phụ đã thực hiện gói sàng lọc NIPT Pro toàn diện 23 cặp NST.', status: 'CANCELLED', dueAt: new Date(now.getTime() - 60 * 24 * 3600000), completedAt: null, sort: 6 },
  ];

  let item1Id = null;
  for (const item of plan1Items) {
    const itRes = await clients.treatmentPlan.query(
      `INSERT INTO treatment_plan_items (
        id, plan_id, type, title, description, due_at, status, sort_order, completed_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING id`,
      [plan1Id, item.type, item.title, item.desc, item.dueAt, item.status, item.sort, item.completedAt]
    );
    if (item.status === 'DONE') item1Id = itRes.rows[0].id;
  }

  // Versions của Plan 1
  await clients.treatmentPlan.query(
    `INSERT INTO treatment_plan_versions (id, plan_id, version, snapshot, changed_by, change_reason, created_at)
     VALUES (gen_random_uuid(), $1, 1, $2, $3, 'CREATED', NOW() - INTERVAL '30 days')`,
    [
      plan1Id,
      JSON.stringify({
        title: 'Kế hoạch theo dõi thai kỳ 40 tuần chuẩn Bộ Y Tế & Chuyên gia An Tâm',
        itemsCount: 5,
        targetDelivery: 'Tháng 2/2027'
      }),
      attendingDoctor.id
    ]
  );

  await clients.treatmentPlan.query(
    `INSERT INTO treatment_plan_versions (id, plan_id, version, snapshot, changed_by, change_reason, created_at)
     VALUES (gen_random_uuid(), $1, 2, $2, $3, 'UPDATED', NOW() - INTERVAL '1 day')`,
    [
      plan1Id,
      JSON.stringify({
        title: 'Kế hoạch theo dõi thai kỳ 40 tuần chuẩn Bộ Y Tế & Chuyên gia An Tâm (Cập nhật)',
        updatedSection: 'Hủy Double test, chuyển sang theo dõi đường huyết OGTT chuyên sâu',
        itemsCount: 6
      }),
      attendingDoctor.id
    ]
  );

  // Plan 2: COMPLETED (Phạm Quỳnh Chi - Hoàn thành thai kỳ lần 1 cách đây 2 năm)
  const chiPat = patientList[3];
  const plan2Id = crypto.randomUUID();
  await clients.treatmentPlan.query(
    `INSERT INTO treatment_plans (
      id, patient_id, pregnancy_episode_id, source_encounter_id, author_doctor_id,
      status, title, summary, effective_from, effective_to, version, activated_at, completed_at, created_at, updated_at
    ) VALUES (
      $1, $2, NULL, $3, $4,
      'COMPLETED', $5, $6, $7, $8, 1, NOW() - INTERVAL '2 years', NOW() - INTERVAL '16 months', NOW() - INTERVAL '2 years', NOW() - INTERVAL '16 months'
    )`,
    [
      plan2Id,
      chiPat.id,
      seededAppointments[3].encounterId,
      attendingDoctor.id,
      'Phác đồ quản lý thai kỳ & đỡ sinh thường an toàn (Thai kỳ lần 1)',
      'Toàn bộ phác đồ theo dõi thai kỳ 40 tuần và chuẩn bị sinh nở an toàn đã hoàn thành xuất sắc. Bé gái chào đời khỏe mạnh nặng 3.2kg tại Bệnh viện Phụ sản An Tâm.',
      new Date(now.getFullYear() - 2, 0, 15),
      new Date(now.getFullYear() - 2, 8, 30),
    ]
  );

  const plan2Items = [
    { type: 'ULTRASOUND', title: 'Siêu âm hình thái học quý 2', desc: 'Khảo sát cấu trúc giải phẫu thai nhi toàn diện.', status: 'DONE', sort: 1, compAt: new Date(now.getFullYear() - 2, 4, 10) },
    { type: 'LAB_TEST', title: 'Tổng phân tích tế bào máu & đường huyết thai kỳ', desc: 'Tầm soát thiếu máu thiếu sắt và dung nạp glucose.', status: 'DONE', sort: 2, compAt: new Date(now.getFullYear() - 2, 5, 20) },
    { type: 'DELIVERY', title: 'Theo dõi chuyển dạ và đỡ sinh thường an toàn', desc: 'Đỡ đẻ ngôi đầu an toàn, da kề da và kẹp rốn muộn.', status: 'DONE', sort: 3, compAt: new Date(now.getFullYear() - 2, 8, 25) },
  ];

  for (const it of plan2Items) {
    await clients.treatmentPlan.query(
      `INSERT INTO treatment_plan_items (id, plan_id, type, title, description, status, sort_order, completed_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
      [plan2Id, it.type, it.title, it.desc, it.status, it.sort, it.compAt]
    );
  }

  await clients.treatmentPlan.query(
    `INSERT INTO treatment_plan_versions (id, plan_id, version, snapshot, changed_by, change_reason, created_at)
     VALUES (gen_random_uuid(), $1, 1, $2, $3, 'CREATED', NOW() - INTERVAL '2 years')`,
    [plan2Id, JSON.stringify({ title: 'Phác đồ thai kỳ lần 1', completed: true }), attendingDoctor.id]
  );

  // Plan 3: DRAFT (Vũ Thị Kim Ngân - Thai 10 tuần, vừa đến khám tiếp nhận)
  const nganPat = patientList[5];
  const drMai = doctorList[2]; // ThS. BS. Trần Thanh Mai
  const plan3Id = crypto.randomUUID();

  await clients.treatmentPlan.query(
    `INSERT INTO treatment_plans (
      id, patient_id, pregnancy_episode_id, source_encounter_id, author_doctor_id,
      status, title, summary, effective_from, effective_to, version, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      'DRAFT', $6, $7, $8, $9, 1, NOW(), NOW()
    )`,
    [
      plan3Id,
      nganPat.id,
      nganPat.pregnancyEpisodeId,
      seededAppointments[5].encounterId,
      drMai.id,
      'Dự thảo phác đồ theo dõi thai kỳ quý 1 & sàng lọc trước sinh sớm',
      'Dự thảo kế hoạch chăm sóc thai kỳ 3 tháng đầu: Khám thai định kỳ tuần 10-12, đo độ mờ da gáy, xét nghiệm Double test / NIPT và bổ sung acid folic vi chất.',
      new Date(),
      new Date(now.getFullYear(), now.getMonth() + 2, 1),
    ]
  );

  const plan3Items = [
    { type: 'ULTRASOUND', title: 'Siêu âm đo độ mờ da gáy (NT) tuần 11-13', desc: 'Đo khoảng sáng sau gáy sàng lọc hội chứng Down sớm.', status: 'PENDING', sort: 1 },
    { type: 'LAB_TEST', title: 'Xét nghiệm sàng lọc trước sinh NIPT Basic', desc: 'Tách chiết ADN tự do thai nhi trong máu mẹ.', status: 'PENDING', sort: 2 },
  ];

  for (const it of plan3Items) {
    await clients.treatmentPlan.query(
      `INSERT INTO treatment_plan_items (id, plan_id, type, title, description, status, sort_order)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
      [plan3Id, it.type, it.title, it.desc, it.status, it.sort]
    );
  }

  await clients.treatmentPlan.query(
    `INSERT INTO treatment_plan_versions (id, plan_id, version, snapshot, changed_by, change_reason, created_at)
     VALUES (gen_random_uuid(), $1, 1, $2, $3, 'CREATED', NOW())`,
    [plan3Id, JSON.stringify({ title: 'Dự thảo phác đồ quý 1', draft: true }), drMai.id]
  );

  // Plan 4: CANCELLED (Lê Ngọc Mai - Hủy phác đồ can thiệp đường huyết thai kỳ sau khi OGTT đạt chuẩn an toàn)
  const maiPat = patientList[2];
  const drDuong = doctorList[5]; // BS. Phạm Thùy Dương
  const plan4Id = crypto.randomUUID();

  await clients.treatmentPlan.query(
    `INSERT INTO treatment_plans (
      id, patient_id, pregnancy_episode_id, source_encounter_id, author_doctor_id,
      status, title, summary, effective_from, effective_to, version, activated_at, cancelled_at, cancel_reason, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      'CANCELLED', $6, $7, $8, $9, 1, NOW() - INTERVAL '15 days', NOW() - INTERVAL '1 hour', $10, NOW() - INTERVAL '15 days', NOW() - INTERVAL '1 hour'
    )`,
    [
      plan4Id,
      maiPat.id,
      maiPat.pregnancyEpisodeId,
      seededAppointments[2].encounterId,
      drDuong.id,
      'Phác đồ can thiệp kiểm soát đường huyết mao mạch & chế độ ăn nghiêm ngặt',
      'Kế hoạch theo dõi đường huyết mao mạch 4 lần/ngày và cân nhắc sử dụng insulin thai kỳ nếu chế độ ăn không đạt mục tiêu kiểm soát.',
      new Date(now.getTime() - 15 * 24 * 3600000),
      new Date(now.getTime() + 45 * 24 * 3600000),
      'Kết quả nghiệm pháp dung nạp Glucose (OGTT 75g) ngày hôm nay cho kết quả hoàn toàn bình thường, không có đái tháo đường thai kỳ. Bác sĩ quyết định dừng và hủy phác đồ can thiệp đặc biệt, chuyển sang theo dõi thai sản định kỳ thông thường.'
    ]
  );

  const plan4Items = [
    { type: 'MEDICATION', title: 'Đo đường huyết mao mạch tại nhà 4 lần/ngày', desc: 'Đo đường huyết lúc đói buổi sáng và sau ăn 2h các bữa chính.', status: 'CANCELLED', sort: 1 },
    { type: 'CONSULTATION', title: 'Tư vấn chuyên khoa Dinh dưỡng lâm sàng & Đái tháo đường', desc: 'Xây dựng thực đơn kiểm soát Carbohydrate nghiêm ngặt.', status: 'CANCELLED', sort: 2 },
  ];

  for (const it of plan4Items) {
    await clients.treatmentPlan.query(
      `INSERT INTO treatment_plan_items (id, plan_id, type, title, description, status, sort_order)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
      [plan4Id, it.type, it.title, it.desc, it.status, it.sort]
    );
  }

  await clients.treatmentPlan.query(
    `INSERT INTO treatment_plan_versions (id, plan_id, version, snapshot, changed_by, change_reason, created_at)
     VALUES (gen_random_uuid(), $1, 1, $2, $3, 'CREATED', NOW() - INTERVAL '15 days')`,
    [plan4Id, JSON.stringify({ title: 'Phác đồ can thiệp đường huyết', cancelled: true }), drDuong.id]
  );

  // Sự kiện Outbox của Treatment Plan (TreatmentPlanOutbox)
  const planOutboxEvents = [
    { eventType: 'treatment_plan.created.v1', aggId: plan1Id, payload: { planId: plan1Id, patientId: demoPatient.id, status: 'DRAFT' }, status: 'PUBLISHED', occAt: new Date(now.getTime() - 30 * 24 * 3600000) },
    { eventType: 'treatment_plan.activated.v1', aggId: plan1Id, payload: { planId: plan1Id, patientId: demoPatient.id, status: 'ACTIVE' }, status: 'PUBLISHED', occAt: new Date(now.getTime() - 30 * 24 * 3600000) },
    { eventType: 'treatment_plan.item_completed.v1', aggId: plan1Id, payload: { planId: plan1Id, itemId: item1Id, status: 'DONE' }, status: 'PUBLISHED', occAt: new Date(now.getTime() - 20 * 60000) },
    { eventType: 'treatment_plan.completed.v1', aggId: plan2Id, payload: { planId: plan2Id, patientId: chiPat.id, status: 'COMPLETED' }, status: 'PUBLISHED', occAt: new Date(now.getFullYear() - 2, 8, 30) },
    { eventType: 'treatment_plan.cancelled.v1', aggId: plan4Id, payload: { planId: plan4Id, patientId: maiPat.id, status: 'CANCELLED', reason: 'Kết quả OGTT bình thường, hủy phác đồ' }, status: 'PENDING', occAt: new Date(now.getTime() - 3600000) },
  ];

  for (const ob of planOutboxEvents) {
    await clients.treatmentPlan.query(
      `INSERT INTO treatment_plan_outbox (id, event_type, aggregate_id, payload, status, occurred_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
      [ob.eventType, ob.aggId, JSON.stringify(ob.payload), ob.status, ob.occAt]
    );
  }

  // Cập nhật External Clinical Reference trong Medical Record trỏ đến Treatment Plan 1
  if (enc1.encounterId && plan1Id) {
    await clients.medicalRecord.query(
      `INSERT INTO external_clinical_references (id, encounter_id, resource_type, resource_id, created_at)
       VALUES (gen_random_uuid(), $1, 'TREATMENT_PLAN', $2, NOW())
       ON CONFLICT (resource_type, resource_id) DO NOTHING`,
      [enc1.encounterId, plan1Id]
    );
  }

  console.log(`✅ Đã khởi tạo đầy đủ hệ thống Kế hoạch điều trị (Treatment Plans): Tất cả 4 trạng thái (ACTIVE, COMPLETED, DRAFT, CANCELLED), 4 trạng thái mục tiêu (DONE, IN_PROGRESS, PENDING, CANCELLED), Lịch sử phiên bản (Versions), Outbox events và liên kết ngược Medical Record.`);

  // ============================================================================
  // 11. HỎI ĐÁP & TƯ VẤN TRỰC TUYẾN (CONSULTATION THREADS, MESSAGES, ASSIGNMENTS & ESCALATIONS)
  // ============================================================================
  console.log('\n--- BƯỚC 11: KHỞI TẠO HỆ THỐNG TƯ VẤN BÁC SĨ (CONSULTATION TOÀN DIỆN) ---');

  // --- THREAD 1: ANSWERED (Nguyễn Minh Anh - BS. Lê Thu Hà) ---
  const thread1Id = crypto.randomUUID();
  await clients.consultation.query(
    `INSERT INTO consultation_threads (
      id, patient_id, appointment_id, subject, status, assigned_doctor_id, last_sequence_no,
      last_message_at, created_by_account_id, version, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, 'ANSWERED', $5, 3,
      NOW() - INTERVAL '10 minutes', $6, 3, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '10 minutes'
    )`,
    [
      thread1Id,
      demoPatient.id,
      seededAppointments[0].appointmentId,
      'Tư vấn chế độ bổ sung canxi và giảm ốm nghén tuần 22',
      attendingDoctor.id,
      demoPatient.accountId,
    ]
  );

  // Phân công bác sĩ Thread 1 (Assignment ACTIVE)
  await clients.consultation.query(
    `INSERT INTO consultation_assignments (id, thread_id, doctor_id, status, assigned_by, assigned_at, ended_at)
     VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', $3, NOW() - INTERVAL '3 hours', NULL)`,
    [thread1Id, attendingDoctor.id, receptionistList[0].accountId]
  );

  // Tin nhắn Thread 1
  const t1Msg1 = 'Chào Bác sĩ Hà ạ! Dạo này em hay bị chuột rút bắp chân vào ban đêm khi ngủ, em có cần tăng liều Canxi Corbiere không hay uống thêm magie ạ?';
  const t1Msg2 = 'Chào Minh Anh! Ở tuần 22, thai nhi phát triển hệ xương nhanh nên nhu cầu canxi và magie tăng cao. Em tiếp tục duy trì 1 ống Canxi Corbiere sau ăn sáng, và Bác sĩ kê thêm Magne-B6 uống ngày 2 viên (sáng 1, trưa 1) trong 10 ngày để giảm hẳn tình trạng co rút cơ nhé. Uống nhiều nước và kê cao chân khi ngủ em nhé!';
  const t1Msg3 = 'Dạ vâng em cảm ơn Bác sĩ Hà nhiều ạ! Em sẽ uống theo đúng đơn và duy trì kê gối cao chân khi ngủ ạ.';

  await clients.consultation.query(
    `INSERT INTO consultation_messages (id, thread_id, sequence_no, sender_account_id, sender_type, client_message_id, body, body_hash, sent_at)
     VALUES 
      (gen_random_uuid(), $1, 1, $2, 'PATIENT', gen_random_uuid(), $3, $4, NOW() - INTERVAL '3 hours'),
      (gen_random_uuid(), $1, 2, $5, 'DOCTOR', gen_random_uuid(), $6, $7, NOW() - INTERVAL '40 minutes'),
      (gen_random_uuid(), $1, 3, $2, 'PATIENT', gen_random_uuid(), $8, $9, NOW() - INTERVAL '10 minutes')`,
    [
      thread1Id, demoPatient.accountId, t1Msg1, sha256(t1Msg1),
      attendingDoctor.accountId, t1Msg2, sha256(t1Msg2),
      t1Msg3, sha256(t1Msg3)
    ]
  );

  // --- THREAD 2: REOPENED (Phạm Quỳnh Chi - BS. Trần Thanh Mai chuyển sang PGS. Nguyễn Quang Minh) ---
  const thread2Id = crypto.randomUUID();
  const chiPatientConsult = patientList[3]; // Phạm Quỳnh Chi (High Risk)
  const drMaiObj = doctorList[2]; // ThS. BS. Trần Thanh Mai
  const drMinhObj = doctorList[1]; // PGS. TS. BS. Nguyễn Quang Minh

  await clients.consultation.query(
    `INSERT INTO consultation_threads (
      id, patient_id, appointment_id, subject, status, assigned_doctor_id, last_sequence_no,
      last_message_at, created_by_account_id, version, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, 'REOPENED', $5, 4,
      NOW() - INTERVAL '5 minutes', $6, 4, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 minutes'
    )`,
    [
      thread2Id,
      chiPatientConsult.id,
      seededAppointments[3].appointmentId,
      'Khẩn cấp: Đau tức bụng dưới từng cơn và cử động thai máy giảm sau khi đi bộ',
      drMinhObj.id,
      chiPatientConsult.accountId,
    ]
  );

  // Phân công Thread 2: Lịch sử chuyển giao bác sĩ (ENDED -> ACTIVE)
  await clients.consultation.query(
    `INSERT INTO consultation_assignments (id, thread_id, doctor_id, status, assigned_by, assigned_at, ended_at)
     VALUES 
      (gen_random_uuid(), $1, $2, 'ENDED', $4, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '2 hours'),
      (gen_random_uuid(), $1, $3, 'ACTIVE', $5, NOW() - INTERVAL '2 hours', NULL)`,
    [thread2Id, drMaiObj.id, drMinhObj.id, receptionistList[0].accountId, drMaiObj.accountId]
  );

  // Tin nhắn Thread 2 (PATIENT, SYSTEM, DOCTOR, PATIENT)
  const t2Msg1 = 'Chào Bác sĩ! Chiều nay em thấy bụng dưới có cơn gò cứng lại 3 lần, bé ít máy hơn hẳn so với hôm qua. Em rất lo lắng vì từng có tiền sử sinh non ở tuần 35 lần trước ạ.';
  const t2Msg2 = '[HỆ THỐNG AN TÂM]: Đã kích hoạt Cảnh báo khẩn cấp (Escalation) - Bác sĩ chuyên khoa Bào thai & Cấp cứu Sản đang tiếp nhận xử lý ưu tiên.';
  const t2Msg3 = 'Chào Quỳnh Chi! Với thai 34 tuần có cơn co gò tử cung và thai máy giảm, em cần nằm nghiêng trái ngay, uống 1 ly nước ấm và đếm cử động thai trong 60 phút. Nếu trong 1 giờ có trên 2 cơn gò cứng hoặc thai máy dưới 3 lần, em và người nhà phải đến ngay Cấp cứu Sản Bệnh viện An Tâm để đo Monitoring tim thai NST nhé!';
  const t2Msg4 = 'Dạ em đã đến viện và vừa hoàn tất chạy Monitoring NST tại Bệnh viện An Tâm rồi ạ! Tim thai 145 ck/p dao động tốt, cơn gò đã giãn ra. Em mở lại thread để cập nhật tình hình với Bác sĩ ạ.';

  await clients.consultation.query(
    `INSERT INTO consultation_messages (id, thread_id, sequence_no, sender_account_id, sender_type, client_message_id, body, body_hash, sent_at)
     VALUES 
      (gen_random_uuid(), $1, 1, $2, 'PATIENT', gen_random_uuid(), $3, $4, NOW() - INTERVAL '6 hours'),
      (gen_random_uuid(), $1, 2, $5, 'SYSTEM', gen_random_uuid(), $6, $7, NOW() - INTERVAL '5 hours 50 minutes'),
      (gen_random_uuid(), $1, 3, $8, 'DOCTOR', gen_random_uuid(), $9, $10, NOW() - INTERVAL '2 hours'),
      (gen_random_uuid(), $1, 4, $2, 'PATIENT', gen_random_uuid(), $11, $12, NOW() - INTERVAL '5 minutes')`,
    [
      thread2Id, chiPatientConsult.accountId, t2Msg1, sha256(t2Msg1),
      adminAccountId, t2Msg2, sha256(t2Msg2),
      drMinhObj.accountId, t2Msg3, sha256(t2Msg3),
      t2Msg4, sha256(t2Msg4)
    ]
  );

  // Escalation Thread 2: RESOLVED
  const esc2Id = crypto.randomUUID();
  await clients.consultation.query(
    `INSERT INTO consultation_escalations (
      id, thread_id, reason_code, detail, status,
      raised_by_account_id, raised_at,
      acknowledged_by_account_id, acknowledged_at,
      resolved_by_account_id, resolved_at, resolution_note,
      version, created_at, updated_at
    ) VALUES (
      $1, $2, 'COMPLICATION_RISK', $3, 'RESOLVED',
      $4, NOW() - INTERVAL '5 hours 50 minutes',
      $5, NOW() - INTERVAL '5 hours 40 minutes',
      $6, NOW() - INTERVAL '1 hour', $7,
      2, NOW() - INTERVAL '5 hours 50 minutes', NOW() - INTERVAL '1 hour'
    )`,
    [
      esc2Id,
      thread2Id,
      'Thai phụ 34 tuần có triệu chứng cơn gò tử cung dọa sinh non và giảm cử động thai trên nền nguy cơ cao.',
      chiPatientConsult.accountId,
      receptionistList[0].accountId,
      drMinhObj.accountId,
      'Thai phụ đã đến viện đo NST và siêu âm Doppler rốn. Tim thai bình thường 145 ck/p, cổ tử cung đóng kín, đã hướng dẫn dùng thuốc giảm co Spasfon và hẹn tái khám sau 3 ngày.'
    ]
  );

  // --- THREAD 3: ASSIGNED (Trần Thị Bích Ngọc - BS. Phạm Thùy Dương) ---
  const thread3Id = crypto.randomUUID();
  const bichNgocPatient = patientList[1];
  const drDuongObj = doctorList[5];

  await clients.consultation.query(
    `INSERT INTO consultation_threads (
      id, patient_id, appointment_id, subject, status, assigned_doctor_id, last_sequence_no,
      last_message_at, created_by_account_id, version, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, 'ASSIGNED', $5, 1,
      NOW() - INTERVAL '25 minutes', $6, 1, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '25 minutes'
    )`,
    [
      thread3Id,
      bichNgocPatient.id,
      seededAppointments[1].appointmentId,
      'Tư vấn chỉ số nước ối AFI và kết quả đường huyết trước giờ khám',
      drDuongObj.id,
      bichNgocPatient.accountId,
    ]
  );

  await clients.consultation.query(
    `INSERT INTO consultation_assignments (id, thread_id, doctor_id, status, assigned_by, assigned_at, ended_at)
     VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', $3, NOW() - INTERVAL '25 minutes', NULL)`,
    [thread3Id, drDuongObj.id, receptionistList[1].accountId]
  );

  const t3Msg1 = 'Em chào Bác sĩ Dương ạ! Em vừa nhận được kết quả xét nghiệm đường huyết và siêu âm có ghi AFI 16cm. Chiều nay em có lịch khám với Bác sĩ, Bác sĩ xem trước giúp em với ạ.';
  await clients.consultation.query(
    `INSERT INTO consultation_messages (id, thread_id, sequence_no, sender_account_id, sender_type, client_message_id, body, body_hash, sent_at)
     VALUES (gen_random_uuid(), $1, 1, $2, 'PATIENT', gen_random_uuid(), $3, $4, NOW() - INTERVAL '25 minutes')`,
    [thread3Id, bichNgocPatient.accountId, t3Msg1, sha256(t3Msg1)]
  );

  // Escalation Thread 3: ACKNOWLEDGED
  const esc3Id = crypto.randomUUID();
  await clients.consultation.query(
    `INSERT INTO consultation_escalations (
      id, thread_id, reason_code, detail, status,
      raised_by_account_id, raised_at,
      acknowledged_by_account_id, acknowledged_at,
      version, created_at, updated_at
    ) VALUES (
      $1, $2, 'SECOND_OPINION', $3, 'ACKNOWLEDGED',
      $4, NOW() - INTERVAL '25 minutes',
      $5, NOW() - INTERVAL '15 minutes',
      1, NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '15 minutes'
    )`,
    [
      esc3Id,
      thread3Id,
      'Thai phụ đề nghị chuyên gia đái tháo đường thai kỳ hội chẩn trước ca khám trực tiếp chiều nay.',
      bichNgocPatient.accountId,
      receptionistList[1].accountId
    ]
  );

  // --- THREAD 4: OPEN (Đỗ Thu Trang - Chưa phân công bác sĩ) ---
  const thread4Id = crypto.randomUUID();
  const trangPatient = patientList[6];

  await clients.consultation.query(
    `INSERT INTO consultation_threads (
      id, patient_id, appointment_id, subject, status, assigned_doctor_id, last_sequence_no,
      last_message_at, created_by_account_id, version, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, 'OPEN', NULL, 1,
      NOW() - INTERVAL '40 minutes', $5, 1, NOW() - INTERVAL '40 minutes', NOW() - INTERVAL '40 minutes'
    )`,
    [
      thread4Id,
      trangPatient.id,
      seededAppointments[6].appointmentId,
      'Hỏi về nôn nghén kéo dài sang tuần 20 và hiện tượng chóng mặt khi đứng dậy',
      trangPatient.accountId,
    ]
  );

  const t4Msg1 = 'Chào các bác sĩ phòng khám An Tâm, em mang thai tuần thứ 20 rồi mà vẫn nôn khan nhiều sau bữa tối, sáng nay đứng dậy bị hoa mắt choáng váng. Em muốn hỏi có loại vitamin nào dễ uống hoặc giảm nghén tốt không ạ?';
  await clients.consultation.query(
    `INSERT INTO consultation_messages (id, thread_id, sequence_no, sender_account_id, sender_type, client_message_id, body, body_hash, sent_at)
     VALUES (gen_random_uuid(), $1, 1, $2, 'PATIENT', gen_random_uuid(), $3, $4, NOW() - INTERVAL '40 minutes')`,
    [thread4Id, trangPatient.accountId, t4Msg1, sha256(t4Msg1)]
  );

  // Escalation Thread 4: OPEN
  const esc4Id = crypto.randomUUID();
  await clients.consultation.query(
    `INSERT INTO consultation_escalations (
      id, thread_id, reason_code, detail, status,
      raised_by_account_id, raised_at,
      version, created_at, updated_at
    ) VALUES (
      $1, $2, 'URGENT_SYMPTOMS', $3, 'OPEN',
      $4, NOW() - INTERVAL '40 minutes',
      1, NOW() - INTERVAL '40 minutes', NOW() - INTERVAL '40 minutes'
    )`,
    [
      esc4Id,
      thread4Id,
      'Nôn nghén kéo dài đến quý 2 kèm hạ huyết áp tư thế, cần phân công bác sĩ tư vấn sớm.',
      trangPatient.accountId
    ]
  );

  // --- THREAD 5: CLOSED (Lê Ngọc Mai - BS. Đặng Kim Oanh) ---
  const thread5Id = crypto.randomUUID();
  const maiPatient = patientList[2];
  const drOanhObj = doctorList[3];

  await clients.consultation.query(
    `INSERT INTO consultation_threads (
      id, patient_id, appointment_id, subject, status, assigned_doctor_id, last_sequence_no,
      last_message_at, created_by_account_id, version, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, 'CLOSED', $5, 4,
      NOW() - INTERVAL '12 hours', $6, 3, NOW() - INTERVAL '24 hours', NOW() - INTERVAL '12 hours'
    )`,
    [
      thread5Id,
      maiPatient.id,
      seededAppointments[2].appointmentId,
      'Hướng dẫn chuẩn bị nhịn ăn trước khi làm nghiệm pháp dung nạp đường OGTT 75g',
      drOanhObj.id,
      maiPatient.accountId,
    ]
  );

  await clients.consultation.query(
    `INSERT INTO consultation_assignments (id, thread_id, doctor_id, status, assigned_by, assigned_at, ended_at)
     VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', $3, NOW() - INTERVAL '24 hours', NULL)`,
    [thread5Id, drOanhObj.id, receptionistList[0].accountId]
  );

  const t5Msg1 = 'Bác sĩ cho em hỏi, tối nay trước khi làm nghiệm pháp OGTT 75g sáng mai thì em cần nhịn ăn từ mấy giờ và có được uống nước lọc không ạ?';
  const t5Msg2 = 'Chào Ngọc Mai! Em cần nhịn ăn tối thiểu 8 tiếng (từ sau 22h tối nay). Vẫn được uống nước lọc ấm lượng vừa phải để đỡ khát. Sáng mai đến bệnh viện lúc 7h30 chưa ăn sáng nhé em!';
  const t5Msg3 = 'Dạ em cảm ơn bác sĩ nhiều ạ, em đã nắm rõ rồi ạ!';
  const t5Msg4 = 'Cuộc tư vấn đã được Bác sĩ đóng sau khi giải đáp đầy đủ thắc mắc chuẩn bị xét nghiệm.';

  await clients.consultation.query(
    `INSERT INTO consultation_messages (id, thread_id, sequence_no, sender_account_id, sender_type, client_message_id, body, body_hash, sent_at)
     VALUES 
      (gen_random_uuid(), $1, 1, $2, 'PATIENT', gen_random_uuid(), $3, $4, NOW() - INTERVAL '24 hours'),
      (gen_random_uuid(), $1, 2, $5, 'DOCTOR', gen_random_uuid(), $6, $7, NOW() - INTERVAL '20 hours'),
      (gen_random_uuid(), $1, 3, $2, 'PATIENT', gen_random_uuid(), $8, $9, NOW() - INTERVAL '18 hours'),
      (gen_random_uuid(), $1, 4, $10, 'SYSTEM', gen_random_uuid(), $11, $12, NOW() - INTERVAL '12 hours')`,
    [
      thread5Id, maiPatient.accountId, t5Msg1, sha256(t5Msg1),
      drOanhObj.accountId, t5Msg2, sha256(t5Msg2),
      t5Msg3, sha256(t5Msg3),
      adminAccountId, t5Msg4, sha256(t5Msg4)
    ]
  );

  // Escalation Thread 5: CANCELLED
  const esc5Id = crypto.randomUUID();
  await clients.consultation.query(
    `INSERT INTO consultation_escalations (
      id, thread_id, reason_code, detail, status,
      raised_by_account_id, raised_at,
      resolution_note,
      version, created_at, updated_at
    ) VALUES (
      $1, $2, 'OTHER', $3, 'CANCELLED',
      $4, NOW() - INTERVAL '23 hours',
      'Thai phụ xác nhận bấm nhầm nút Yêu cầu khẩn cấp trên ứng dụng, đã hủy yêu cầu.',
      2, NOW() - INTERVAL '23 hours', NOW() - INTERVAL '22 hours'
    )`,
    [
      esc5Id,
      thread5Id,
      'Thai phụ thao tác nhầm nút Báo động khẩn cấp trên ứng dụng di động.',
      maiPatient.accountId
    ]
  );

  // --- SỰ KIỆN OUTBOX (CONSULTATION OUTBOX EVENTS) ---
  const consultationOutboxEvents = [
    { eventType: 'consultation.thread_created.v1', aggId: thread1Id, payload: { threadId: thread1Id, patientId: demoPatient.id, subject: 'Tư vấn bổ sung canxi', status: 'OPEN' }, status: 'PUBLISHED', occAt: new Date(now.getTime() - 3 * 3600000) },
    { eventType: 'consultation.doctor_assigned.v1', aggId: thread1Id, payload: { threadId: thread1Id, doctorId: attendingDoctor.id, status: 'ASSIGNED' }, status: 'PUBLISHED', occAt: new Date(now.getTime() - 3 * 3600000) },
    { eventType: 'consultation.message_sent.v1', aggId: thread1Id, payload: { threadId: thread1Id, senderRole: 'DOCTOR', sequenceNo: 2 }, status: 'PUBLISHED', occAt: new Date(now.getTime() - 40 * 60000) },
    { eventType: 'consultation.escalation_raised.v1', aggId: thread2Id, payload: { threadId: thread2Id, escalationId: esc2Id, reasonCode: 'COMPLICATION_RISK' }, status: 'PUBLISHED', occAt: new Date(now.getTime() - 5 * 3600000) },
    { eventType: 'consultation.escalation_resolved.v1', aggId: thread2Id, payload: { threadId: thread2Id, escalationId: esc2Id, resolvedBy: drMinhObj.id }, status: 'PUBLISHED', occAt: new Date(now.getTime() - 60 * 60000) },
    { eventType: 'consultation.thread_closed.v1', aggId: thread5Id, payload: { threadId: thread5Id, closedBy: drOanhObj.id, status: 'CLOSED' }, status: 'PUBLISHED', occAt: new Date(now.getTime() - 12 * 3600000) },
  ];

  for (const ob of consultationOutboxEvents) {
    await clients.consultation.query(
      `INSERT INTO consultation_outbox (id, event_type, aggregate_id, payload, status, occurred_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
      [ob.eventType, ob.aggId, JSON.stringify(ob.payload), ob.status, ob.occAt]
    );
  }

  console.log(`✅ Đã khởi tạo đầy đủ hệ thống Tư vấn trực tuyến (Consultation): Tất cả 5 trạng thái Thread (OPEN, ASSIGNED, ANSWERED, CLOSED, REOPENED), 4 trạng thái Escalation (OPEN, ACKNOWLEDGED, RESOLVED, CANCELLED), Phân công bác sĩ đa cấp (ACTIVE, ENDED), Tin nhắn đa vai trò và Outbox events.`);

  // ============================================================================
  // 12. THÔNG BÁO HỆ THỐNG (NOTIFICATIONS)
  // ============================================================================
  console.log('\n--- BƯỚC 12: KHỞI TẠO THÔNG BÁO HỆ THỐNG (NOTIFICATIONS) ---');
  const notificationsDef = [
    {
      accId: demoPatient.accountId,
      category: 'BOOKING',
      title: 'Đặt lịch khám thành công',
      body: 'Lịch khám [Khám thai chuyên gia & tư vấn dinh dưỡng] mã AT-2026-0001 với BS. CKII. Lê Thu Hà lúc 09:00 đã được xác nhận thành công.',
    },
    {
      accId: demoPatient.accountId,
      category: 'QUEUE',
      title: 'Đã đến lượt khám của bạn',
      body: 'Số phiếu A001 của bạn đã được mời vào phòng khám P.201 - BS. CKII. Lê Thu Hà. Xin mời bạn vào phòng khám.',
    },
    {
      accId: demoPatient.accountId,
      category: 'RESULT',
      title: 'Đã có kết quả siêu âm hình thái học',
      body: 'Kết quả siêu âm 4D hình thái thai nhi tuần 22 của bạn đã được bác sĩ cập nhật vào hồ sơ bệnh án điện tử.',
    },
  ];

  for (const notif of notificationsDef) {
    await clients.notification.query(
      `INSERT INTO notifications (
        id, source_event_id, event_type, recipient_account_id, template_code,
        category, title, body, created_at
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), 'SYSTEM_NOTIFICATION', $1, 'SYSTEM_ALERT',
        $2, $3, $4, NOW()
      )`,
      [notif.accId, notif.category, notif.title, notif.body]
    );
  }
  console.log(`✅ Đã khởi tạo Thông báo tự động trong hệ thống Notification.`);

  // ============================================================================
  // 13. NHẬT KÝ KIỂM TOÁN AN TOÀN DỮ LIỆU (AUDIT LOGS)
  // ============================================================================
  console.log('\n--- BƯỚC 13: KHỞI TẠO NHẬT KÝ KIỂM TOÁN HỆ THỐNG (AUDIT LOG) ---');
  const auditEntriesDef = [
    {
      service: 'patient-service',
      type: 'PATIENT_PROFILE',
      id: demoPatient.id,
      actorId: demoPatient.accountId,
      actorType: 'PATIENT',
      action: 'UPSERT_PROFILE',
      res: 'SUCCESS',
      desc: 'Khởi tạo hồ sơ thai phụ và mã hóa dữ liệu căn cước công dân.',
    },
    {
      service: 'appointment-service',
      type: 'APPOINTMENT',
      id: appointmentsData[0].code,
      actorId: demoPatient.accountId,
      actorType: 'PATIENT',
      action: 'BOOK_APPOINTMENT',
      res: 'SUCCESS',
      desc: 'Đặt lịch khám trực tuyến với BS. CKII. Lê Thu Hà.',
    },
    {
      service: 'billing-service',
      type: 'INVOICE',
      id: `INV-${appointmentsData[0].code.replace('AT-', '')}`,
      actorId: receptionistList[0].accountId,
      actorType: 'RECEPTIONIST',
      action: 'COLLECT_PAYMENT',
      res: 'SUCCESS',
      desc: 'Xác thực thanh toán viện phí chuyển khoản ngân hàng.',
    },
  ];

  for (const entry of auditEntriesDef) {
    await clients.auditLog.query(
      `INSERT INTO audit_entries (
        id, event_id, event_type, event_version, source_service, aggregate_type,
        aggregate_id, actor_id, actor_type, action, result, patient_id,
        changed_fields, sensitivity, payload_hash, occurred_at, ingested_at
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), 'AUDIT_EVENT', 1, $1, $2,
        $3, $4, $5, $6, $7, $8,
        ARRAY['initial_seed']::text[], 'RESTRICTED', $9, NOW(), NOW()
      )`,
      [
        entry.service, entry.type, entry.id, entry.actorId, entry.actorType,
        entry.action, entry.res, demoPatient.id, sha256(entry.desc),
      ]
    );
  }
  console.log(`✅ Đã khởi tạo Nhật ký kiểm toán hệ thống (Audit Entries).`);

  // ============================================================================
  // ĐÓNG TẤT CẢ KẾT NỐI DATABASE
  // ============================================================================
  await Promise.all(Object.values(clients).map((c) => c.end()));

  console.log('\n================================================================');
  console.log('🎉 SEED DỮ LIỆU TOÀN DIỆN THÀNH CÔNG RỰC RỠ 100%!');
  console.log('================================================================');
  console.log('\n📋 THÔNG TIN TÀI KHOẢN ĐĂNG NHẬP KIỂM THỬ:');
  console.log('----------------------------------------------------------------');
  console.log(`🔑 Mật khẩu chung cho TẤT CẢ tài khoản bên dưới: "${DEFAULT_PASSWORD}"`);
  console.log('----------------------------------------------------------------');
  console.log('1. Quản trị viên (ADMIN):');
  console.log('   - Email: admin@antam.local');
  console.log('2. Bác sĩ chuyên khoa (DOCTOR):');
  console.log('   - Email: dr.lethuha@antam.local        (BS. CKII. Lê Thu Hà - Trưởng khoa Sản)');
  console.log('   - Email: dr.nguyenquangminh@antam.local (PGS. TS. BS. Nguyễn Quang Minh - Y học bào thai)');
  console.log('   - Email: dr.tranthanhmai@antam.local    (ThS. BS. Trần Thanh Mai - Sản phụ khoa)');
  console.log('   - Email: dr.dangkimoanh@antam.local     (BS. CKI. Đặng Kim Oanh - Y học bào thai)');
  console.log('   - Email: dr.vuhoanglong@antam.local     (BS. CKII. Vũ Hoàng Long - Hiếm muộn & IVF)');
  console.log('   - Email: dr.phamthuyduong@antam.local   (BS. CKI. Phạm Thùy Dương - Bệnh lý thai kỳ)');
  console.log('3. Nhân viên Lễ tân (RECEPTIONIST):');
  console.log('   - Email: demo.receptionist@antam.local  (Trần Thu Ngân - Ban Tiếp đón)');
  console.log('   - Email: reception.hoangyen@antam.local (Hoàng Thị Yến - Quầy Tiếp đón T1)');
  console.log('4. Thai phụ / Bệnh nhân (PATIENT):');
  console.log('   - Email: demo.patient@antam.local       (Nguyễn Minh Anh - 0901000001 - Thai 22 tuần)');
  console.log('   - Email: patient.thanhhang@gmail.com    (Trần Thị Thanh Hằng - 0901234003 - Thai 12 tuần)');
  console.log('   - Email: patient.quynhchi@gmail.com     (Phạm Quỳnh Chi - 0901234007 - Thai 34 tuần)');
  console.log('----------------------------------------------------------------\n');
}

main().catch((err) => {
  console.error('\n❌ LỖI TRONG QUÁ TRÌNH SEED DỮ LIỆU:', err);
  process.exit(1);
});
