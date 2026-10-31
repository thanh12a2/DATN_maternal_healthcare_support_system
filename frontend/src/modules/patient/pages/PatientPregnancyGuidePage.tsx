import React, { useState, useMemo } from 'react';
import { AppLink } from '../../../app/navigation';
import { PublicPortalHeader } from '../../../shared/components/portal/PublicPortalHeader';
import { PublicPortalFooter } from '../../../shared/components/portal/PublicPortalFooter';
import { HeroMotherArt } from '../components/HeroMotherArt';
import { ChatbotLauncher } from '../components/chatbot/ChatbotLauncher';
import '../../../styles/pregnancy-guide.css';

// --- ICONS Y KHOA NỘI BỘ (SVG CHUẨN) ---
function StethoscopeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 3v5a7.5 7.5 0 0 0 15 0V3" />
      <path d="M6 3h-3" />
      <path d="M21 3h-3" />
      <path d="M12 10.5V17a4 4 0 0 1-8 0v-2" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function BabyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 12h.01" />
      <path d="M15 12h.01" />
      <path d="M10 16c.5.5 1.5 1 2 1s1.5-.5 2-1" />
      <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
    </svg>
  );
}

function HeartPulseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h4.28" />
    </svg>
  );
}

function CheckListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 11 3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function CalendarCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

function AlertTriangleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function PhoneCallIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// --- DỮ LIỆU CỐT LÕI (A3 - MỐC KHÁM) ---
interface Milestone {
  id: string;
  name: string;
  rangeLabel: string;
  startWeek: number;
  endWeek: number;
  purpose: string;
  note: string;
  hospitalNote?: string;
  color: string;
}

const MILESTONES: Milestone[] = [
  {
    id: 'm1',
    name: '1. Khám thai đầu tiên',
    rangeLabel: 'ngay khi biết có thai (khoảng tuần 5–8)',
    startWeek: 1,
    endWeek: 13,
    purpose: 'Xác nhận thai trong buồng tử cung, xác định tuổi thai chính xác, hỏi bệnh sử, đánh giá yếu tố nguy cơ, làm các xét nghiệm nền theo chỉ định (nhóm máu, công thức máu, một số bệnh nhiễm trùng).',
    note: 'Siêu âm trong 3 tháng đầu cho kết quả xác định tuổi thai chính xác nhất.',
    color: '#1677FF',
  },
  {
    id: 'm2',
    name: '2. Sàng lọc bất thường nhiễm sắc thể',
    rangeLabel: 'khoảng tuần 10–22',
    startWeek: 10,
    endWeek: 22,
    purpose: 'Ước tính nguy cơ bất thường nhiễm sắc thể ở thai nhi. Đo độ mờ da gáy + xét nghiệm máu mẹ: khoảng tuần 11–13. Xét nghiệm DNA thai tự do (NIPT): từ khoảng tuần 10 trở đi. Triple/Quad test: khoảng tuần 15–22 (cho mẹ chưa làm sàng lọc quý 1).',
    note: 'Lưu ý: đây là sàng lọc, chỉ ước tính nguy cơ, không phải chẩn đoán xác định. Làm hay không là lựa chọn của mẹ sau khi được tư vấn. Nếu nguy cơ cao, bác sĩ tư vấn xét nghiệm chẩn đoán.',
    color: '#0B4F9C',
  },
  {
    id: 'm3',
    name: '3. Siêu âm hình thái thai nhi',
    rangeLabel: 'khoảng tuần 18–22',
    startWeek: 18,
    endWeek: 22,
    purpose: 'Quan sát chi tiết cấu trúc các cơ quan của thai, vị trí bánh nhau, lượng nước ối.',
    note: 'Thời điểm vàng để bác sĩ khảo sát hình thái học toàn diện.',
    hospitalNote: 'Dịch vụ siêu âm tại Tâm An: [BV điền: công nghệ siêu âm 4D/5D, máy Voluson Expert, trả kết quả & lưu trữ ảnh trực tuyến].',
    color: '#10B981',
  },
  {
    id: 'm4',
    name: '4. Sàng lọc tiểu đường thai kỳ',
    rangeLabel: 'khoảng tuần 24–28',
    startWeek: 24,
    endWeek: 28,
    purpose: 'Nghiệm pháp dung nạp glucose đường uống giúp phát hiện sớm đái tháo đường thai kỳ để can thiệp kịp thời.',
    note: 'Mẹ làm theo đúng hướng dẫn của bác sĩ/điều dưỡng về việc nhịn ăn trước khi lấy máu làm xét nghiệm.',
    color: '#0B7A56',
  },
  {
    id: 'm5',
    name: '5. Tiêm phòng thai kỳ',
    rangeLabel: 'khoảng tuần 27–36',
    startWeek: 27,
    endWeek: 36,
    purpose: 'Vắc-xin uốn ván, bạch hầu, ho gà (Tdap): tiêm khoảng tuần 27–36 ở mỗi thai kỳ giúp bảo vệ trẻ sơ sinh. Vắc-xin cúm bất hoạt: tiêm ở bất kỳ giai đoạn nào trong mùa cúm. Mẹ Rh âm tính: tiêm Anti-D quanh tuần 28.',
    note: 'Vắc-xin sống giảm độc lực tuyệt đối không dùng trong thai kỳ.',
    hospitalNote: 'Vắc-xin hiện có tại Tâm An: [BV điền: phòng tiêm chủng Tâm An, quy trình bảo quản lạnh chuẩn GSP].',
    color: '#E67E22',
  },
  {
    id: 'm6',
    name: '6. Tầm soát liên cầu khuẩn nhóm B (GBS)',
    rangeLabel: 'khoảng tuần 36–38',
    startWeek: 36,
    endWeek: 38,
    purpose: 'Lấy mẫu phết âm đạo và trực tràng. Nếu mẹ mang vi khuẩn này, bác sĩ sẽ có hướng xử trí kháng sinh dự phòng khi chuyển dạ để giảm nguy cơ lây sang bé.',
    note: 'Thủ thuật lấy mẫu rất nhanh, nhẹ nhàng và an toàn.',
    color: '#C25E00',
  },
  {
    id: 'm7',
    name: '7. Khám theo dõi giai đoạn cuối & Kế hoạch sinh',
    rangeLabel: 'khoảng tuần 36–40',
    startWeek: 36,
    endWeek: 40,
    purpose: 'Khám dày hơn theo hẹn, đánh giá ngôi thai và sự phát triển của thai, thống nhất phương pháp sinh (thường hay mổ) và kế hoạch nhập viện.',
    note: 'Mẹ trao đổi kỹ với bác sĩ về dấu hiệu chuyển dạ và số điện thoại cấp cứu.',
    color: '#7C3AED',
  },
];

