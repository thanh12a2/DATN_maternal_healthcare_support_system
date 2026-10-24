const { Client } = require('pg');
const argon2 = require('argon2');
const crypto = require('crypto');

const AUTH_URL = 'postgresql://auth:authpass@localhost:5433/auth?sslmode=disable';
const DOCTOR_URL = 'postgresql://doctor:doctorpass@localhost:5435/doctor?sslmode=disable';
const PATIENT_URL = 'postgresql://patient:patientpass@localhost:5434/patient?sslmode=disable';
const APPOINTMENT_URL = 'postgresql://appointment:appointmentpass@localhost:5438/appointment?sslmode=disable';
const BILLING_URL = 'postgresql://billing:billingpass@localhost:5439/billing?sslmode=disable';
const QUEUE_URL = 'postgresql://queue:queuepass@localhost:5441/queue?sslmode=disable';

const PEPPER = '1c55c01af1a821b2bf8a82051343ce2fd9ee5ed1fccd4eb8b50a38a9b2b83318';
const KEY_BASE64 = 'z2alpPJzDZUmMJOwG2yMZNp9ASkHBV1xWMvoVQ+XgLs=';

function encryptNationalId(val) {
  const key = Buffer.from(KEY_BASE64, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(val, 'utf8'), cipher.final()]);
  const ciphertext = [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    enc.toString('base64url'),
  ].join('.');
  const lookupHash = crypto.createHmac('sha256', PEPPER).update(val).digest('hex');
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

