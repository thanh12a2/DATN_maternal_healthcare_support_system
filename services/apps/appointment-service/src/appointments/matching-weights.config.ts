/**
 * matching-weights.config.ts
 *
 * Cấu hình trọng số cho Thuật toán Phân bổ Bác sĩ Thông minh (Smart Doctor Matching Engine)
 * Chế độ "Bệnh viện tự động sắp xếp" (selectionMode: RANK / AUTO)
 */

export const MATCHING_WEIGHTS = {
  /**
   * Bác sĩ đã từng khám thai kỳ này cho bệnh nhân (Continuity of Care)
   * Thuộc ngạch tiêu chuẩn BASIC -> Ưu tiên cao nhất để liền mạch theo dõi sản khoa
   */
  CONTINUITY_OF_CARE_SCORE: 50,

  /**
   * Điểm tối đa cho tiêu chí Cân bằng tải buồng khám (Load Balancing)
   */
  LOAD_BALANCE_MAX_SCORE: 30,

  /**
   * Mức trừ điểm cho mỗi ca khám đã được đặt của bác sĩ trong cùng ngày khám
   * Điểm cân bằng = Math.max(0, LOAD_BALANCE_MAX_SCORE - count * PENALTY)
   */
  LOAD_BALANCE_PENALTY_PER_APPOINTMENT: 5,

  /**
   * Thời gian giữ chỗ tạm thời (Slot Hold TTL): 5 phút (tính bằng mili-giây)
   */
  SLOT_HOLD_TTL_MS: 5 * 60 * 1000,
};