// --- DỮ LIỆU HỎI ĐÁP (A10) ---
const FAQ_ITEMS = [
  {
    q: '1. Khi nào nên đi khám thai lần đầu?',
    a: 'Ngay khi mẹ biết hoặc nghi ngờ có thai; lý tưởng nhất trong 3 tháng đầu (khoảng tuần thứ 5–8). Mẹ không cần chờ thai lớn mới khám, vì buổi khám đầu tiên giúp xác nhận thai đã làm tổ an toàn trong tử cung và tính tuổi thai chính xác nhất.',
  },
  {
    q: '2. Cần khám thai bao nhiêu lần trong suốt thai kỳ?',
    a: 'WHO khuyến cáo tối thiểu 8 lần tiếp xúc với nhân viên y tế trong thai kỳ (1 lần ở tam cá nguyệt 1, 2 lần ở tam cá nguyệt 2 và 5 lần ở tam cá nguyệt 3). Số lần và thời điểm cụ thể sẽ do bác sĩ điều chỉnh theo sức khỏe và tình trạng thực tế của từng mẹ.',
  },
  {
    q: '3. Sàng lọc NIPT hay độ mờ da gáy có kết luận chắc chắn 100% không?',
    a: 'Đây là các xét nghiệm sàng lọc, chỉ ước tính nguy cơ cao hay thấp đối với một số bất thường nhiễm sắc thể phổ biến, không phải kết luận chẩn đoán xác định. Làm hay không là lựa chọn của mẹ sau khi được bác sĩ tư vấn. Nếu kết quả nguy cơ cao, bác sĩ sẽ tư vấn thêm xét nghiệm chẩn đoán chuyên sâu (như chọc ối).',
  },
  {
    q: '4. NIPT có thay thế được siêu âm không?',
    a: 'Không. NIPT sàng lọc bất thường nhiễm sắc thể từ các đoạn DNA tự do trong máu mẹ, còn siêu âm giúp đánh giá cấu trúc giải phẫu hình thái, sự phát triển các cơ quan, bánh nhau và lượng nước ối của thai. Hai phương pháp bổ sung cho nhau chứ không thay thế cho nhau.',
  },
  {
    q: '5. Siêu âm hình thái làm khi nào và để làm gì?',
    a: 'Khoảng tuần 18–22. Mục đích là để bác sĩ quan sát chi tiết cấu trúc hình thái các cơ quan của thai (não bộ, tim, cột sống, gương mặt, tay chân...), vị trí bánh nhau và lượng nước ối.',
  },
  {
    q: '6. Thai máy bao nhiêu lần là bình thường?',
    a: 'Không có con số cử động “chuẩn” cố định cho mọi thai nhi. Điều quan trọng nhất là mẹ theo dõi và nhận biết sự thay đổi so với thường ngày: nếu thấy cử động thai giảm rõ rệt hoặc ngừng cử động, mẹ cần đi khám kiểm tra ngay lập tức.',
  },
  {
    q: '7. Mẹ bầu có nên tập thể dục không?',
    a: 'Trong một thai kỳ bình thường, hoạt động thể chất nhẹ đến vừa (đi bộ, bơi lội, yoga thai kỳ) thường được khuyến khích vì tốt cho cả mẹ và bé. Mẹ cần hỏi ý kiến bác sĩ trước khi bắt đầu, đặc biệt khi có bệnh nền hoặc tiền sử dọa sảy thai, dọa sinh non.',
  },
  {
    q: '8. Mẹ bầu có uống được cà phê hay trà không?',
    a: 'Mẹ nên hạn chế tối đa các loại đồ uống chứa caffeine (cà phê, trà đặc, nước tăng lực). Mẹ hãy trao đổi với bác sĩ để biết mức tiêu thụ phù hợp và an toàn với cơ địa của mình.',
  },
  {
    q: '9. Mẹ bầu có cần tiêm phòng không?',
    a: 'Khuyến cáo tiêm phòng thường gồm vắc-xin Tdap (phòng uốn ván, bạch hầu, ho gà vào khoảng tuần 27–36 ở mỗi thai kỳ) và vắc-xin cúm bất hoạt trong mùa cúm. Vắc-xin sống giảm độc lực chống chỉ định trong thai kỳ. Mẹ trao đổi với bác sĩ Tâm An để được xếp lịch tiêm an toàn.',
  },
  {
    q: '10. Mẹ có cần “ăn cho hai người” không?',
    a: 'Chất lượng bữa ăn và an toàn thực phẩm quan trọng hơn số lượng ăn thật nhiều. Nhu cầu năng lượng và mức tăng cân phù hợp khác nhau tùy thuộc vào chỉ số khối cơ thể (BMI) trước mang thai và sức khỏe nền, do đó bác sĩ sản khoa sẽ hướng dẫn khẩu phần riêng cho mẹ.',
  },
  {
    q: '11. Khi nào mẹ nên đến bệnh viện để sinh?',
    a: 'Bác sĩ sẽ dặn dò cụ thể cho mẹ trong các lần khám cuối thai kỳ. Khi mẹ nhận thấy một trong các dấu hiệu: vỡ ối (hoặc rỉ ối), ra máu âm đạo, hoặc các cơn co thắt tử cung xuất hiện đều đặn, mạnh dần và dồn dập, mẹ hãy di chuyển ngay đến bệnh viện hoặc gọi tổng đài 1900 6868.',
  },
];

