const { Client } = require('pg');

const CATALOG_URL = 'postgresql://catalog:catalogpass@localhost:5437/catalog?sslmode=disable';
const DOCTOR_URL = 'postgresql://doctor:doctorpass@localhost:5435/doctor?sslmode=disable';

async function seedCatalog() {
  console.log('--- SEEDING OBSTETRICS & GYNECOLOGY CATALOG DATA ---');

  const doctorClient = new Client({ connectionString: DOCTOR_URL });
  await doctorClient.connect();
  const specRes = await doctorClient.query('SELECT id, code FROM specialties');
  const specialtyMap = {};
  for (const row of specRes.rows) {
    specialtyMap[row.code] = row.id;
  }
  const defaultSpecialtyId = specialtyMap.OBGYN;
  if (!defaultSpecialtyId) {
    await doctorClient.end();
    throw new Error('Doctor DB must contain OBGYN specialty before catalog seeding.');
  }
  const specialtyAliases = {
    OBSTETRICS: defaultSpecialtyId,
    GYNECOLOGY: defaultSpecialtyId,
    PERINATOLOGY: defaultSpecialtyId,
    REPRODUCTIVE_ENDOCRINOLOGY: defaultSpecialtyId,
    MATERNAL_MEDICINE: defaultSpecialtyId,
  };
  await doctorClient.end();
  console.log('Loaded Specialties from Doctor DB:', Object.keys(specialtyMap));

  const client = new Client({ connectionString: CATALOG_URL });
  await client.connect();

  console.log('1. Làm sạch dữ liệu catalog cũ...');
  await client.query('DELETE FROM medical_service_tags');
  await client.query('DELETE FROM medical_service_categories');
  await client.query('DELETE FROM base_prices');
  await client.query('DELETE FROM medical_services');
  await client.query('DELETE FROM catalog_tags');
  await client.query('DELETE FROM service_categories');
  await client.query('DELETE FROM doctor_rank_surcharges');

  console.log('2. Tạo Phụ thu Hạng Bác sĩ (Doctor Rank Surcharges)...');
  const surcharges = [
    { rankCode: 'BASIC', amountMinor: 0, status: 'ACTIVE' },
    { rankCode: 'SPECIALIST_I', amountMinor: 100000, status: 'ACTIVE' },
    { rankCode: 'SPECIALIST_II', amountMinor: 250000, status: 'ACTIVE' },
    { rankCode: 'HEAD_DOCTOR', amountMinor: 400000, status: 'ACTIVE' },
  ];
  for (const s of surcharges) {
    await client.query(
      `INSERT INTO doctor_rank_surcharges (id, rank_code, amount_minor, currency, effective_from, status, version, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'VND', NOW() - INTERVAL '1 day', $3, 1, NOW(), NOW())`,
      [s.rankCode, s.amountMinor, s.status]
    );
  }

  console.log('3. Tạo Nhóm danh mục Dịch vụ Sản phụ khoa (Categories)...');
  const categoriesDef = [
    {
      code: 'KHAM_THAI',
      slug: 'kham-thai-dinh-ky',
      name: 'Khám thai & Quản lý thai kỳ',
      description: 'Dịch vụ khám thai định kỳ, theo dõi sức khỏe mẹ bầu và sự phát triển của thai nhi từng tuần',
      sortOrder: 1,
      status: 'ACTIVE',
    },
    {
      code: 'KHAM_PHU_KHOA',
      slug: 'kham-phu-khoa',
      name: 'Khám & Điều trị Phụ khoa',
      description: 'Khám tổng quát, điều trị viêm nhiễm, tầm soát sớm các bệnh lý phụ khoa ở phụ nữ',
      sortOrder: 2,
      status: 'ACTIVE',
    },
    {
      code: 'SIEU_AM_THAI',
      slug: 'sieu-am-thai',
      name: 'Siêu âm thai & Chẩn đoán hình ảnh',
      description: 'Siêu âm 2D, Doppler, siêu âm hình thái 4D/5D HD-Live phát hiện sớm dị tật thai nhi',
      sortOrder: 3,
      status: 'ACTIVE',
    },
    {
      code: 'XET_NGHIEM_SANG_LOC',
      slug: 'xet-nghiem-sang-loc-truoc-sinh',
      name: 'Xét nghiệm sàng lọc trước sinh',
      description: 'Xét nghiệm Double Test, Triple Test, NIPT không xâm lấn giải mã 23 cặp nhiễm sắc thể',
      sortOrder: 4,
      status: 'ACTIVE',
    },
    {
      code: 'HIEM_MUON_SINH_SAN',
      slug: 'hiem-muon-ho-tro-sinh-san',
      name: 'Hỗ trợ sinh sản & Kế hoạch hóa',
      description: 'Tư vấn hiếm muộn, theo dõi nang noãn, tư vấn tiền mang thai và các biện pháp kế hoạch hóa',
      sortOrder: 5,
      status: 'ACTIVE',
    },
    {
      code: 'GOI_THAI_SAN',
      slug: 'goi-cham-soc-thai-san',
      name: 'Gói chăm sóc thai sản toàn diện',
      description: 'Gói chăm sóc thai kỳ trọn gói từ những tuần đầu tiên cho tới lúc sinh và sau sinh',
      sortOrder: 6,
      status: 'ACTIVE',
    },
  ];

  const categoryMap = {};
  for (const cat of categoriesDef) {
    const res = await client.query(
      `INSERT INTO service_categories (id, code, slug, name, description, sort_order, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, code`,
      [cat.code, cat.slug, cat.name, cat.description, cat.sortOrder, cat.status]
    );
    categoryMap[res.rows[0].code] = res.rows[0].id;
  }

  console.log('4. Tạo Thẻ tag Dịch vụ (Tags)...');
  const tagsDef = [
    // AUDIENCE
    { code: 'THAI_KY_3_THANG_DAU', slug: 'thai-ky-3-thang-dau', name: 'Thai kỳ 3 tháng đầu (Tuần 1 - 12)', group: 'AUDIENCE', sortOrder: 1 },
    { code: 'THAI_KY_3_THANG_GIUA', slug: 'thai-ky-3-thang-giua', name: 'Thai kỳ 3 tháng giữa (Tuần 13 - 27)', group: 'AUDIENCE', sortOrder: 2 },
    { code: 'THAI_KY_3_THANG_CUOI', slug: 'thai-ky-3-thang-cuoi', name: 'Thai kỳ 3 tháng cuối (Tuần 28 - 40)', group: 'AUDIENCE', sortOrder: 3 },
    { code: 'PHU_NU_SINH_SAN', slug: 'phu-nu-sinh-san', name: 'Phụ nữ độ tuổi sinh sản', group: 'AUDIENCE', sortOrder: 4 },
    { code: 'CHUAN_BI_MANG_THAI', slug: 'chuan-bi-mang-thai', name: 'Chuẩn bị mang thai', group: 'AUDIENCE', sortOrder: 5 },
    { code: 'ME_SAU_SINH', slug: 'me-sau-sinh', name: 'Phục hồi sau sinh', group: 'AUDIENCE', sortOrder: 6 },
    // FEATURE
    { code: 'SIEU_AM_5D', slug: 'cong-nghe-sieu-am-5d', name: 'Công nghệ siêu âm 5D HD-Live', group: 'FEATURE', sortOrder: 1 },
    { code: 'KHONG_XAM_LAN', slug: 'xet-nghiem-khong-xam-lan', name: 'Không xâm lấn (NIPT)', group: 'FEATURE', sortOrder: 2 },
    { code: 'TRA_KET_QUA_NHANH', slug: 'tra-ket-qua-trong-ngay', name: 'Trả kết quả trong ngày', group: 'FEATURE', sortOrder: 3 },
    { code: 'TU_VAN_CHUYEN_GIA', slug: 'tu-van-chuyen-gia', name: 'Bác sĩ CKII / Trưởng khoa tư vấn', group: 'FEATURE', sortOrder: 4 },
    // LABEL
    { code: 'DICH_VU_MUI_NHON', slug: 'dich-vu-mui-nhon', name: 'Dịch vụ mũi nhọn', group: 'LABEL', sortOrder: 1 },
    { code: 'KHUYEN_DUNG', slug: 'khuyen-dung-cho-me-bau', name: 'Khuyên dùng cho mẹ bầu', group: 'LABEL', sortOrder: 2 },
    { code: 'GOI_TIET_KIEM', slug: 'goi-tiet-kiem', name: 'Gói tiết kiệm chi phí', group: 'LABEL', sortOrder: 3 },
  ];

  const tagMap = {};
  for (const t of tagsDef) {
    const res = await client.query(
      `INSERT INTO catalog_tags (id, code, slug, name, "group", description, sort_order, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), NOW())
       RETURNING id, code`,
      [t.code, t.slug, t.name, t.group, `Thẻ phân loại ${t.name}`, t.sortOrder]
    );
    tagMap[res.rows[0].code] = res.rows[0].id;
  }

  console.log('5. Tạo Danh mục Dịch vụ Y tế & Bảng giá...');
  const servicesDef = [
    {
      code: 'PRENATAL_BASIC',
      slug: 'kham-thai-dinh-ky-co-ban',
      name: 'Khám thai định kỳ cơ bản',
      summary: 'Khám theo dõi sức khỏe tổng quát cho mẹ và thai nhi, kiểm tra huyết áp, bề cao tử cung và tim thai',
      description: 'Quy trình khám bao gồm: đo sinh hiệu người mẹ (mạch, huyết áp, cân nặng), thăm khám lâm sàng bụng mẹ, nghe tim thai bằng Doppler cầm tay, tư vấn dinh dưỡng và vận động phù hợp theo tuần tuổi thai.',
      kind: 'CONSULTATION',
      specialtyCode: 'OBSTETRICS',
      thumbnailUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 20,
      bookingEnabled: true,
      rankPolicy: 'RANK_UPGRADE_ALLOWED',
      primaryCategory: 'KHAM_THAI',
      extraCategories: [],
      tags: ['THAI_KY_3_THANG_DAU', 'THAI_KY_3_THANG_GIUA', 'THAI_KY_3_THANG_CUOI', 'KHUYEN_DUNG'],
      priceMinor: 200000,
    },
    {
      code: 'PRENATAL_SPECIALIST',
      slug: 'kham-thai-chuyen-gia-san-khoa',
      name: 'Khám thai chuyên sâu cùng Chuyên gia Sản khoa',
      summary: 'Khám và tư vấn chuyên sâu cùng Bác sĩ Chuyên khoa II / Trưởng khoa Sản dành cho thai kỳ nguy cơ cao',
      description: 'Dành riêng cho các mẹ bầu mang thai đôi/đa thai, tiền sử sảy thai, thai kỳ có bệnh lý nội khoa kèm theo (tiểu đường thai kỳ, tăng huyết áp thai kỳ, tiền sản giật). Bác sĩ sẽ trực tiếp lập phác đồ theo dõi sát sao.',
      kind: 'CONSULTATION',
      specialtyCode: 'MATERNAL_MEDICINE',
      thumbnailUrl: 'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 30,
      bookingEnabled: true,
      rankPolicy: 'BASIC_INCLUDED',
      primaryCategory: 'KHAM_THAI',
      extraCategories: [],
      tags: ['TU_VAN_CHUYEN_GIA', 'DICH_VU_MUI_NHON', 'KHUYEN_DUNG'],
      priceMinor: 350000,
    },
    {
      code: 'GYN_GENERAL',
      slug: 'kham-phu-khoa-tong-quat',
      name: 'Khám phụ khoa tổng quát',
      summary: 'Khám lâm sàng kiểm tra cơ quan sinh dục ngoài và trong, phát hiện sớm các bệnh lý viêm nhiễm',
      description: 'Bác sĩ kiểm tra âm đạo, cổ tử cung, tử cung và hai phần phụ bằng mỏ vịt vô trùng. Tư vấn vệ sinh sinh sản, kế hoạch hóa gia đình và hướng dẫn tầm soát ung thư phụ khoa định kỳ.',
      kind: 'CONSULTATION',
      specialtyCode: 'GYNECOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 25,
      bookingEnabled: true,
      rankPolicy: 'RANK_UPGRADE_ALLOWED',
      primaryCategory: 'KHAM_PHU_KHOA',
      extraCategories: [],
      tags: ['PHU_NU_SINH_SAN', 'KHUYEN_DUNG'],
      priceMinor: 250000,
    },
    {
      code: 'US_2D_STANDARD',
      slug: 'sieu-am-thai-2d-tieu-chuan',
      name: 'Siêu âm thai 2D tiêu chuẩn',
      summary: 'Siêu âm đen trắng kiểm tra vị trí túi ối, số lượng phôi thai, tim thai và xác định tuổi thai',
      description: 'Phương pháp chẩn đoán hình ảnh cơ bản an toàn tuyệt đối cho mẹ và bé, thường thực hiện trong những tuần đầu để xác nhận thai trong buồng tử cung và đo chiều dài đầu mông thai nhi (CRL).',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'OBSTETRICS',
      thumbnailUrl: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 15,
      bookingEnabled: true,
      rankPolicy: 'NOT_REQUIRED',
      primaryCategory: 'SIEU_AM_THAI',
      extraCategories: ['KHAM_THAI'],
      tags: ['THAI_KY_3_THANG_DAU', 'TRA_KET_QUA_NHANH'],
      priceMinor: 180000,
    },
    {
      code: 'US_5D_MORPHOLOGY',
      slug: 'sieu-am-hinh-thai-5d-hd-live',
      name: 'Siêu âm hình thái thai nhi 5D HD-Live (Tuần 18 - 22)',
      summary: 'Siêu âm khảo sát dị tật hình thái chi tiết toàn diện với hình ảnh màu 5D siêu nét, quay video thời gian thực',
      description: 'Cột mốc quan trọng nhất thai kỳ nhằm khảo sát chi tiết cấu trúc não bộ, tim 4 buồng, khuôn mặt, cột sống, thành bụng, dạ dày, bàng quang và các chi. Bác sĩ đo đạc chính xác các chỉ số sinh trắc học để tầm soát dị tật bẩm sinh.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'PERINATOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 35,
      bookingEnabled: true,
      rankPolicy: 'NOT_REQUIRED',
      primaryCategory: 'SIEU_AM_THAI',
      extraCategories: ['KHAM_THAI'],
      tags: ['SIEU_AM_5D', 'THAI_KY_3_THANG_GIUA', 'DICH_VU_MUI_NHON', 'KHUYEN_DUNG'],
      priceMinor: 500000,
    },
    {
      code: 'US_DOPPLER_FETAL',
      slug: 'sieu-am-doppler-mau-mach-mau-thai',
      name: 'Siêu âm Doppler màu mạch máu rốn & động mạch não giữa',
      summary: 'Đánh giá lưu lượng tưới máu từ mẹ sang bánh nhau và thai nhi, phát hiện sớm suy thai, thai chậm tăng trưởng',
      description: 'Chỉ định đặc biệt trong 3 tháng cuối hoặc khi nghi ngờ thai chậm tăng trưởng trong tử cung (IUGR), mẹ có tiền sản giật. Khảo sát chỉ số RI, PI của động mạch tử cung, động mạch rốn và động mạch não giữa thai nhi.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'PERINATOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 30,
      bookingEnabled: true,
      rankPolicy: 'NOT_REQUIRED',
      primaryCategory: 'SIEU_AM_THAI',
      extraCategories: [],
      tags: ['THAI_KY_3_THANG_CUOI', 'TRA_KET_QUA_NHANH'],
      priceMinor: 420000,
    },
    {
      code: 'TEST_NIPT_BASIC',
      slug: 'xet-nghiem-nipt-basic-sang-loc-3-hoi-chung',
      name: 'Xét nghiệm sàng lọc trước sinh không xâm lấn NIPT Basic',
      summary: 'Sàng lọc dị tật nhiễm sắc thể từ tuần thứ 9 bằng ADN tự do của thai nhi trong máu mẹ (Down, Edwards, Patau)',
      description: 'Độ chính xác vượt trội trên 99% đối với tam bội thể 21 (Hội chứng Down), tam bội thể 18 (Hội chứng Edwards) và tam bội thể 13 (Hội chứng Patau). Hoàn toàn an toàn, không gây nguy cơ sảy thai như chọc ối.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'PERINATOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1579684453423-f84349ef60b0?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 15,
      bookingEnabled: true,
      rankPolicy: 'NOT_REQUIRED',
      primaryCategory: 'XET_NGHIEM_SANG_LOC',
      extraCategories: [],
      tags: ['KHONG_XAM_LAN', 'THAI_KY_3_THANG_DAU', 'DICH_VU_MUI_NHON', 'KHUYEN_DUNG'],
      priceMinor: 2800000,
    },
    {
      code: 'TEST_NIPT_PRO',
      slug: 'xet-nghiem-nipt-pro-toan-dien-23-cap-nst',
      name: 'Xét nghiệm NIPT Pro toàn diện 23 cặp NST & Vi mất đoạn',
      summary: 'Gói sàng lọc di truyền cao cấp nhất: toàn bộ 23 cặp NST, đột biến lệch bội NST giới tính và 86 hội chứng vi mất đoạn',
      description: 'Sàng lọc thêm các bất thường NST giới tính như Turner (XO), Klinefelter (XXY), Jacobs (XYY), Triple X (XXX) và các hội chứng mất đoạn di truyền nguy hiểm như DiGeorge, Angelman, Prader-Willi, Cri-du-chat.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'PERINATOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 20,
      bookingEnabled: true,
      rankPolicy: 'NOT_REQUIRED',
      primaryCategory: 'XET_NGHIEM_SANG_LOC',
      extraCategories: [],
      tags: ['KHONG_XAM_LAN', 'THAI_KY_3_THANG_DAU', 'DICH_VU_MUI_NHON'],
      priceMinor: 5500000,
    },
    {
      code: 'TEST_DOUBLE_TRIPLE',
      slug: 'xet-nghiem-double-test-triple-test',
      name: 'Xét nghiệm sinh hóa máu Double Test / Triple Test',
      summary: 'Xét nghiệm tầm soát dị tật thai nhi kết hợp đo độ mờ da gáy (Double Test tuần 11-13 hoặc Triple Test tuần 15-20)',
      description: 'Định lượng các chất chỉ điểm sinh hóa trong huyết thanh mẹ gồm Free beta hCG và PAPP-A (Double Test) hoặc AFP, hCG, uE3 (Triple Test) kết hợp thuật toán tính nguy cơ dị tật thai nhi.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'PERINATOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1516822003754-cca485356ecb?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 15,
      bookingEnabled: true,
      rankPolicy: 'NOT_REQUIRED',
      primaryCategory: 'XET_NGHIEM_SANG_LOC',
      extraCategories: [],
      tags: ['THAI_KY_3_THANG_DAU', 'THAI_KY_3_THANG_GIUA', 'KHUYEN_DUNG'],
      priceMinor: 450000,
    },
    {
      code: 'COLPOSCOPY_DIGITAL',
      slug: 'soi-co-tu-cung-ky-thuat-so',
      name: 'Soi cổ tử cung kỹ thuật số độ phóng đại cao',
      summary: 'Quan sát chi tiết bề mặt cổ tử cung với máy soi phóng đại 30-50 lần kết hợp nghiệm pháp acid acetic và lugol',
      description: 'Giúp bác sĩ nhận diện rõ ràng các vùng tổn thương nghi ngờ, loạn sản, tiền ung thư cổ tử cung hoặc viêm lộ tuyến diện rộng. Hỗ trợ định vị vị trí sinh thiết chính xác nếu cần thiết.',
      kind: 'PROCEDURE',
      specialtyCode: 'GYNECOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 20,
      bookingEnabled: true,
      rankPolicy: 'NOT_REQUIRED',
      primaryCategory: 'KHAM_PHU_KHOA',
      extraCategories: [],
      tags: ['PHU_NU_SINH_SAN', 'TRA_KET_QUA_NHANH'],
      priceMinor: 300000,
    },
    {
      code: 'TEST_THINPREP_HPV',
      slug: 'tam-soat-ung-thu-co-tu-cung-thinprep-hpv',
      name: 'Tầm soát ung thư cổ tử cung ThinPrep Pap + HPV Cobas',
      summary: 'Bộ đôi xét nghiệm vàng phát hiện sớm 95% nguy cơ ung thư cổ tử cung: tế bào học ThinPrep kết hợp định tuýp 14 chủng HPV',
      description: 'Lấy mẫu tế bào cổ tử cung chuyển vào môi trường lỏng tách tạp chất, kết hợp kỹ thuật sinh học phân tử PCR tìm kiếm 14 chủng HPV nguy cơ cao, đặc biệt là HPV 16 và 18 – thủ phạm chính gây ung thư cổ tử cung.',
      kind: 'DIAGNOSTIC',
      specialtyCode: 'GYNECOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 15,
      bookingEnabled: true,
      rankPolicy: 'NOT_REQUIRED',
      primaryCategory: 'KHAM_PHU_KHOA',
      extraCategories: [],
      tags: ['PHU_NU_SINH_SAN', 'DICH_VU_MUI_NHON', 'KHUYEN_DUNG'],
      priceMinor: 950000,
    },
    {
      code: 'PRECONCEPTION_COUNSEL',
      slug: 'tu-van-suc-khoe-sinh-san-tien-mang-thai',
      name: 'Tư vấn & Khám sức khỏe sinh sản tiền mang thai',
      summary: 'Đánh giá chức năng buồng trứng, tử cung, xét nghiệm miễn dịch Rubella, Viêm gan B trước khi lên kế hoạch có con',
      description: 'Gói tư vấn toàn diện dành cho các cặp vợ chồng chuẩn bị có thai: đánh giá tiền sử sản khoa, kiểm tra kháng thể miễn dịch, hướng dẫn bổ sung acid folic, tiêm phòng vắc xin trước mang thai và điều chỉnh lối sống.',
      kind: 'CONSULTATION',
      specialtyCode: 'REPRODUCTIVE_ENDOCRINOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 30,
      bookingEnabled: true,
      rankPolicy: 'RANK_UPGRADE_ALLOWED',
      primaryCategory: 'HIEM_MUON_SINH_SAN',
      extraCategories: [],
      tags: ['CHUAN_BI_MANG_THAI', 'TU_VAN_CHUYEN_GIA'],
      priceMinor: 400000,
    },
    {
      code: 'FOLLICLE_MONITOR',
      slug: 'sieu-am-canh-noan-theo-doi-trung-rung',
      name: 'Siêu âm canh noãn theo dõi nang trứng phát triển',
      summary: 'Siêu âm đầu dò âm đạo theo dõi kích thước nang trội và độ dày niêm mạc tử cung để xác định thời điểm rụng trứng',
      description: 'Quy trình thực hiện theo chu kỳ kinh nguyệt (thường bắt đầu từ ngày thứ 10 của chu kỳ) để hỗ trợ các cặp đôi canh thời điểm thụ thai tự nhiên hoặc chuẩn bị bơm tinh trùng vào buồng tử cung (IUI).',
      kind: 'PROCEDURE',
      specialtyCode: 'REPRODUCTIVE_ENDOCRINOLOGY',
      thumbnailUrl: 'https://images.unsplash.com/photo-1519824145371-296894a0daa9?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 15,
      bookingEnabled: true,
      rankPolicy: 'NOT_REQUIRED',
      primaryCategory: 'HIEM_MUON_SINH_SAN',
      extraCategories: ['SIEU_AM_THAI'],
      tags: ['CHUAN_BI_MANG_THAI', 'TRA_KET_QUA_NHANH'],
      priceMinor: 150000,
    },
    {
      code: 'PKG_PRENATAL_ALL',
      slug: 'goi-cham-soc-thai-ky-tron-goi-toan-dien',
      name: 'Gói chăm sóc thai kỳ trọn gói toàn diện (Từ tuần 6 đến sinh)',
      summary: 'Bao gồm toàn bộ các mốc khám thai, siêu âm 2D/5D, xét nghiệm máu, nước tiểu, NIPT Basic và tiêm uốn ván trọn gói',
      description: 'Giải pháp an tâm tiết kiệm toàn diện cho mẹ bầu: đồng hành cùng bác sĩ chuyên khoa suốt 9 tháng 10 ngày với đầy đủ 12 lần khám thai, 8 lần siêu âm, trọn bộ xét nghiệm sinh hóa cơ bản và sàng lọc trước sinh.',
      kind: 'PACKAGE',
      specialtyCode: 'OBSTETRICS',
      thumbnailUrl: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 60,
      bookingEnabled: true,
      rankPolicy: 'BASIC_INCLUDED',
      primaryCategory: 'GOI_THAI_SAN',
      extraCategories: ['KHAM_THAI', 'SIEU_AM_THAI'],
      tags: ['THAI_KY_3_THANG_DAU', 'THAI_KY_3_THANG_GIUA', 'THAI_KY_3_THANG_CUOI', 'GOI_TIET_KIEM', 'DICH_VU_MUI_NHON'],
      priceMinor: 12500000,
    },
    {
      code: 'PKG_POSTPARTUM',
      slug: 'goi-phuc-hoi-va-cham-soc-me-sau-sinh',
      name: 'Gói phục hồi & Chăm sóc sức khỏe mẹ sau sinh (6 tuần hậu sản)',
      summary: 'Khám kiểm tra vết khâu tầng sinh môn / vết mổ lấy thai, siêu âm co hồi tử cung và tư vấn tâm lý hậu sản',
      description: 'Chăm sóc chu đáo giai đoạn hậu sản: kiểm tra tình trạng lành thương vết mổ/vết khâu, siêu âm loại trừ sót rau/ứ dịch lòng tử cung, đánh giá tình trạng tuyến sữa, tư vấn các biện pháp tránh thai hậu sản an toàn và hỗ trợ tâm lý sau sinh.',
      kind: 'PACKAGE',
      specialtyCode: 'OBSTETRICS',
      thumbnailUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=85',
      durationMinutes: 45,
      bookingEnabled: true,
      rankPolicy: 'NOT_REQUIRED',
      primaryCategory: 'GOI_THAI_SAN',
      extraCategories: ['KHAM_PHU_KHOA'],
      tags: ['ME_SAU_SINH', 'KHUYEN_DUNG', 'GOI_TIET_KIEM'],
      priceMinor: 3200000,
    },
  ];

  for (const svc of servicesDef) {
    const specialtyId = specialtyMap[svc.specialtyCode] || specialtyAliases[svc.specialtyCode];
    if (!specialtyId) throw new Error(`No Doctor specialty mapping for catalog service ${svc.code}: ${svc.specialtyCode}`);
    const res = await client.query(
      `INSERT INTO medical_services (id, code, slug, name, summary, description, kind, specialty_id, thumbnail_url, duration_minutes, booking_enabled, doctor_rank_selection_policy, status, version, published_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE', 1, NOW(), NOW(), NOW())
       RETURNING id`,
      [
        svc.code,
        svc.slug,
        svc.name,
        svc.summary,
        svc.description,
        svc.kind,
        specialtyId,
        svc.thumbnailUrl,
        svc.durationMinutes,
        svc.bookingEnabled,
        svc.rankPolicy,
      ]
    );
    const serviceId = res.rows[0].id;

    // Gắn nhóm danh mục
    const allCategories = [
      ...(svc.categories || []),
      ...(svc.primaryCategory ? [svc.primaryCategory] : []),
      ...(svc.extraCategories || []),
    ];
    for (const catCode of new Set(allCategories)) {
      const catId = categoryMap[catCode];
      if (catId) {
        await client.query(
          `INSERT INTO medical_service_categories (medical_service_id, category_id, created_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT DO NOTHING`,
          [serviceId, catId]
        );
      }
    }

    // Gắn Tags
    for (const tagCode of svc.tags) {
      const tagId = tagMap[tagCode];
      if (tagId) {
        await client.query(
          `INSERT INTO medical_service_tags (medical_service_id, tag_id, created_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT DO NOTHING`,
          [serviceId, tagId]
        );
      }
    }

    // Thiết lập Base Price hiệu lực
    await client.query(
      `INSERT INTO base_prices (id, medical_service_id, amount_minor, currency, effective_from, effective_to, status, version, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'VND', NOW() - INTERVAL '1 day', null, 'ACTIVE', 1, NOW(), NOW())`,
      [serviceId, svc.priceMinor]
    );
  }

  console.log(`Đã tạo thành công:
  - 4 Surcharges (Phụ thu hạng bác sĩ)
  - ${categoriesDef.length} Nhóm dịch vụ (Categories)
  - ${tagsDef.length} Thẻ tag (Tags)
  - ${servicesDef.length} Dịch vụ y tế đầy đủ thuộc tính & Bảng giá`);

  await client.end();
}

seedCatalog().catch((err) => {
  console.error('Lỗi khi seed catalog:', err);
  process.exit(1);
});