async function main() {
  console.log('--- BẮT ĐẦU DỌN SẠCH VÀ SEED DỮ LIỆU ĐẦY ĐỦ CHO HỆ THỐNG ---');

  const authClient = new Client({ connectionString: AUTH_URL });
  const doctorClient = new Client({ connectionString: DOCTOR_URL });
  const patientClient = new Client({ connectionString: PATIENT_URL });
  const appointmentClient = new Client({ connectionString: APPOINTMENT_URL });
  const billingClient = new Client({ connectionString: BILLING_URL });
  const queueClient = new Client({ connectionString: QUEUE_URL });

  await Promise.all([
    authClient.connect(),
    doctorClient.connect(),
    patientClient.connect(),
    appointmentClient.connect(),
    billingClient.connect(),
    queueClient.connect(),
  ]);

  console.log('1. Xóa sạch dữ liệu cũ trong các dịch vụ liên quan...');
  await queueClient.query('TRUNCATE stage_tickets, queue_journeys CASCADE;');
  await billingClient.query('TRUNCATE payments, invoice_lines, invoices CASCADE;');
  await appointmentClient.query('TRUNCATE appointment_assignment_history, appointment_audit_logs, appointment_outbox_events, slot_holds, appointments CASCADE;');
  await patientClient.query('TRUNCATE emergency_contacts, patient_audit_logs, patients CASCADE;');
  await doctorClient.query('TRUNCATE doctor_availabilities, doctor_schedules, doctor_specialties, doctor_profiles, doctors, specialties, consultation_ranks CASCADE;');
  await authClient.query('TRUNCATE auth_sessions, password_reset_tokens, credentials, account_roles, accounts CASCADE;');

  console.log('2. Kiểm tra và đảm bảo các vai trò (roles) trong Auth...');
  const rolesDef = [
    ['PATIENT', 'Patient / Thai phụ'],
    ['DOCTOR', 'Doctor / Bác sĩ'],
    ['NURSE', 'Nurse or Midwife / Y tá, hộ sinh'],
    ['RECEPTIONIST', 'Receptionist / Lễ tân'],
    ['ADMIN', 'System administrator'],
  ];

  const roleMap = {};
  for (const [code, desc] of rolesDef) {
    let r = await authClient.query('SELECT id FROM roles WHERE code = $1', [code]);
    if (r.rows.length === 0) {
      r = await authClient.query(
        'INSERT INTO roles (id, code, description) VALUES (gen_random_uuid(), $1, $2) RETURNING id',
        [code, desc]
      );
    }
    roleMap[code] = r.rows[0].id;
  }

  console.log('3. Khởi tạo danh mục Chuyên khoa Sản Phụ Khoa...');
  const specialtiesDef = [
    {
      code: 'OBSTETRICS',
      name: 'Sản khoa',
      description: 'Chăm sóc thai kỳ, quản lý chuyển dạ, đỡ sinh thường và phẫu thuật mổ lấy thai an toàn.',
    },
    {
      code: 'GYNECOLOGY',
      name: 'Phụ khoa',
      description: 'Khám, chẩn đoán và điều trị toàn diện các bệnh lý phụ khoa, viêm nhiễm, u xơ, u buồng trứng và tầm soát ung thư cổ tử cung.',
    },
    {
      code: 'PERINATOLOGY',
      name: 'Y học bào thai & Chẩn đoán trước sinh',
      description: 'Siêu âm hình thái học thai nhi 4D/5D, sàng lọc dị tật bẩm sinh, can thiệp và theo dõi thai kỳ nguy cơ cao.',
    },
    {
      code: 'REPRODUCTIVE_ENDOCRINOLOGY',
      name: 'Hiếm muộn & Hỗ trợ sinh sản',
      description: 'Khám, tư vấn vô sinh - hiếm muộn, kích thích buồng trứng, bơm tinh trùng (IUI) và thụ tinh trong ống nghiệm (IVF).',
    },
    {
      code: 'MATERNAL_MEDICINE',
      name: 'Bệnh lý nội khoa thai kỳ',
      description: 'Quản lý và điều trị các bệnh lý nội khoa đi kèm thai kỳ: đái tháo đường thai kỳ, tiền sản giật, tim mạch thai kỳ.',
    },
  ];

  const specialtyMap = {};
  for (const s of specialtiesDef) {
    const res = await doctorClient.query(
      `INSERT INTO specialties (id, code, name, description, status, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE', NOW()) RETURNING id`,
      [s.code, s.name, s.description]
    );
    specialtyMap[s.code] = res.rows[0].id;
  }

  console.log('4. Khởi tạo danh mục Hạng bác sĩ & Biểu phí tư vấn...');
  const ranksDef = [
    {
      code: 'BASIC',
      name: 'Bác sĩ Sản phụ khoa',
      expMin: 3,
      desc: 'Bác sĩ chuyên khoa khám, tư vấn và chăm sóc sức khỏe phụ nữ, theo dõi thai kỳ định kỳ.',
    },
    {
      code: 'SPECIALIST_I',
      name: 'Bác sĩ Chuyên khoa I (CKI)',
      expMin: 6,
      desc: 'Bác sĩ đào tạo sau đại học Chuyên khoa I, giàu kinh nghiệm khám và xử lý các ca thai kỳ và phụ khoa chuyên sâu.',
    },
    {
      code: 'SPECIALIST_II',
      name: 'Bác sĩ Chuyên khoa II (CKII)',
      expMin: 12,
      desc: 'Bác sĩ Chuyên khoa II, chuyên gia đầu ngành trong lĩnh vực phẫu thuật sản phụ khoa và chẩn đoán trước sinh.',
    },
    {
      code: 'HEAD_DOCTOR',
      name: 'Trưởng khoa / Chuyên gia cao cấp',
      expMin: 15,
      desc: 'Trưởng bộ môn, Trưởng/Phó khoa lâm sàng, hội chẩn và xử lý các ca bệnh phức tạp, thai kỳ nguy cơ đặc biệt cao.',
    },
  ];

  for (const r of ranksDef) {
    await doctorClient.query(
      `INSERT INTO consultation_ranks (id, code, name, experience_years_min, description, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ACTIVE')`,
      [r.code, r.name, r.expMin, r.desc]
    );
  }

  const defaultAdminHash = await argon2.hash('Admin123!');

  async function createAccount(email, password, roleCode) {
    const pwHash = password === 'Admin123!' ? defaultAdminHash : await argon2.hash(password);
    const accRes = await authClient.query(
      `INSERT INTO accounts (id, email, status, updated_at) VALUES (gen_random_uuid(), $1, 'ACTIVE', NOW()) RETURNING id`,
      [email]
    );
    const accountId = accRes.rows[0].id;
    await authClient.query(
      `INSERT INTO credentials (account_id, password_hash) VALUES ($1, $2)`,
      [accountId, pwHash]
    );
    await authClient.query(
      `INSERT INTO account_roles (account_id, role_id) VALUES ($1, $2)`,
      [accountId, roleMap[roleCode]]
    );
    return accountId;
  }

  console.log('5. Tạo các tài khoản Quản trị viên (ADMIN)...');
  await createAccount('admin@test.local', 'Admin123!', 'ADMIN');
  await createAccount('admin.ql@antam.local', 'Admin123!', 'ADMIN');

  console.log('6. Tạo các tài khoản Điều dưỡng (NURSE)...');
  const nursesDef = [
    { email: 'nurse.lananh@antam.local', phone: '0912111001' },
    { email: 'nurse.myduyen@antam.local', phone: '0912111002' },
    { email: 'nurse.phuongthao@antam.local', phone: '0912111003' },
    { email: 'nurse.thuytrang@antam.local', phone: '0912111004' },
    { email: 'nurse.ngocmai@antam.local', phone: '0912111005' },
    { email: 'nurse.hongngoc@antam.local', phone: '0912111006' },
  ];
  for (const n of nursesDef) {
    await createAccount(n.email, n.phone, 'NURSE');
  }

  console.log('7. Tạo các tài khoản Lễ tân (RECEPTIONIST)...');
  const receptionistsDef = [
    { email: 'letan.kimchi@antam.local', phone: '0912222001' },
    { email: 'letan.thanhhang@antam.local', phone: '0912222002' },
  ];
  for (const rc of receptionistsDef) {
    await createAccount(rc.email, rc.phone, 'RECEPTIONIST');
  }

  console.log('8. Tạo danh sách Bác sĩ Sản Phụ Khoa...');
  const doctorsDef = [
    {
      fullName: 'BS. CKII. Nguyễn Thị Hồng Tâm',
      email: 'dr.hongtam@antam.local',
      phone: '0903112001',
      licenseNumber: '001234/BYT-CCHN',
      rank: 'HEAD_DOCTOR',
      title: 'BS. CKII',
      startYear: 2006,
      specialtyCode: 'OBSTETRICS',
      bio: 'Hơn 18 năm kinh nghiệm công tác tại Bệnh viện Phụ sản Trung ương. Chuyên sâu về phẫu thuật sản khoa, quản lý thai nghén nguy cơ cao và kỹ thuật đỡ sinh không đau.',
    },
    {
      fullName: 'BS. CKI. Trần Quốc Việt',
      email: 'dr.quocviet@antam.local',
      phone: '0903112002',
      licenseNumber: '002345/BYT-CCHN',
      rank: 'SPECIALIST_I',
      title: 'BS. CKI',
      startYear: 2014,
      specialtyCode: 'GYNECOLOGY',
      bio: 'Bác sĩ CKI chuyên ngành Phụ khoa, tốt nghiệp Đại học Y Hà Nội. Thành thạo phẫu thuật nội soi phụ khoa, điều trị u xơ tử cung, polyp và tầm soát ung thư cổ tử cung.',
    },
    {
      fullName: 'ThS. BS. Lê Thu Hà',
      email: 'dr.thuha@antam.local',
      phone: '0903112003',
      licenseNumber: '003456/BYT-CCHN',
      rank: 'SPECIALIST_I',
      title: 'ThS. BS',
      startYear: 2013,
      specialtyCode: 'PERINATOLOGY',
      bio: 'Thạc sĩ Bác sĩ Sản phụ khoa, tu nghiệp chuyên sâu về Y học bào thai tại Pháp. Chuyên gia siêu âm hình thái học thai nhi và sàng lọc dị tật tiền sản.',
    },
    {
      fullName: 'BS. CKII. Vũ Hoàng Nam',
      email: 'dr.hoangnam@antam.local',
      phone: '0903112004',
      licenseNumber: '004567/BYT-CCHN',
      rank: 'SPECIALIST_II',
      title: 'BS. CKII',
      startYear: 2008,
      specialtyCode: 'REPRODUCTIVE_ENDOCRINOLOGY',
      bio: 'Hơn 16 năm kinh nghiệm điều trị vô sinh - hiếm muộn. Từng chủ nhiệm nhiều đề tài can thiệp IUI, thụ tinh ống nghiệm IVF thành công tỷ lệ cao.',
    },
    {
      fullName: 'BS. CKI. Phạm Thị Bích Ngọc',
      email: 'dr.bichngoc@antam.local',
      phone: '0903112005',
      licenseNumber: '005678/BYT-CCHN',
      rank: 'SPECIALIST_I',
      title: 'BS. CKI',
      startYear: 2015,
      specialtyCode: 'OBSTETRICS',
      bio: 'Bác sĩ Sản khoa tận tâm, chuyên môn vững vàng trong theo dõi chuyển dạ, chăm sóc sức khỏe mẹ và bé sau sinh.',
    },
    {
      fullName: 'BS. Đỗ Thị Phương Thảo',
      email: 'dr.phuongthao@antam.local',
      phone: '0903112006',
      licenseNumber: '006789/BYT-CCHN',
      rank: 'BASIC',
      title: 'BS. Đa khoa Sản',
      startYear: 2019,
      specialtyCode: 'GYNECOLOGY',
      bio: 'Tốt nghiệp Bác sĩ Nội trú Sản phụ khoa. Phụ trách khám phụ khoa tổng quát, tư vấn tiền hôn nhân và kế hoạch hóa gia đình.',
    },
    {
      fullName: 'BS. CKII. Hoàng Minh Đức',
      email: 'dr.minhduc@antam.local',
      phone: '0903112007',
      licenseNumber: '007890/BYT-CCHN',
      rank: 'SPECIALIST_II',
      title: 'BS. CKII',
      startYear: 2010,
      specialtyCode: 'MATERNAL_MEDICINE',
      bio: 'Chuyên gia điều trị các bệnh lý nội tiết, tim mạch và đái tháo đường trong thai kỳ. Phối hợp liên chuyên khoa điều trị tiền sản giật nặng.',
    },
    {
      fullName: 'BS. CKI. Đặng Kim Oanh',
      email: 'dr.kimoanh@antam.local',
      phone: '0903112008',
      licenseNumber: '008901/BYT-CCHN',
      rank: 'SPECIALIST_I',
      title: 'BS. CKI',
      startYear: 2016,
      specialtyCode: 'PERINATOLOGY',
      bio: 'Chứng chỉ Siêu âm Sản phụ khoa thực hành của Hiệp hội Siêu âm Sản Phụ khoa Quốc tế (ISUOG). Chuyên gia chọc ối và sinh thiết gai nhau.',
    },
  ];

  const now = new Date();
  const effectiveDate = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const doc of doctorsDef) {
    const accId = await createAccount(doc.email, doc.phone, 'DOCTOR');
    const docRes = await doctorClient.query(
      `INSERT INTO doctors (id, account_id, license_number, consultation_rank, status, version, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE', 1, NOW()) RETURNING id`,
      [accId, doc.licenseNumber, doc.rank]
    );
    const doctorId = docRes.rows[0].id;

    await doctorClient.query(
      `INSERT INTO doctor_profiles (doctor_id, full_name, professional_title, biography, practice_start_year, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [doctorId, doc.fullName, doc.title, doc.bio, doc.startYear]
    );

    const specId = specialtyMap[doc.specialtyCode];
    if (specId) {
      await doctorClient.query(
        `INSERT INTO doctor_specialties (doctor_id, specialty_id, is_primary)
         VALUES ($1, $2, true)`,
        [doctorId, specId]
      );
    }

    // Lịch khám từ Thứ 2 đến Thứ 7 (2 -> 7)
    for (let day = 2; day <= 7; day++) {
      await doctorClient.query(
        `INSERT INTO doctor_schedules (id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, effective_from, status, version, updated_at)
         VALUES (gen_random_uuid(), $1, $2, '08:00:00', '17:00:00', 30, $3, 'ACTIVE', 1, NOW())`,
        [doctorId, day, effectiveDate]
      );
    }
  }

  console.log('9. Tạo danh sách Bệnh nhân thai phụ...');
  const patientsDef = [
    {
      fullName: 'Nguyễn Minh Anh',
      email: 'patient.minhanh@gmail.com',
      phone: '0901234001',
      dob: '1995-06-15',
      nationalId: '001195000101',
      address: '12 Nguyễn Du, Phường Hàng Bài, Hoàn Kiếm, Hà Nội',
      emergencyName: 'Trần Văn Bình',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234002',
    },
    {
      fullName: 'Trần Thị Thanh Hằng',
      email: 'patient.thanhhang@gmail.com',
      phone: '0901234003',
      dob: '1993-09-22',
      nationalId: '001193000102',
      address: '45 Tràng Thi, Hàng Trống, Hoàn Kiếm, Hà Nội',
      emergencyName: 'Nguyễn Hoàng Long',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234004',
    },
    {
      fullName: 'Lê Ngọc Mai',
      email: 'patient.ngocmai@gmail.com',
      phone: '0901234005',
      dob: '1998-03-10',
      nationalId: '001198000103',
      address: '88 Cầu Giấy, Quan Hoa, Cầu Giấy, Hà Nội',
      emergencyName: 'Lê Văn Tuấn',
      emergencyRel: 'Bố đẻ',
      emergencyPhone: '0901234006',
    },
    {
      fullName: 'Phạm Quỳnh Chi',
      email: 'patient.quynhchi@gmail.com',
      phone: '0901234007',
      dob: '1992-12-05',
      nationalId: '001192000104',
      address: '156 Nguyễn Trãi, Thượng Đình, Thanh Xuân, Hà Nội',
      emergencyName: 'Vũ Mạnh Hùng',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234008',
    },
    {
      fullName: 'Hoàng Thùy Dương',
      email: 'patient.thuyduong@gmail.com',
      phone: '0901234009',
      dob: '1996-08-18',
      nationalId: '001196000105',
      address: '23 Lạc Long Quân, Bưởi, Tây Hồ, Hà Nội',
      emergencyName: 'Hoàng Văn Nam',
      emergencyRel: 'Bố đẻ',
      emergencyPhone: '0901234010',
    },
    {
      fullName: 'Vũ Thị Kim Ngân',
      email: 'patient.kimngan@gmail.com',
      phone: '0901234011',
      dob: '1994-11-30',
      nationalId: '001194000106',
      address: '74 Giải Phóng, Đồng Tâm, Hai Bà Trưng, Hà Nội',
      emergencyName: 'Đỗ Đức Thắng',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234012',
    },
    {
      fullName: 'Đỗ Thu Trang',
      email: 'patient.thutrang@gmail.com',
      phone: '0901234013',
      dob: '1997-04-25',
      nationalId: '001197000107',
      address: '102 Thái Hà, Trung Liệt, Đống Đa, Hà Nội',
      emergencyName: 'Phạm Hải Đăng',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234014',
    },
    {
      fullName: 'Bùi Phương Linh',
      email: 'patient.phuonglinh@gmail.com',
      phone: '0901234015',
      dob: '1999-01-14',
      nationalId: '001199000108',
      address: '55 Xã Đàn, Nam Đồng, Đống Đa, Hà Nội',
      emergencyName: 'Bùi Quang Vinh',
      emergencyRel: 'Bố đẻ',
      emergencyPhone: '0901234016',
    },
    {
      fullName: 'Đinh Thị Hồng Hạnh',
      email: 'patient.honghanh@gmail.com',
      phone: '0901234017',
      dob: '1991-07-08',
      nationalId: '001191000109',
      address: '36 Hoàng Hoa Thám, Thụy Khuê, Tây Hồ, Hà Nội',
      emergencyName: 'Trương Quốc Bảo',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234018',
    },
    {
      fullName: 'Phan Thị Bích Thủy',
      email: 'patient.bichthuy@gmail.com',
      phone: '0901234019',
      dob: '1995-10-12',
      nationalId: '001195000110',
      address: '19 Lê Văn Lương, Nhân Chính, Thanh Xuân, Hà Nội',
      emergencyName: 'Nguyễn Đình Trọng',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234020',
    },
    {
      fullName: 'Dương Yến Nhi',
      email: 'patient.yennhi@gmail.com',
      phone: '0901234021',
      dob: '2000-02-28',
      nationalId: '001200000111',
      address: '67 Trần Duy Hưng, Trung Hòa, Cầu Giấy, Hà Nội',
      emergencyName: 'Dương Thế Anh',
      emergencyRel: 'Bố đẻ',
      emergencyPhone: '0901234022',
    },
    {
      fullName: 'Võ Bảo Châu',
      email: 'patient.baochau@gmail.com',
      phone: '0901234023',
      dob: '1996-05-19',
      nationalId: '001196000112',
      address: '18 Lý Thường Kiệt, Phan Chu Trinh, Hoàn Kiếm, Hà Nội',
      emergencyName: 'Lê Quang Huy',
      emergencyRel: 'Chồng',
      emergencyPhone: '0901234024',
    },
  ];

  for (const pat of patientsDef) {
    const accId = await createAccount(pat.email, pat.phone, 'PATIENT');
    const { ciphertext, lookupHash } = encryptNationalId(pat.nationalId);
    const normName = removeAccents(pat.fullName);

    const patRes = await patientClient.query(
      `INSERT INTO patients (id, auth_account_id, full_name, normalized_full_name, date_of_birth, phone_number, national_id_ciphertext, national_id_lookup_hash, address, version, created_by_account_id, updated_by_account_id, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 1, $1, $1, NOW()) RETURNING id`,
      [accId, pat.fullName, normName, pat.dob, pat.phone, ciphertext, lookupHash, pat.address]
    );
    const patientId = patRes.rows[0].id;

    await patientClient.query(
      `INSERT INTO emergency_contacts (id, patient_id, full_name, relationship, phone_number, is_primary, priority, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, 1, NOW())`,
      [patientId, pat.emergencyName, pat.emergencyRel, pat.emergencyPhone]
    );
  }

  await Promise.all([
    authClient.end(),
    doctorClient.end(),
    patientClient.end(),
    appointmentClient.end(),
    billingClient.end(),
    queueClient.end(),
  ]);

  console.log('✅ SEED DỮ LIỆU HOÀN TẤT THÀNH CÔNG!');
}

main().catch((err) => {
  console.error('Lỗi khi seed dữ liệu:', err);
  process.exit(1);
});