export const PatientPregnancyGuidePage: React.FC = () => {
  // Trạng thái bộ chọn tuần thai (1 - 40)
  const [selectedWeek, setSelectedWeek] = useState<number>(12);
  // Trạng thái tab chủ đề chung (dinh-duong | van-dong | kho-chiu | tinh-than)
  const [activeTopicTab, setActiveTopicTab] = useState<'dinh-duong' | 'van-dong' | 'kho-chiu' | 'tinh-than'>('dinh-duong');
  // Trạng thái accordion FAQ (mở câu nào)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Xác định tam cá nguyệt hiện tại dựa trên tuần thai mẹ chọn
  const currentTrimester = useMemo(() => {
    if (selectedWeek <= 13) return 1;
    if (selectedWeek <= 27) return 2;
    return 3;
  }, [selectedWeek]);

  // Cuộn mượt đến section
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="pregnancy-guide-page">
      <PublicPortalHeader />

      {/* ====================================================================
          A1. HERO SECTION (ĐẦU TRANG)
          ==================================================================== */}
      <section className="pg-hero-section" aria-label="Giới thiệu cẩm nang thai kỳ">
        <div className="portal-container">
          <div className="pg-hero-grid">
            {/* Cột trái: Tiêu đề, mô tả, nút bấm, bộ chọn tuần */}
            <div className="pg-hero-content">
              <div className="pg-hero-badge">
                <StethoscopeIcon />
                <span>Bác sĩ Sản khoa Tâm An Hospital đồng hành</span>
              </div>

              <h1 className="pg-hero-title">Cẩm nang thai kỳ</h1>

              <p className="pg-hero-desc">
                Những điều mẹ cần biết từ lúc biết tin có thai đến ngày gặp con: khám gì và khi nào, ăn uống và sinh hoạt ra sao, và dấu hiệu nào cần đến bệnh viện ngay.
              </p>

              <div className="pg-hero-actions">
                <button
                  type="button"
                  className="pg-btn pg-btn-emergency"
                  onClick={() => scrollToSection('emergency-warning')}
                >
                  <AlertTriangleIcon />
                  <span>Dấu hiệu cần đi khám ngay</span>
                </button>
                <AppLink href="/dat-lich" className="pg-btn pg-btn-primary">
                  <CalendarCheckIcon />
                  <span>Đặt lịch khám thai</span>
                </AppLink>
              </div>

              {/* Bộ chọn tuần thai tương tác */}
              <div className="pg-week-selector-card" aria-label="Bộ chọn tuần thai hiện tại">
                <div className="pg-week-selector-header">
                  <span className="pg-week-selector-title">
                    <BabyIcon />
                    Mẹ đang ở tuần thai nào?
                  </span>
                  <span className="pg-week-selector-badge">
                    Tuần {selectedWeek} · Tam cá nguyệt {currentTrimester}
                  </span>
                </div>
                <div className="pg-week-slider-wrapper">
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(Number(e.target.value))}
                    className="pg-week-slider"
                    aria-label="Chọn tuần thai từ 1 đến 40"
                  />
                </div>
                <div className="pg-week-ticks">
                  <span>Tuần 1</span>
                  <span>TCN 1 (1–13)</span>
                  <span>TCN 2 (14–27)</span>
                  <span>TCN 3 (28–40)</span>
                  <span>Tuần 40</span>
                </div>
              </div>

              <div className="pg-hero-disclaimer">
                Nội dung tổng hợp từ khuyến cáo của WHO, CDC, ACOG và NHS, mang tính tham khảo, không thay thế tư vấn của bác sĩ. Duyệt nội dung: [BV điền: tên bác sĩ, ngày duyệt].
              </div>
            </div>

            {/* Cột phải: Minh họa mẹ bầu nghệ thuật trong khung vòm */}
            <div className="pg-hero-art-col">
              <div className="pg-hero-art-wrapper">
                <HeroMotherArt quote="Lắng nghe cơ thể mẹ, nâng niu từng nhịp đập yêu thương của bé." />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          B1. THANH HÀNH TRÌNH CỐ ĐỊNH (STICKY JOURNEY TIMELINE)
          ==================================================================== */}
      <nav className="pg-sticky-nav" aria-label="Điều hướng hành trình thai kỳ">
        <div className="portal-container">
          <div className="pg-journey-track">
            <button
              type="button"
              className={`pg-journey-tab ${currentTrimester === 1 ? 'active-t1' : ''}`}
              onClick={() => scrollToSection('chapter-t1')}
            >
              <span className="pg-journey-tab-badge">1</span>
              <span>Tam cá nguyệt 1 (khoảng tuần 1–13)</span>
            </button>
            <button
              type="button"
              className={`pg-journey-tab ${currentTrimester === 2 ? 'active-t2' : ''}`}
              onClick={() => scrollToSection('chapter-t2')}
            >
              <span className="pg-journey-tab-badge">2</span>
              <span>Tam cá nguyệt 2 (khoảng tuần 14–27)</span>
            </button>
            <button
              type="button"
              className={`pg-journey-tab ${currentTrimester === 3 ? 'active-t3' : ''}`}
              onClick={() => scrollToSection('chapter-t3')}
            >
              <span className="pg-journey-tab-badge">3</span>
              <span>Tam cá nguyệt 3 (khoảng tuần 28–40)</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="portal-container">
        {/* ====================================================================
            A2. BA GIAI ĐOẠN CỦA THAI KỲ (CHƯƠNG 1, 2, 3)
            ==================================================================== */}
        <section className="pg-section" aria-label="Ba giai đoạn phát triển thai kỳ">
          <div className="pg-chapter-container">
            {/* CHƯƠNG 1: TAM CÁ NGUYỆT 1 */}
            <article
              id="chapter-t1"
              className={`pg-chapter-card t1 ${currentTrimester === 1 ? 'highlighted' : ''}`}
            >
              <div className="pg-chapter-header">
                <div className="pg-arch-badge t1">1</div>
                <div className="pg-chapter-title-group">
                  <h2>Tam cá nguyệt 1</h2>
                  <span className="pg-approx-pill">khoảng tuần 1–13</span>
                </div>
              </div>

              <div className="pg-quad-grid">
                <div className="pg-quad-cell t1">
                  <div className="pg-quad-cell-header">
                    <BabyIcon />
                    <span>Con đang phát triển</span>
                  </div>
                  <p>
                    Đây là giai đoạn phôi thai làm tổ và các cơ quan chính bắt đầu hình thành. Tim bắt đầu hoạt động và thường có thể thấy trên siêu âm sớm. Vì các cơ quan đang hình thành, giai đoạn này nhạy cảm với thuốc, rượu bia, thuốc lá và một số nhiễm trùng.
                  </p>
                </div>

                <div className="pg-quad-cell t1">
                  <div className="pg-quad-cell-header">
                    <HeartPulseIcon />
                    <span>Mẹ có thể cảm thấy</span>
                  </div>
                  <p>
                    Trễ kinh, mệt, buồn nôn hoặc nôn, ngực căng, đi tiểu nhiều hơn. Không phải mẹ nào cũng có đủ các dấu hiệu này và mức độ rất khác nhau giữa các mẹ.
                  </p>
                </div>

                <div className="pg-quad-cell t1">
                  <div className="pg-quad-cell-header">
                    <CheckListIcon />
                    <span>Mẹ nên làm</span>
                  </div>
                  <ul>
                    <li>Đi khám để xác nhận thai nằm trong tử cung và xác định tuổi thai.</li>
                    <li>
                      <strong>Bổ sung axit folic 400 µg mỗi ngày</strong>, ngay từ khi dự định có thai đến hết tuần 12 (xem mục Dinh dưỡng).
                    </li>
                    <li>Ngừng rượu bia và thuốc lá tuyệt đối.</li>
                    <li>Báo bác sĩ mọi loại thuốc, thực phẩm chức năng, thảo dược đang dùng, cùng các bệnh nền như tiểu đường, huyết áp, tuyến giáp, động kinh.</li>
                  </ul>
                </div>

                <div className="pg-quad-cell t1">
                  <div className="pg-quad-cell-header">
                    <CalendarCheckIcon />
                    <span>Mốc khám trọng tâm</span>
                  </div>
                  <p>Khám thai đầu tiên, siêu âm, xét nghiệm nền, sàng lọc sớm nếu mẹ chọn (xem phần Lịch khám bên dưới).</p>
                  <span className="pg-cell-tag">Khoảng tuần 5–8 &amp; Tuần 11–13</span>
                </div>
              </div>
            </article>

            {/* CHƯƠNG 2: TAM CÁ NGUYỆT 2 */}
            <article
              id="chapter-t2"
              className={`pg-chapter-card t2 ${currentTrimester === 2 ? 'highlighted' : ''}`}
            >
              <div className="pg-chapter-header">
                <div className="pg-arch-badge t2">2</div>
                <div className="pg-chapter-title-group">
                  <h2>Tam cá nguyệt 2</h2>
                  <span className="pg-approx-pill">khoảng tuần 14–27</span>
                </div>
              </div>

              <div className="pg-quad-grid">
                <div className="pg-quad-cell t2">
                  <div className="pg-quad-cell-header">
                    <BabyIcon />
                    <span>Con đang phát triển</span>
                  </div>
                  <p>
                    Thai nhi lớn lên rõ rệt và các cơ quan tiếp tục hoàn thiện. Thai đủ lớn để bác sĩ quan sát chi tiết hình thái trên siêu âm.
                  </p>
                </div>

                <div className="pg-quad-cell t2">
                  <div className="pg-quad-cell-header">
                    <HeartPulseIcon />
                    <span>Mẹ có thể cảm thấy</span>
                  </div>
                  <p>
                    Nhiều mẹ thấy khỏe hơn và bớt buồn nôn. Bụng lộ rõ dần. Mẹ có thể bắt đầu cảm nhận cử động thai. Thời điểm cảm nhận lần đầu khác nhau giữa các mẹ; nếu băn khoăn, mẹ hỏi bác sĩ ở lần khám kế tiếp.
                  </p>
                </div>

                <div className="pg-quad-cell t2">
                  <div className="pg-quad-cell-header">
                    <CheckListIcon />
                    <span>Mẹ nên làm</span>
                  </div>
                  <ul>
                    <li>Duy trì lịch khám thai đều đặn theo hẹn của bác sĩ.</li>
                    <li>Ăn đủ các nhóm chất, vận động nhẹ nếu bác sĩ cho phép.</li>
                    <li>Chuẩn bị cho xét nghiệm sàng lọc đường huyết thai kỳ.</li>
                    <li>Tìm hiểu lớp tiền sản [BV điền: có hay không, lịch lớp].</li>
                  </ul>
                </div>

                <div className="pg-quad-cell t2">
                  <div className="pg-quad-cell-header">
                    <CalendarCheckIcon />
                    <span>Mốc khám trọng tâm</span>
                  </div>
                  <p>Siêu âm hình thái thai nhi chi tiết, sàng lọc đái tháo đường thai kỳ.</p>
                  <span className="pg-cell-tag">Khoảng tuần 18–22 &amp; Tuần 24–28</span>
                </div>
              </div>
            </article>

            {/* CHƯƠNG 3: TAM CÁ NGUYỆT 3 */}
            <article
              id="chapter-t3"
              className={`pg-chapter-card t3 ${currentTrimester === 3 ? 'highlighted' : ''}`}
            >
              <div className="pg-chapter-header">
                <div className="pg-arch-badge t3">3</div>
                <div className="pg-chapter-title-group">
                  <h2>Tam cá nguyệt 3</h2>
                  <span className="pg-approx-pill">khoảng tuần 28–40</span>
                </div>
              </div>

              <div className="pg-quad-grid">
                <div className="pg-quad-cell t3">
                  <div className="pg-quad-cell-header">
                    <BabyIcon />
                    <span>Con đang phát triển</span>
                  </div>
                  <p>
                    Thai tiếp tục tăng trưởng và hoàn thiện. Về cuối thai kỳ, bác sĩ đánh giá ngôi thai để tư vấn hướng sinh phù hợp.
                  </p>
                </div>

                <div className="pg-quad-cell t3">
                  <div className="pg-quad-cell-header">
                    <HeartPulseIcon />
                    <span>Mẹ có thể cảm thấy</span>
                  </div>
                  <p>
                    Bụng nặng, khó ngủ, mệt, đi tiểu nhiều. Có thể có những cơn gò không đều. Cách phân biệt cơn gò thường với dấu hiệu chuyển dạ sẽ do bác sĩ hướng dẫn riêng cho từng mẹ.
                  </p>
                </div>

                <div className="pg-quad-cell t3">
                  <div className="pg-quad-cell-header">
                    <CheckListIcon />
                    <span>Mẹ nên làm</span>
                  </div>
                  <ul>
                    <li>Khám thường xuyên hơn theo lịch bác sĩ hẹn.</li>
                    <li>
                      <strong>Để ý cử động thai mỗi ngày.</strong> Không có con số cử động “chuẩn” cho mọi thai; điều quan trọng là thay đổi so với thường ngày. Thấy giảm hoặc ngừng thì đi khám ngay.
                    </li>
                    <li>Tiêm phòng theo chỉ định (Tdap, cúm).</li>
                    <li>Chuẩn bị sẵn sàng cho kỳ sinh nở (xem mục Chuẩn bị sinh).</li>
                  </ul>
                </div>

                <div className="pg-quad-cell t3">
                  <div className="pg-quad-cell-header">
                    <CalendarCheckIcon />
                    <span>Mốc khám trọng tâm</span>
                  </div>
                  <p>Tiêm phòng, tầm soát liên cầu khuẩn nhóm B (GBS), đánh giá ngôi thai, thống nhất kế hoạch sinh.</p>
                  <span className="pg-cell-tag">Khoảng tuần 28, 36 &amp; hàng tuần</span>
                </div>
              </div>

              <div className="pg-chapter-footer-note">
                💡 <strong>Ghi chú cuối giai đoạn:</strong> Nếu đến khoảng tuần 41 mà mẹ chưa chuyển dạ, mẹ cần quay lại khám ngay để bác sĩ quyết định hướng xử trí y khoa.
              </div>
            </article>
          </div>
        </section>
      </div>

      {/* ====================================================================
          A3. LỊCH KHÁM VÀ XÉT NGHIỆM CHI TIẾT (TIMELINE GANTT-STYLE)
          ==================================================================== */}
      <section className="pg-timeline-section" id="schedule-section" aria-label="Lịch khám và xét nghiệm chi tiết">
        <div className="portal-container">
          <div className="pg-section-title-wrap">
            <h2>Lịch khám và xét nghiệm tiền sản</h2>
            <p>
              WHO khuyến cáo tối thiểu 8 lần tiếp xúc với nhân viên y tế trong thai kỳ (1 lần ở tam cá nguyệt 1, 2 lần ở tam cá nguyệt 2 và 5 lần ở tam cá nguyệt 3). Số lần và thời điểm cụ thể sẽ do bác sĩ điều chỉnh theo sức khỏe của từng mẹ. Các khoảng tuần dưới đây khác nhau đôi chút giữa các hướng dẫn nên chỉ mang tính tham khảo.
            </p>
          </div>

          {/* Thước đo Gantt thể hiện bản chất khoảng tuần */}
          <div className="pg-gantt-wrapper">
            <div className="pg-gantt-header">
              <span>Mốc khám lâm sàng</span>
              <span>Thước đo tuần thai (1 ────────── 13 ────────── 27 ────────── 40)</span>
            </div>
            <div className="pg-gantt-row">
              {MILESTONES.map((item) => {
                const isItemActive = selectedWeek >= item.startWeek && selectedWeek <= item.endWeek;
                const leftPercent = ((item.startWeek - 1) / 40) * 100;
                const widthPercent = Math.max(((item.endWeek - item.startWeek + 1) / 40) * 100, 8);

                return (
                  <div key={item.id} className="pg-gantt-item">
                    <span className="pg-gantt-label">{item.name}</span>
                    <div className="pg-gantt-track">
                      <div
                        className={`pg-gantt-bar ${isItemActive ? 'highlighted' : ''}`}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          backgroundColor: item.color,
                        }}
                      >
                        {item.rangeLabel}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Danh mục chi tiết các mốc khám */}
          <div className="pg-milestones-list">
            {MILESTONES.map((item) => {
              const isItemActive = selectedWeek >= item.startWeek && selectedWeek <= item.endWeek;

              return (
                <div
                  key={item.id}
                  className={`pg-milestone-card ${isItemActive ? 'highlighted' : ''}`}
                >
                  <div className="pg-milestone-head">
                    <h3>{item.name}</h3>
                    <span className="pg-milestone-badge">{item.rangeLabel}</span>
                  </div>

                  <div className="pg-milestone-body">
                    <p><strong>Mục đích:</strong> {item.purpose}</p>
                    <div className="pg-milestone-note">{item.note}</div>
                    {item.hospitalNote && (
                      <p style={{ color: '#0B4F9C', fontWeight: 600 }}>{item.hospitalNote}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hộp lưu ý lâm sàng */}
          <div className="pg-clinical-card">
            <StethoscopeIcon />
            <div>
              <p>
                <strong>Lưu ý từ Bác sĩ Tâm An:</strong> Mẹ mang theo sổ khám thai và kết quả các lần trước đến mỗi lần khám. Nếu có thai nguy cơ cao (bệnh nền, tiền sử sinh non, đa thai, tiền sản giật...), bác sĩ sẽ xây dựng lịch thăm khám và theo dõi riêng biệt.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          A4 - A7. CÁC CHỦ ĐỀ CHUNG DẠNG TAB
          ==================================================================== */}
      <section className="pg-topics-section" id="topics-section" aria-label="Các chủ đề chăm sóc chung suốt thai kỳ">
        <div className="portal-container">
          <div className="pg-section-title-wrap">
            <h2>Chăm sóc sức khỏe toàn diện</h2>
            <p>Dinh dưỡng, vận động, cách xử trí khó chịu và chăm sóc tinh thần đúng khoa học ở mọi giai đoạn thai kỳ.</p>
          </div>

          <div className="pg-tabs-nav" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTopicTab === 'dinh-duong'}
              className={`pg-tab-btn ${activeTopicTab === 'dinh-duong' ? 'active' : ''}`}
              onClick={() => setActiveTopicTab('dinh-duong')}
            >
              🥗 Dinh dưỡng &amp; Vi chất
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTopicTab === 'van-dong'}
              className={`pg-tab-btn ${activeTopicTab === 'van-dong' ? 'active' : ''}`}
              onClick={() => setActiveTopicTab('van-dong')}
            >
              🧘‍♀️ Vận động &amp; Sinh hoạt
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTopicTab === 'kho-chiu'}
              className={`pg-tab-btn ${activeTopicTab === 'kho-chiu' ? 'active' : ''}`}
              onClick={() => setActiveTopicTab('kho-chiu')}
            >
              🌿 Khó chịu thường gặp
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTopicTab === 'tinh-than'}
              className={`pg-tab-btn ${activeTopicTab === 'tinh-than' ? 'active' : ''}`}
              onClick={() => setActiveTopicTab('tinh-than')}
            >
              💛 Sức khỏe tinh thần
            </button>
          </div>

          <div className="pg-tab-content">
            {/* TAB 1: DINH DƯỠNG & VI CHẤT (A4) */}
            {activeTopicTab === 'dinh-duong' && (
              <div>
                <h3 className="pg-tab-title">Dinh dưỡng và bổ sung vi chất thai kỳ</h3>
                <p className="pg-tab-lead">
                  Ăn đa dạng, đủ chất và an toàn thực phẩm quan trọng hơn ăn thật nhiều. Lượng cần thiết và mức tăng cân phù hợp khác nhau tùy mẹ (cân nặng trước khi mang thai, sức khỏe nền), nên bác sĩ sẽ hướng dẫn riêng.
                </p>

                <div className="pg-topic-grid-2">
                  <div className="pg-topic-box">
                    <h4>💊 Vi chất quan trọng</h4>
                    <ul>
                      <li>
                        <strong>Axit folic: 400 µg mỗi ngày</strong>, bắt đầu từ khi dự định có thai (lý tưởng trước vài tháng) và tiếp tục đến hết tuần 12. Giúp giảm nguy cơ dị tật ống thần kinh. Nhóm có nguy cơ cao hơn có thể cần liều khác do bác sĩ kê. Thực phẩm giàu folate: rau lá xanh đậm, đậu, ngũ cốc bổ sung vi chất.
                      </li>
                      <li>
                        <strong>Vitamin D, sắt, canxi, i-ốt, DHA:</strong> có trong thực phẩm đa dạng; việc bổ sung và liều lượng do bác sĩ chỉ định dựa trên nhu cầu thực tế. Mẹ không tự mua liều cao.
                      </li>
                      <li>
                        <strong>Vitamin A (retinol):</strong> không tự bổ sung liều cao trong thai kỳ. Nếu dùng đa vi chất, mẹ kiểm tra thành phần với bác sĩ hoặc dược sĩ.
                      </li>
                    </ul>
                  </div>

                  <div className="pg-topic-box">
                    <h4>🥗 Nên ăn đa dạng</h4>
                    <ul>
                      <li>Rau và trái cây tươi nhiều màu sắc.</li>
                      <li>Ngũ cốc nguyên hạt, gạo lứt, yến mạch.</li>
                      <li>Đạm chất lượng: thịt nạc, cá, trứng, đậu, đậu phụ (luôn nấu chín kỹ).</li>
                      <li>Sữa và các chế phẩm từ sữa đã qua tiệt trùng.</li>
                      <li>Uống đủ nước sạch mỗi ngày.</li>
                    </ul>
                  </div>
                </div>

                <div className="pg-topic-grid-2">
                  <div className="pg-topic-box">
                    <h4>🚫 Nên tránh hoặc hạn chế</h4>
                    <ul>
                      <li><strong>Rượu bia:</strong> không có mức an toàn đã biết trong thai kỳ.</li>
                      <li><strong>Thuốc lá:</strong> ngừng hút và tránh hít khói thuốc thụ động từ người khác.</li>
                      <li>Thịt, hải sản, trứng chưa nấu chín kỹ (nguy cơ vi khuẩn, ký sinh trùng).</li>
                      <li>Sữa chưa tiệt trùng và các loại phô mai mềm làm từ sữa chưa tiệt trùng.</li>
                      <li>Gan động vật (chứa hàm lượng vitamin A dạng retinol rất cao).</li>
                      <li>Cá có thể chứa nhiều thủy ngân (cá mập, cá kiếm, cá thu vua): tránh. Mẹ hỏi bác sĩ về loại cá và lượng phù hợp.</li>
                      <li>Cà phê, trà đặc, nước tăng lực: hạn chế, mẹ hỏi bác sĩ mức phù hợp.</li>
                      <li>Thực phẩm chức năng, thảo dược: không tự dùng khi chưa hỏi bác sĩ.</li>
                    </ul>
                  </div>

                  <div className="pg-topic-box">
                    <h4>🛡️ Vệ sinh thực phẩm &amp; Ốm nghén</h4>
                    <ul>
                      <li><strong>An toàn thực phẩm:</strong> rửa tay và rửa kỹ rau quả, tách dao thớt sống chín, hâm nóng thức ăn thừa thật kỹ, không để thức ăn nấu chín ở nhiệt độ phòng quá lâu.</li>
                      <li><strong>Gợi ý cho mẹ buồn nôn, ốm nghén:</strong> chia nhỏ bữa ăn (5–6 bữa nhẹ), uống nước từng ngụm, tránh mùi gây khó chịu.</li>
                      <li><em>Lưu ý: Nôn nhiều đến mức không ăn uống được thì cần đi khám ngay (xem mục A8).</em></li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: VẬN ĐỘNG & SINH HOẠT (A5) */}
            {activeTopicTab === 'van-dong' && (
              <div>
                <h3 className="pg-tab-title">Vận động, nghỉ ngơi và sinh hoạt thường nhật</h3>
                <p className="pg-tab-lead">
                  Duy trì lối sống năng động và nghỉ ngơi hợp lý giúp mẹ cải thiện tuần hoàn, giảm đau mỏi và chuẩn bị thể lực tốt nhất cho cuộc sinh.
                </p>

                <div className="pg-topic-grid-2">
                  <div className="pg-topic-box">
                    <h4>🏃‍♀️ Vận động thể chất an toàn</h4>
                    <ul>
                      <li>Hoạt động thể chất đều đặn ở mức nhẹ đến vừa thường được khuyến khích trong thai kỳ bình thường, như đi bộ, bơi, yoga hoặc các bài tập dành cho mẹ bầu.</li>
                      <li><strong>Mẹ hỏi bác sĩ trước khi bắt đầu</strong>, đặc biệt khi có bệnh nền, dọa sảy, dọa sinh non hoặc bánh nhau bất thường.</li>
                      <li><strong>Tránh:</strong> các môn va chạm hoặc dễ té ngã, hoạt động quá sức. Mẹ vận động ở mức <em>vẫn nói chuyện được bình thường mà không bị ngắt hơi (talk test)</em>.</li>
                      <li><strong>Dừng ngay và liên hệ bác sĩ nếu:</strong> chóng mặt, đau ngực, khó thở bất thường, ra máu hoặc rỉ dịch âm đạo, đau bụng, cơn co thắt đều.</li>
                    </ul>
                  </div>

                  <div className="pg-topic-box">
                    <h4>😴 Ngủ nghỉ, thuốc &amp; Đi lại</h4>
                    <ul>
                      <li><strong>Tư thế ngủ:</strong> Nhiều bác sĩ khuyên mẹ nằm nghiêng ở giai đoạn cuối thai kỳ; mẹ hỏi bác sĩ tư thế phù hợp. Kê gối giữa hai chân hoặc dưới bụng có thể giúp dễ chịu hơn.</li>
                      <li><strong>Thuốc và hóa chất:</strong> Không tự dùng thuốc (kể cả thuốc không kê đơn) và thảo dược. Mẹ nói với bất kỳ bác sĩ hay dược sĩ nào rằng mình đang mang thai. Hạn chế tiếp xúc hóa chất độc hại, thuốc trừ sâu, khói thuốc.</li>
                      <li><strong>Đi lại và du lịch:</strong> Mẹ hỏi bác sĩ trước chuyến đi xa, nhất là gần ngày sinh hoặc khi thai nguy cơ cao.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: KHÓ CHỊU THƯỜNG GẶP (A6) */}
            {activeTopicTab === 'kho-chiu' && (
              <div>
                <h3 className="pg-tab-title">Những khó chịu thường gặp và cách xử trí an toàn</h3>
                <p className="pg-tab-lead">
                  Trang bị kiến thức tự chăm sóc an toàn tại nhà. Luôn chú ý dấu hiệu cần đi khám y tế và không tự ý dùng thuốc điều trị.
                </p>

                <div className="pg-discomfort-grid">
                  <div className="pg-discomfort-card">
                    <div className="pg-discomfort-title">1. Buồn nôn, nôn (ốm nghén)</div>
                    <div className="pg-discomfort-splits">
                      <div className="pg-discomfort-try">
                        <strong>Mẹ có thể thử:</strong>
                        Chia nhỏ bữa, uống nước từng ngụm, ngậm lát gừng tươi, tránh mùi thức ăn gây kích thích.
                      </div>
                      <div className="pg-discomfort-doctor">
                        <strong>Mẹ cần đi khám khi:</strong>
                        Nôn ói nhiều liên tục, không ăn uống được gì, sụt cân, kiệt sức hoặc chóng mặt lả người.
                      </div>
                    </div>
                  </div>

                  <div className="pg-discomfort-card">
                    <div className="pg-discomfort-title">2. Ợ nóng, trào ngược</div>
                    <div className="pg-discomfort-splits">
                      <div className="pg-discomfort-try">
                        <strong>Mẹ có thể thử:</strong>
                        Ăn chậm, chia nhỏ bữa, không nằm ngay sau khi ăn, kê cao đầu giường khi ngủ khoảng 15 cm.
                      </div>
                      <div className="pg-discomfort-doctor">
                        <strong>Mẹ cần đi khám khi:</strong>
                        Đau dữ dội vùng ngực/thượng vị, đau kéo dài không đỡ hoặc kèm theo khó thở.
                      </div>
                    </div>
                  </div>

                  <div className="pg-discomfort-card">
                    <div className="pg-discomfort-title">3. Táo bón thai kỳ</div>
                    <div className="pg-discomfort-splits">
                      <div className="pg-discomfort-try">
                        <strong>Mẹ có thể thử:</strong>
                        Tăng rau xanh, trái cây, chất xơ tự nhiên, uống đủ nước ấm mỗi ngày, duy trì vận động nhẹ.
                      </div>
                      <div className="pg-discomfort-doctor">
                        <strong>Mẹ cần đi khám khi:</strong>
                        Táo bón kéo dài nhiều ngày, đau bụng quặn thắt nhiều, hoặc đi ngoài ra máu.
                      </div>
                    </div>
                  </div>

                  <div className="pg-discomfort-card">
                    <div className="pg-discomfort-title">4. Đau lưng, đau mỏi người</div>
                    <div className="pg-discomfort-splits">
                      <div className="pg-discomfort-try">
                        <strong>Mẹ có thể thử:</strong>
                        Giữ tư thế ngồi thẳng, nghỉ ngơi, kê gối ôm, tập các động tác giãn cơ nhẹ nhàng, mang giày đế bằng.
                      </div>
                      <div className="pg-discomfort-doctor">
                        <strong>Mẹ cần đi khám khi:</strong>
                        Đau dữ dội, đau khởi phát theo cơn đều đặn, hoặc đau kèm theo ra máu, rỉ dịch âm đạo.
                      </div>
                    </div>
                  </div>

                  <div className="pg-discomfort-card">
                    <div className="pg-discomfort-title">5. Chuột rút ở bắp chân</div>
                    <div className="pg-discomfort-splits">
                      <div className="pg-discomfort-try">
                        <strong>Mẹ có thể thử:</strong>
                        Kéo giãn cơ bắp chân nhẹ nhàng (gập bàn chân về phía đầu gối), xoa bóp, vận động đều, uống đủ nước.
                      </div>
                      <div className="pg-discomfort-doctor">
                        <strong>Mẹ cần đi khám khi:</strong>
                        Bắp chân sưng đỏ, nóng rát, đau nhiều một bên chân (nghi ngờ huyết khối tĩnh mạch).
                      </div>
                    </div>
                  </div>

                  <div className="pg-discomfort-card">
                    <div className="pg-discomfort-title">6. Phù nhẹ ở chân, bàn chân</div>
                    <div className="pg-discomfort-splits">
                      <div className="pg-discomfort-try">
                        <strong>Mẹ có thể thử:</strong>
                        Nâng chân cao khi nghỉ ngơi, tránh đứng hoặc ngồi bắt chéo chân quá lâu.
                      </div>
                      <div className="pg-discomfort-doctor">
                        <strong>Mẹ cần đi khám khi:</strong>
                        Phù nặng rõ rệt ở mặt hoặc hai bàn tay, hoặc tình trạng phù xuất hiện đột ngột (dấu hiệu tiền sản giật).
                      </div>
                    </div>
                  </div>

                  <div className="pg-discomfort-card">
                    <div className="pg-discomfort-title">7. Cơn gò không đều (Braxton Hicks)</div>
                    <div className="pg-discomfort-splits">
                      <div className="pg-discomfort-try">
                        <strong>Mẹ có thể thử:</strong>
                        Đổi tư thế hoạt động, ngồi nghỉ ngơi thư giãn, uống một ly nước lọc lớn, hít thở sâu.
                      </div>
                      <div className="pg-discomfort-doctor">
                        <strong>Mẹ cần đi khám khi:</strong>
                        Cơn gò xuất hiện đều đặn, khoảng cách ngắn dần, mạnh dần kèm đau, ra máu hoặc rỉ nước âm đạo.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: SỨC KHỎE TINH THẦN (A7) */}
            {activeTopicTab === 'tinh-than' && (
              <div>
                <h3 className="pg-tab-title">Sức khỏe tinh thần và tâm lý thai kỳ</h3>
                <p className="pg-tab-lead">
                  Tâm trạng thay đổi, lo lắng khi mang thai là điều nhiều mẹ trải qua. Mẹ nên nói với bác sĩ hoặc người thân khi có những dấu hiệu sau: buồn kéo dài, mất hứng thú với những điều trước đây thích, lo âu dữ dội, ngủ hoặc ăn uống rối loạn nhiều ngày liền.
                </p>

                <div className="pg-topic-grid-2">
                  <div className="pg-topic-box" style={{ background: '#FFF0F0', borderColor: '#FFCDD2' }}>
                    <h4 style={{ color: '#D9381E' }}>⚠️ Hỗ trợ khẩn cấp</h4>
                    <p style={{ color: '#183153' }}>
                      Nếu mẹ có ý nghĩ làm hại bản thân hoặc em bé, hãy liên hệ ngay người thân hoặc bác sĩ, hoặc gọi cấp cứu.
                    </p>
                    <p style={{ fontWeight: 700, color: '#D9381E', fontSize: 16 }}>
                      Đường dây cấp cứu và tư vấn sản khoa 24/7 của Tâm An: 1900 6868
                    </p>
                    <p style={{ fontStyle: 'italic', margin: 0 }}>
                      Mẹ không phải tự chịu đựng một mình. Bác sĩ và nữ hộ sinh luôn ở đây để đồng hành cùng mẹ.
                    </p>
                  </div>

                  <div className="pg-topic-box">
                    <h4>👨‍👩‍👧 Gợi ý cho người nhà (chồng và gia đình)</h4>
                    <ul>
                      <li>Chủ động lắng nghe, đồng cảm mà không phán xét hay gạt đi cảm xúc của mẹ.</li>
                      <li>Chia sẻ việc nhà, chăm sóc bữa ăn giàu dinh dưỡng và an toàn.</li>
                      <li>Cùng mẹ đi khám thai định kỳ để nắm rõ tiến trình phát triển của con.</li>
                      <li>Kịp thời báo cho bác sĩ khi thấy mẹ có những biểu hiện lo âu, thu mình hoặc thay đổi cảm xúc đáng lo ngại.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ====================================================================
          A8. DẤU HIỆU CẦN ĐI KHÁM NGAY (CỐ ĐỊNH, KHÔNG ẨN TRONG TAB/ACCORDION)
          ==================================================================== */}
      <section className="pg-emergency-section" id="emergency-warning" aria-label="Cảnh báo an toàn y tế khẩn cấp">
        <div className="portal-container">
          <div className="pg-emergency-box">
            <div className="pg-emergency-head">
              <div className="pg-emergency-head-icon">
                <AlertTriangleIcon />
              </div>
              <div>
                <h2>Dấu hiệu cần đi khám ngay</h2>
                <span style={{ fontSize: 13.5, color: '#B71C1C', fontWeight: 700 }}>
                  KHỐI AN TOÀN TRỌNG YẾU — LUÔN HIỂN THỊ CỐ ĐỊNH
                </span>
              </div>
            </div>

            <p className="pg-emergency-intro">
              Mẹ biết cơ thể mình nhất. Nếu có điều gì khiến mẹ lo lắng, hãy liên hệ bác sĩ ngay, kể cả khi mẹ không chắc đó có phải dấu hiệu nguy hiểm hay không.
            </p>

            <div className="pg-emergency-tiers">
              {/* NHÓM 1: CẤP CỨU KHẨN CẤP */}
              <div className="pg-tier-card pg-tier-1">
                <h3>🚨 Nhóm 1. Gọi cấp cứu 115 hoặc đến ngay cấp cứu gần nhất</h3>
                <ul className="pg-tier-list">
                  <li>Khó thở, thở dốc bất thường.</li>
                  <li>Đau ngực dữ dội hoặc tim đập nhanh bất thường.</li>
                  <li>Lên cơn co giật hoặc mất ý thức.</li>
                  <li>Có ý nghĩ muốn làm hại bản thân hoặc em bé.</li>
                </ul>
              </div>

              {/* NHÓM 2: LIÊN HỆ BÁC SĨ NGAY */}
              <div className="pg-tier-card pg-tier-2">
                <h3>⚠️ Nhóm 2. Liên hệ bác sĩ ngay; nếu chưa liên lạc được thì đến cơ sở cấp cứu</h3>
                <ul className="pg-tier-list">
                  <li>Ra máu âm đạo, hoặc rỉ dịch từ âm đạo (nghi ngờ vỡ ối), hoặc ra dịch có mùi hôi.</li>
                  <li>Đau bụng dữ dội, quặn thắt liên tục không dứt.</li>
                  <li>Thai cử động ít đi hoặc ngừng cử động so với thường ngày.</li>
                  <li>Đau đầu dữ dội không hết hoặc tăng dần.</li>
                  <li>Chóng mặt nghiêm trọng hoặc ngất xỉu.</li>
                  <li>Nhìn mờ, hoa mắt hoặc thay đổi thị lực.</li>
                  <li>Sốt cao (trên 38°C).</li>
                  <li>Buồn nôn, nôn nhiều và nặng, không giống ốm nghén thông thường.</li>
                  <li>Phù nặng ở mặt hoặc bàn tay, khác với phù nhẹ thường gặp.</li>
                  <li>Sưng, tấy đỏ, đau nhiều ở một bên chân.</li>
                  <li>Mệt lả bất thường, kiệt sức không rõ nguyên nhân.</li>
                </ul>
              </div>
            </div>

            <div className="pg-emergency-hotline-bar">
              <div className="pg-emergency-hotline-text">
                Tổng đài Cấp cứu và Tư vấn sản khoa 24/7 của Tâm An Hospital:
                <div className="pg-emergency-hotline-number">📞 1900 6868</div>
              </div>
              <a href="tel:19006868" className="pg-btn-call-now">
                <PhoneCallIcon />
                <span>Gọi cấp cứu ngay</span>
              </a>
            </div>

            <p style={{ fontSize: 13, color: '#6F7F8F', marginTop: 14, marginBottom: 0 }}>
              * Lưu ý: Khi đến bất kỳ cơ sở y tế nào, mẹ nói rõ mình đang mang thai (và số tuần nếu nhớ). Danh sách này không bao gồm mọi triệu chứng có thể xảy ra.
            </p>
          </div>
        </div>
      </section>

      {/* ====================================================================
          A9. CHUẨN BỊ SINH VÀ HẬU SẢN
          ==================================================================== */}
      <section className="pg-birth-section" id="birth-prep-section" aria-label="Chuẩn bị sinh và chăm sóc sau sinh">
        <div className="portal-container">
          <div className="pg-section-title-wrap">
            <h2>Chuẩn bị sinh và chăm sóc sau sinh</h2>
            <p>Hành trang chu đáo để mẹ tự tin, an tâm đón chào bé yêu chào đời bình an.</p>
          </div>

          <div className="pg-birth-grid">
            <div className="pg-birth-card">
              <h3>1. Phương pháp sinh &amp; Kế hoạch sinh</h3>
              <p>
                <strong>Chọn phương pháp sinh:</strong> Sinh thường hay mổ lấy thai được quyết định cùng bác sĩ dựa trên sức khỏe của mẹ và thai. Mẹ nên chủ động hỏi bác sĩ từ tam cá nguyệt 3.
              </p>
              <p>
                <strong>Kế hoạch sinh:</strong> Mẹ ghi lại mong muốn (người đi cùng, giảm đau, chăm sóc sau sinh, cho con bú sớm) để trao đổi với bác sĩ. Tâm An hỗ trợ: phòng sinh gia đình, sinh không đau [BV điền: xác nhận dịch vụ].
              </p>
            </div>

            <div className="pg-birth-card">
              <h3>2. Giấy tờ &amp; Đồ dùng mang đi sinh</h3>
              <ul>
                <li><strong>Giấy tờ cần mang:</strong> sổ khám thai, toàn bộ kết quả xét nghiệm và siêu âm, giấy tờ tùy thân (CCCD), thẻ bảo hiểm y tế (nếu có) [BV điền: thủ tục nhập viện].</li>
                <li><strong>Đồ dùng:</strong> Danh sách đồ dùng cho mẹ và cho bé [BV điền: danh sách chuẩn của bệnh viện].</li>
              </ul>
            </div>

            <div className="pg-birth-card">
              <h3>3. Dấu hiệu chuyển dạ &amp; Quá ngày dự sinh</h3>
              <p>
                <strong>Dấu hiệu chuyển dạ:</strong> cơn co tử cung đều đặn (khoảng 3–5 phút/cơn), mạnh dần, đau tăng lên; vỡ ối; ra dịch hồng/máu. Thời điểm cần đến bệnh viện tùy từng mẹ (người sinh lần đầu, thai nguy cơ cao, nhà xa bệnh viện), nên bác sĩ sẽ dặn riêng ở lần khám cuối. Khi không chắc, mẹ gọi <strong>1900 6868</strong>.
              </p>
              <p>
                <strong>Quá ngày dự sinh:</strong> Nếu đến khoảng tuần 41 chưa chuyển dạ, mẹ cần quay lại khám để bác sĩ quyết định.
              </p>
            </div>

            <div className="pg-birth-card">
              <h3>4. Chăm sóc sau sinh (Hậu sản)</h3>
              <p>
                Mẹ vẫn cần theo dõi sát sao sau khi sinh. Các dấu hiệu nguy hiểm cũng có thể xảy ra sau sinh và mẹ cần liên hệ bác sĩ ngay khi gặp:
              </p>
              <ul>
                <li>Chảy máu âm đạo nhiều bất thường (ướt đẫm băng trong 1 giờ).</li>
                <li>Sốt cao, sản dịch có mùi hôi.</li>
                <li>Đau hoặc sưng tấy một bên bắp chân, đau đầu dữ dội, khó thở.</li>
                <li>Vết mổ hoặc vết khâu tầng sinh môn không lành, chảy dịch.</li>
                <li>Tâm trạng suy sụp, kiệt quệ, trầm cảm sau sinh.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          A10. HỎI ĐÁP THƯỜNG GẶP (ACCORDION)
          ==================================================================== */}
      <section className="pg-faq-section" id="faq-section" aria-label="Câu hỏi thường gặp về thai kỳ">
        <div className="portal-container">
          <div className="pg-section-title-wrap">
            <h2>Hỏi đáp thường gặp trong thai kỳ</h2>
            <p>Giải đáp thắc mắc phổ biến theo khuyến cáo y khoa chính thống từ các chuyên gia sản phụ khoa.</p>
          </div>

          <div className="pg-faq-list">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaqIndex === index;

              return (
                <div key={index} className={`pg-faq-item ${isOpen ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="pg-faq-question"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <ChevronDownIcon className="pg-faq-chevron" />
                  </button>
                  {isOpen && (
                    <div className="pg-faq-answer">
                      <p style={{ margin: 0 }}>{item.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ====================================================================
          A11. KÊU GỌI HÀNH ĐỘNG & CUỐI TRANG
          ==================================================================== */}
      <section className="pg-cta-section" aria-label="Đặt lịch khám và nguồn tham chiếu">
        <div className="portal-container">
          {/* Băng CTA cuối trang */}
          <div className="pg-cta-banner">
            <h2 className="pg-cta-title">Mẹ cần bác sĩ sản khoa đồng hành?</h2>
            <p className="pg-cta-desc">
              Chủ động chọn bác sĩ giỏi, chọn giờ khám tiện lợi, chăm sóc toàn diện không cần xếp hàng chờ đợi tại Bệnh viện Phụ sản Tâm An.
            </p>
            <div className="pg-cta-actions">
              <AppLink href="/dat-lich" className="pg-btn-cta-primary">
                Đặt lịch khám ngay
              </AppLink>
              <AppLink href="/dich-vu" className="pg-btn-cta-secondary">
                Xem gói sinh trọn gói
              </AppLink>
            </div>
            <div style={{ marginTop: 8, fontSize: 14.5, color: '#FFE0C2' }}>
              Cấp cứu và tư vấn sản khoa 24/7: <strong>1900 6868</strong>
            </div>
          </div>

          {/* Khối nguồn tham chiếu y khoa */}
          <div className="pg-sources-block" id="medical-sources">
            <div className="pg-sources-title">
              <StethoscopeIcon />
              <span>Nguồn tham khảo y khoa chính thống &amp; Miễn trừ trách nhiệm</span>
            </div>
            <div className="pg-sources-disclaimer">
              Nội dung trên trang mang tính thông tin, không thay thế chẩn đoán, tư vấn hay điều trị của bác sĩ. Các khoảng tuần có thể khác nhau tùy hướng dẫn và tình trạng từng mẹ.
            </div>
            <ul className="pg-sources-list">
              <li><strong>WHO (2016):</strong> WHO recommendations on antenatal care for a positive pregnancy experience.</li>
              <li><strong>CDC:</strong> Urgent Maternal Warning Signs (Chiến dịch Hear Her).</li>
              <li><strong>NHS:</strong> Vitamins, supplements and nutrition in pregnancy.</li>
              <li><strong>ACOG:</strong> Các hướng dẫn lâm sàng tiền sản (siêu âm hình thái, sàng lọc tiểu đường thai kỳ, vắc-xin Tdap, sàng lọc GBS).</li>
            </ul>

            <div className="pg-source-chips">
              <span className="pg-source-chip">WHO 2016</span>
              <span className="pg-source-chip">CDC Hear Her</span>
              <span className="pg-source-chip">NHS Guidelines</span>
              <span className="pg-source-chip">ACOG Standards</span>
              <span className="pg-source-chip" style={{ background: '#E6F4FF', color: '#0B4F9C' }}>
                Hội đồng Sản khoa Tâm An Hospital
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          B1 / B8. DẢI CỐ ĐỊNH DƯỚI ĐÁY MÀN HÌNH (STICKY EMERGENCY PILL)
          ==================================================================== */}
      <div className="pg-floating-bar" role="complementary" aria-label="Thanh cấp cứu nhanh">
        <a
          href="#emergency-warning"
          className="pg-floating-link"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('emergency-warning');
          }}
        >
          <AlertTriangleIcon />
          <span>Dấu hiệu cần đi khám ngay</span>
        </a>
        <a href="tel:19006868" className="pg-floating-call-btn">
          <PhoneCallIcon />
          <span>1900 6868</span>
        </a>
      </div>

      <PublicPortalFooter />
      <ChatbotLauncher />
    </div>
  );
};

export default PatientPregnancyGuidePage;

