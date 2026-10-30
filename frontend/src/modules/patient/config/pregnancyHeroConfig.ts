// Cấu hình các cột mốc và câu thông điệp theo tuần thai cho Cổng Bệnh nhân Tâm An

export interface MilestoneTick {
  w: number;
  name: string;
}

export const PREGNANCY_MILESTONES: MilestoneTick[] = [
  { w: 12, name: 'Hoàn tất sàng lọc quý I' },
  { w: 18, name: 'Siêu âm hình thái' },
  { w: 24, name: 'Sàng lọc tiểu đường' },
  { w: 28, name: 'Tam cá nguyệt 3' },
  { w: 32, name: 'Chuẩn bị trước sinh' },
  { w: 36, name: 'Sẵn sàng đón bé' },
  { w: 40, name: 'Dự kiến sinh' },
];

export const TIMELINE_POINTS = [0, ...PREGNANCY_MILESTONES.map((t) => t.w)];

export const STAGE_TIPS = [
  'Mẹ hãy đặt lịch khám thai đầu tiên và bắt đầu lập hồ sơ thai kỳ nhé.',
  'Mẹ nhớ theo dõi kết quả sàng lọc quý I và duy trì lịch khám định kỳ nhé.',
  'Đây là thời điểm quan trọng để kiểm tra hình thái và sự phát triển của bé.',
  'Mẹ đừng quên xét nghiệm sàng lọc tiểu đường thai kỳ nhé.',
  'Mẹ hãy duy trì lịch khám và theo dõi sự phát triển của bé nhé.',
  'Mẹ hãy chuẩn bị kế hoạch sinh và tìm hiểu quy trình nhập viện nhé.',
  'Mẹ hãy chuẩn bị đồ đi sinh và lưu sẵn số liên hệ khi cần nhé.',
] as const;

