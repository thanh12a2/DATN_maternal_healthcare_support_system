import { useEffect, useState, type CSSProperties } from 'react';
import { PregnancyStoryFrame } from './PregnancyStoryFrame';

const stages = [
  {
    first: 1, last: 13, color: '#f6a9c2', title: 'Hình thành nền tảng',
    subtitle: 'Tuần 1–13 · Mọi cơ quan chính của bé bắt đầu hình thành',
    baby: 'Phôi làm tổ, tim bắt đầu hoạt động và các cơ quan chính dần hình thành.',
    mom: 'Mẹ có thể buồn nôn, mệt mỏi, ngực căng và dễ thay đổi tâm trạng. Đây là phản ứng bình thường khi nội tiết tố thay đổi.',
    todo: ['Bổ sung axit folic theo hướng dẫn', 'Khám thai lần đầu, siêu âm xác định tim thai', 'Xét nghiệm máu và nước tiểu cơ bản', 'Ăn nhiều bữa nhỏ, uống đủ nước'],
    milestones: [[6, 'Có thể thấy tim thai'], [8, 'Khám thai và xét nghiệm đầu tiên'], [11, 'Đo độ mờ da gáy (tuần 11–13)'], [12, 'Các cơ quan chính đã hình thành']],
  },
  {
    first: 14, last: 27, color: '#b9c48a', title: 'Giai đoạn dễ chịu',
    subtitle: 'Tuần 14–27 · Bé lớn nhanh, mẹ khỏe và có nhiều năng lượng hơn',
    baby: 'Bé lớn nhanh, bắt đầu cử động và có thể quan sát rõ hơn qua siêu âm.',
    mom: 'Ốm nghén giảm, bụng bầu rõ hơn, mẹ thấy khỏe hơn. Một số mẹ bị đau lưng, chuột rút hoặc táo bón nhẹ.',
    todo: ['Siêu âm hình thái học chi tiết', 'Sàng lọc tiểu đường thai kỳ', 'Tiêm phòng theo chỉ định của bác sĩ', 'Tập yoga bầu nhẹ nhàng, ăn đủ canxi và sắt'],
    milestones: [[16, 'Có thể bắt đầu cảm nhận thai máy'], [18, 'Siêu âm hình thái học (tuần 18–22)'], [20, 'Đi được nửa chặng đường'], [24, 'Nghiệm pháp dung nạp glucose (24–28)']],
  },
  {
    first: 28, last: 40, color: '#ffd46e', title: 'Chặng nước rút',
    subtitle: 'Tuần 28–40 · Bé hoàn thiện và mẹ chuẩn bị đón con chào đời',
    baby: 'Bé tăng cân, các cơ quan dần hoàn thiện và chuẩn bị chào đời.',
    mom: 'Mẹ dễ mệt, khó ngủ, đi tiểu nhiều, ợ nóng và có thể có những cơn gò nhẹ. Hãy nghỉ ngơi và lắng nghe cơ thể.',
    todo: ['Khám thai dày hơn, theo lịch của bác sĩ', 'Đếm cử động thai mỗi ngày', 'Chuẩn bị đồ đi sinh, học dấu hiệu chuyển dạ', 'Trao đổi kế hoạch sinh và giảm đau với bác sĩ'],
    milestones: [[28, 'Bắt đầu tam cá nguyệt cuối'], [32, 'Chuẩn bị đồ đi sinh'], [35, 'Xét nghiệm GBS (tuần 35–37)'], [37, 'Thai đủ tháng'], [40, 'Ngày dự sinh']],
  },
] as const;

export function PregnancyWeekNavigator({ week, onWeekChange }: { week: number; onWeekChange: (week: number) => void }) {
  const [playing, setPlaying] = useState(false);
  const stageIndex = week <= 13 ? 0 : week <= 27 ? 1 : 2;
  const stage = stages[stageIndex];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (week >= 40) { setPlaying(false); return; }
      onWeekChange(week + 1);
    }, 650);
    return () => window.clearInterval(timer);
  }, [playing, week, onWeekChange]);

  const chooseWeek = (next: number) => { setPlaying(false); onWeekChange(next); };

  return (
    <div className="pg-week-journey" role="group" aria-label="Thanh thời gian thai kỳ" style={{ '--week-color': stage.color } as CSSProperties}>
      <div className="pg-week-journey-top">
        <div className="pg-week-journey-question"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6c-1.5-3 1-5 4-3"/><circle cx="24" cy="26" r="16"/><path d="M8.5 24c-3.5-1-4.5 4-1.5 6.5M39.5 24c3.5-1 4.5 4 1.5 6.5"/><circle cx="18" cy="24" r="1.3"/><circle cx="30" cy="24" r="1.3"/><path d="M19 32c3 3 7 3 10 0"/></svg><h2>Mẹ đang ở<br />tuần thai nào?</h2></div>
        <div className="pg-week-journey-actions"><button type="button" className="pg-week-play" aria-pressed={playing} onClick={() => { if (!playing && week === 40) onWeekChange(1); setPlaying(!playing); }}>{playing ? 'Tạm dừng' : '▶  Xem hành trình'}</button><span className="pg-week-pill" aria-live="polite">Tuần <b>{week}</b> · Tam cá nguyệt {stageIndex + 1}</span></div>
      </div>
      <div className="pg-week-journey-range"><input type="range" min="1" max="40" value={week} onChange={(event) => chooseWeek(Number(event.target.value))} aria-label="Tuần thai" aria-valuetext={`Tuần ${week}, tam cá nguyệt ${stageIndex + 1}`} /><div className="pg-week-journey-labels"><span>Tuần 1</span>{stages.map((item, index) => <button type="button" key={item.first} className={stageIndex === index ? 'active' : ''} aria-pressed={stageIndex === index} onClick={() => chooseWeek(item.first)}>TCN {index + 1} ({item.first}–{item.last})</button>)}<span>Tuần 40</span></div></div>
      <div className="pg-week-journal-layout">
        <PregnancyStoryFrame trimester={stageIndex + 1} followsWeek />
        <div className="pg-week-journey-panel" key={stage.first}>
        <div className="pg-week-journey-heading"><span>Tam cá nguyệt {stageIndex + 1}</span><h3>{stage.title}</h3></div>
        <p className="pg-week-journey-subtitle">{stage.subtitle}</p>
        <div className="pg-week-journey-columns"><article><h4>Em bé</h4><p>{stage.baby}</p></article><article><h4>Cơ thể mẹ</h4><p>{stage.mom}</p></article><article><h4>Việc nên làm</h4><ul>{stage.todo.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul></article></div>
        <div className="pg-week-journey-milestones" aria-label="Các mốc quan trọng">{stage.milestones.map(([number, text]) => <span className={week >= number ? 'active' : ''} key={number}>Tuần {number} · {text}</span>)}</div>
        <a className="pg-story-read" href={`#chapter-t${stageIndex + 1}`} onClick={() => setPlaying(false)}>Đọc về tam cá nguyệt {stageIndex + 1} ↓</a>
        </div>
      </div>
      <p className="pg-week-journey-note">Thông tin mang tính tham khảo. Mỗi thai kỳ có nhịp độ riêng, hãy theo lịch khám và hướng dẫn của bác sĩ. Lựa chọn này không thay đổi hồ sơ của bạn.</p>
    </div>
  );
}
