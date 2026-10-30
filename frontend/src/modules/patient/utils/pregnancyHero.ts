import { PREGNANCY_MILESTONES, STAGE_TIPS, TIMELINE_POINTS } from '../config/pregnancyHeroConfig';

export interface GestationalCalculationInput {
  estimatedDueDate?: string | Date | null;
  lastMenstrualPeriod?: string | Date | null;
  now?: string | Date | number;
}

/**
 * Chuyển đổi một thời điểm bất kỳ sang chuỗi ngày YYYY-MM-DD theo múi giờ Việt Nam (Asia/Ho_Chi_Minh).
 */
export function toVietnamDateString(dateInput: Date | string | number): string {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Tính số ngày chênh lệch giữa 2 chuỗi ngày YYYY-MM-DD (d2 - d1).
 */
export function daysBetweenVietnamDates(date1Str: string, date2Str: string): number {
  if (!date1Str || !date2Str) return 0;
  const [y1, m1, d1] = date1Str.split('-').map(Number);
  const [y2, m2, d2] = date2Str.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (24 * 60 * 60 * 1000));
}

/**
 * Tính tuần thai hiện tại dựa trên ngày dự sinh (EDD) hoặc ngày kinh cuối (LMP).
 * Quy tắc nghiệp vụ 4.1:
 * - Ưu tiên 1: EDD -> tuần thai = 40 − (EDD − hôm nay) / 7, lấy phần nguyên (Math.floor).
 * - Ưu tiên 2: LMP -> tuần thai = (hôm nay − LMP) / 7, lấy phần nguyên (Math.floor).
 * - Nếu không có cả hai: trả về null.
 * - Nếu tuần thai < 0 hoặc > 42: trả về null (ngoài khoảng thai kỳ hợp lệ).
 */
export function calculateGestationalWeek({
  estimatedDueDate,
  lastMenstrualPeriod,
  now = new Date(),
}: GestationalCalculationInput): number | null {
  const todayStr = toVietnamDateString(now);
  if (!todayStr) return null;

  let calculatedWeek: number | null = null;

  // 1. Ưu tiên 1: Ngày dự sinh (EDD)
  if (estimatedDueDate) {
    const eddStr = toVietnamDateString(estimatedDueDate);
    if (eddStr) {
      const daysToEdd = daysBetweenVietnamDates(todayStr, eddStr);
      // tuần thai = 40 - (EDD - hôm nay) / 7
      calculatedWeek = Math.floor(40 - daysToEdd / 7);
    }
  }

  // 2. Ưu tiên 2: Ngày kinh cuối (LMP)
  if (calculatedWeek === null && lastMenstrualPeriod) {
    const lmpStr = toVietnamDateString(lastMenstrualPeriod);
    if (lmpStr) {
      const daysFromLmp = daysBetweenVietnamDates(lmpStr, todayStr);
      // tuần thai = (hôm nay - LMP) / 7
      calculatedWeek = Math.floor(daysFromLmp / 7);
    }
  }

  if (calculatedWeek === null) return null;

  // Nếu ngoài khoảng 0 - 42 tuần thì không hợp lệ
  if (calculatedWeek < 0 || calculatedWeek > 42) {
    return null;
  }

  return calculatedWeek;
}

/**
 * Nội suy tuyến tính vị trí (%) của nút cam "Bạn ở đây" giữa 2 cột mốc gần nhất.
 * Các cột mốc: 0, 12, 18, 24, 28, 32, 36, 40 (7 khoảng).
 */
export function getTimelinePosition(week: number): number {
  const pts = TIMELINE_POINTS;
  const N = pts.length - 1; // 7 intervals
  const w = Math.min(Math.max(week, 0), 40);

  for (let k = 0; k < N; k += 1) {
    if (w <= pts[k + 1]) {
      const intervalSpan = pts[k + 1] - pts[k];
      const offsetInInterval = (w - pts[k]) / intervalSpan;
      return ((k + offsetInInterval) / N) * 100;
    }
  }

  return 100;
}

/**
 * Lấy câu theo giai đoạn tuần thai (Quy tắc 4.3).
 * - Dưới 12: index 0
 * - 12 đến dưới 18: index 1
 * - 18 đến dưới 24: index 2
 * - 24 đến dưới 28: index 3
 * - 28 đến dưới 32: index 4
 * - 32 đến dưới 36: index 5
 * - Từ 36: index 6
 */
export function getStageTip(week: number): string {
  const stageBoundaries = [12, 18, 24, 28, 32, 36];
  const stage = stageBoundaries.filter((b) => week >= b).length;
  return STAGE_TIPS[stage] ?? STAGE_TIPS[0];
}

/**
 * Tính số ngày còn lại đến lịch hẹn theo múi giờ Việt Nam (Quy tắc 4.4).
 * - Cùng ngày: "Hôm nay"
 * - Ngày kế tiếp: "Ngày mai"
 * - X ngày (> 1): "Còn X ngày"
 * - Đã qua (< 0): "Hôm nay" hoặc "Đã diễn ra"
 */
export function calculateDaysLeft(targetDate: string | Date, now: string | Date | number = new Date()): string {
  const todayStr = toVietnamDateString(now);
  const targetStr = toVietnamDateString(targetDate);
  if (!todayStr || !targetStr) return 'Sắp diễn ra';

  const diffDays = daysBetweenVietnamDates(todayStr, targetStr);
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Ngày mai';
  if (diffDays > 1) return `Còn ${diffDays} ngày`;
  return 'Hôm nay';
}

/**
 * Rút trích tên thân mật của người bệnh để tạo lời chào ấm áp.
 * Ví dụ: "Lê Ngọc Mai" -> "Ngọc Mai", "Nguyễn Minh Anh" -> "Minh Anh", "Trần Thị Lan" -> "Lan".
 */
export function extractGreetingName(fullName?: string | null, email?: string | null): string {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 3) {
      return parts.slice(-2).join(' ');
    }
    return parts[parts.length - 1];
  }

  if (email && email.trim()) {
    const localPart = email.split('@')[0];
    const cleaned = localPart.replace(/[._-]+/g, ' ');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return 'mẹ';
}

