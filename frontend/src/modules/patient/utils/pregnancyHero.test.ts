import { describe, expect, it } from 'vitest';
import {
  calculateDaysLeft,
  calculateGestationalWeek,
  extractGreetingName,
  getStageTip,
  getTimelinePosition,
  toVietnamDateString,
} from './pregnancyHero';
import { STAGE_TIPS } from '../config/pregnancyHeroConfig';

describe('pregnancyHero Utility Functions', () => {
  describe('calculateGestationalWeek', () => {
    // Giả lập "hôm nay" là ngày 2026-10-30 theo giờ Việt Nam
    const mockToday = '2026-10-30T10:00:00+07:00';

    it('tính chính xác tuần thai từ EDD (ưu tiên 1)', () => {
      // EDD: 2027-01-21 (còn 83 ngày kể từ 2026-10-30)
      // tuần thai = 40 - (83 / 7) = 40 - 11.857 = 28.14 -> 28 tuần
      const week = calculateGestationalWeek({
        estimatedDueDate: '2027-01-21',
        lastMenstrualPeriod: '2026-04-16',
        now: mockToday,
      });
      expect(week).toBe(28);
    });

    it('tính chính xác tuần thai từ LMP khi không có EDD (ưu tiên 2)', () => {
      // LMP: 2026-04-16 (cách hôm nay 197 ngày)
      // tuần thai = 197 / 7 = 28.14 -> 28 tuần
      const week = calculateGestationalWeek({
        lastMenstrualPeriod: '2026-04-16',
        now: mockToday,
      });
      expect(week).toBe(28);
    });

    it('ưu tiên EDD hơn LMP khi cả hai cùng có', () => {
      // Giả sử EDD chỉ định thai 20 tuần, nhưng LMP tính ra 22 tuần: kết quả phải theo EDD
      const week = calculateGestationalWeek({
        estimatedDueDate: '2027-03-19', // cách 140 ngày = 20 tuần còn lại -> tuần 20
        lastMenstrualPeriod: '2026-04-01',
        now: mockToday,
      });
      expect(week).toBe(20);
    });

    it('xử lý các ngày biên: tuần 0', () => {
      // 40 tuần (280 ngày) trước EDD -> tuần 0
      const week = calculateGestationalWeek({
        estimatedDueDate: '2027-08-06', // 280 ngày kể từ 2026-10-30
        now: mockToday,
      });
      expect(week).toBe(0);
    });

    it('xử lý các ngày biên: tuần 40 (đúng ngày dự sinh)', () => {
      const week = calculateGestationalWeek({
        estimatedDueDate: '2026-10-30',
        now: mockToday,
      });
      expect(week).toBe(40);
    });

    it('xử lý các ngày biên: tuần 42 (quá ngày dự sinh 14 ngày)', () => {
      const week = calculateGestationalWeek({
        estimatedDueDate: '2026-10-16', // 14 ngày trước hôm nay -> 40 - (-14/7) = 42
        now: mockToday,
      });
      expect(week).toBe(42);
    });

    it('trả về null khi thiếu cả EDD và LMP', () => {
      const week = calculateGestationalWeek({
        now: mockToday,
      });
      expect(week).toBeNull();
    });

    it('trả về null khi tuần thai âm (< 0)', () => {
      // EDD cách hơn 41 tuần trong tương lai
      const week = calculateGestationalWeek({
        estimatedDueDate: '2027-09-01',
        now: mockToday,
      });
      expect(week).toBeNull();
    });

    it('trả về null khi tuần thai quá lớn (> 42)', () => {
      // EDD cách 30 ngày trước hôm nay -> tuần 44 (> 42)
      const week = calculateGestationalWeek({
        estimatedDueDate: '2026-09-30',
        now: mockToday,
      });
      expect(week).toBeNull();
    });
  });

  describe('getStageTip (chọn câu theo giai đoạn tuần thai)', () => {
    it('kiểm tra các mốc biên 11 và 12', () => {
      expect(getStageTip(11)).toBe(STAGE_TIPS[0]);
      expect(getStageTip(12)).toBe(STAGE_TIPS[1]);
    });

    it('kiểm tra các mốc biên 17 và 18', () => {
      expect(getStageTip(17)).toBe(STAGE_TIPS[1]);
      expect(getStageTip(18)).toBe(STAGE_TIPS[2]);
    });

    it('kiểm tra các mốc biên 23 và 24', () => {
      expect(getStageTip(23)).toBe(STAGE_TIPS[2]);
      expect(getStageTip(24)).toBe(STAGE_TIPS[3]);
    });

    it('kiểm tra các mốc biên 27 và 28', () => {
      expect(getStageTip(27)).toBe(STAGE_TIPS[3]);
      expect(getStageTip(28)).toBe(STAGE_TIPS[4]);
    });

    it('kiểm tra các mốc biên 31 và 32', () => {
      expect(getStageTip(31)).toBe(STAGE_TIPS[4]);
      expect(getStageTip(32)).toBe(STAGE_TIPS[5]);
    });

    it('kiểm tra các mốc biên 35 và 36', () => {
      expect(getStageTip(35)).toBe(STAGE_TIPS[5]);
      expect(getStageTip(36)).toBe(STAGE_TIPS[6]);
    });

    it('kiểm tra mốc tuần 40', () => {
      expect(getStageTip(40)).toBe(STAGE_TIPS[6]);
    });
  });

  describe('getTimelinePosition (nội suy tuyến tính vị trí nút cam)', () => {
    // 7 khoảng chia đều: 0 -> 12 -> 18 -> 24 -> 28 -> 32 -> 36 -> 40
    // Mỗi khoảng chiếm 100% / 7 = ~14.2857%
    it('nội suy chính xác cho tuần 6 (giữa 0 và 12)', () => {
      // 0.5 khoảng / 7 = 50% / 7 = 7.142857%
      const pos = getTimelinePosition(6);
      expect(pos).toBeCloseTo(7.14, 1);
    });

    it('nội suy chính xác cho tuần 12 (cột mốc 1)', () => {
      const pos = getTimelinePosition(12);
      expect(pos).toBeCloseTo(14.2857, 1);
    });

    it('nội suy chính xác cho tuần 18 (cột mốc 2)', () => {
      const pos = getTimelinePosition(18);
      expect(pos).toBeCloseTo(28.5714, 1);
    });

    it('nội suy chính xác cho tuần 24 (cột mốc 3)', () => {
      const pos = getTimelinePosition(24);
      expect(pos).toBeCloseTo(42.8571, 1);
    });

    it('nội suy chính xác cho tuần 26 (chính giữa 24 và 28)', () => {
      // Khoảng thứ 4 (từ 24 đến 28), tuần 26 là nửa khoảng
      // (3 + 0.5) / 7 * 100 = 3.5 / 7 * 100 = 50%
      const pos = getTimelinePosition(26);
      expect(pos).toBe(50);
    });

    it('nội suy chính xác cho tuần 28 (cột mốc 4)', () => {
      const pos = getTimelinePosition(28);
      expect(pos).toBeCloseTo(57.1428, 1);
    });

    it('nội suy chính xác cho tuần 40 (cột mốc cuối)', () => {
      const pos = getTimelinePosition(40);
      expect(pos).toBe(100);
    });
  });

  describe('calculateDaysLeft (tính số ngày còn lại theo giờ VN)', () => {
    const mockNow = new Date('2026-10-30T14:30:00+07:00');

    it('trả về "Hôm nay" khi lịch hẹn cùng ngày', () => {
      const result = calculateDaysLeft('2026-10-30T16:00:00+07:00', mockNow);
      expect(result).toBe('Hôm nay');
    });

    it('trả về "Ngày mai" khi lịch hẹn sang ngày hôm sau', () => {
      const result = calculateDaysLeft('2026-10-31T08:30:00+07:00', mockNow);
      expect(result).toBe('Ngày mai');
    });

    it('trả về "Còn X ngày" khi cách nhiều ngày', () => {
      const result = calculateDaysLeft('2026-11-05T08:30:00+07:00', mockNow);
      expect(result).toBe('Còn 6 ngày');
    });

    it('xử lý đúng mốc qua nửa đêm theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)', () => {
      // Thời điểm 23:59:59 của ngày 30/10 tại VN (tương ứng 16:59:59 UTC ngày 30/10)
      const lateNightVN = new Date('2026-10-30T23:59:59+07:00');
      // Lịch hẹn lúc 08:00 sáng ngày 31/10
      const nextMorningVN = '2026-10-31T08:00:00+07:00';
      expect(calculateDaysLeft(nextMorningVN, lateNightVN)).toBe('Ngày mai');

      // Ngay sau nửa đêm 00:01:00 ngày 31/10 tại VN
      const justAfterMidnightVN = new Date('2026-10-31T00:01:00+07:00');
      expect(calculateDaysLeft(nextMorningVN, justAfterMidnightVN)).toBe('Hôm nay');
    });
  });

  describe('extractGreetingName', () => {
    it('trích xuất tên gọi thân mật từ họ tên đầy đủ', () => {
      expect(extractGreetingName('Lê Ngọc Mai')).toBe('Ngọc Mai');
      expect(extractGreetingName('Nguyễn Minh Anh')).toBe('Minh Anh');
      expect(extractGreetingName('Trần Lan')).toBe('Lan');
    });

    it('fallback lấy tên từ email khi chưa có họ tên', () => {
      expect(extractGreetingName(null, 'mai.nguyen@gmail.com')).toBe('Mai nguyen');
    });
  });
});

