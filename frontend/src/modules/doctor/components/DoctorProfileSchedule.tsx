import { useEffect, useState, type FormEvent } from 'react';
import type { Requester } from '../../../services/catalog';
import { getMyDoctor, listMyAvailability, updateMyDoctor, type DoctorInterval, type MyDoctor } from '../../../services/doctor';
import { getDoctorOccupancy } from '../../../services/appointment';

const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const moment = (value: string) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
type WorkInterval = DoctorInterval & { busy: boolean };
export function splitOccupancy(intervals: DoctorInterval[], occupied: { startAt: string; endAt: string }[]): WorkInterval[] {
  return intervals.flatMap((interval) => {
    const start = new Date(interval.startAt).getTime(), end = new Date(interval.endAt).getTime();
    const blocks = occupied.map((x) => [Math.max(start, new Date(x.startAt).getTime()), Math.min(end, new Date(x.endAt).getTime())]).filter(([a, b]) => a < b).sort((a, b) => a[0] - b[0]);
    const merged: number[][] = [];
    for (const [a, b] of blocks) { const last = merged.at(-1); if (last && a <= last[1]) last[1] = Math.max(last[1], b); else merged.push([a, b]); }
    const rows: WorkInterval[] = []; let cursor = start;
    const add = (a: number, b: number, busy: boolean) => { if (a < b) rows.push({ ...interval, startAt: new Date(a).toISOString(), endAt: new Date(b).toISOString(), busy }); };
    for (const [a, b] of merged) { add(cursor, a, false); add(a, b, true); cursor = b; }
    add(cursor, end, false); return rows;
  });
}

export function DoctorProfileSchedule({ section, request }: { section: string; request: Requester }) {
  const [doctor, setDoctor] = useState<MyDoctor | null>(null);
  const [intervals, setIntervals] = useState<WorkInterval[]>([]);
  const [date, setDate] = useState(localDate);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [biography, setBiography] = useState('');
  const [languages, setLanguages] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void (async () => {
      const profile = await getMyDoctor(request);
      const start = new Date(`${date}T00:00:00+07:00`);
      const end = new Date(start.getTime() + days * 86400000);
      const [availability, occupancy] = section === 'schedule' ? await Promise.all([listMyAvailability(request, profile.id, start.toISOString(), end.toISOString()), getDoctorOccupancy(request, start.toISOString(), end.toISOString())]) : [null, []];
      if (!active) return;
      setDoctor(profile); setBiography(profile.profile?.biography ?? ''); setLanguages((profile.profile?.languages ?? []).join(', ')); setPhotoUrl(profile.profile?.photoUrl ?? '');
      setIntervals(availability ? splitOccupancy(availability.intervals, occupancy) : []); setLoading(false);
    })().catch((e: unknown) => { if (active) { setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu.'); setLoading(false); } });
    return () => { active = false; };
  }, [request, section, date, days, revision]);

  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!doctor || saving) return;
    setSaving(true); setFeedback('');
    try {
      const body = { biography, languages: languages.split(',').map((x) => x.trim()).filter(Boolean), ...(photoUrl.trim() ? { photoUrl: photoUrl.trim() } : {}) };
      const updated = await updateMyDoctor(request, doctor, body); setDoctor(updated); setFeedback('Đã lưu hồ sơ.');
    } catch (e) { setFeedback(e instanceof Error ? e.message : 'Không thể lưu hồ sơ.'); }
    finally { setSaving(false); }
  };
  if (loading) return <div className="doctor-loading" role="status" aria-label="Đang tải dữ liệu"><i /><i /><i /></div>;
  if (error || !doctor) return <section className="doctor-error" role="alert"><strong>Không thể tải dữ liệu</strong><p>{error || 'Không tìm thấy hồ sơ bác sĩ.'}</p><button className="doctor-primary-button" onClick={() => setRevision((n) => n + 1)}>Thử lại</button></section>;
  if (section === 'schedule') return <><header className="doctor-heading"><div><span className="doctor-kicker">Khả dụng làm việc</span><h1>Lịch làm việc</h1><p>Khoảng thời gian theo lịch và điều chỉnh của bạn.</p></div></header><div className="doctor-filters"><label>Ngày bắt đầu<input type="date" value={date} onChange={(e) => setDate(e.target.value || localDate())} /></label><label>Phạm vi<select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={1}>Ngày</option><option value={7}>Tuần</option></select></label></div><section className="doctor-surface doctor-schedule"><h2>Lịch và thời gian bận</h2><p>Dữ liệu được đối chiếu với lịch hẹn và giữ chỗ tại thời điểm tải; tình trạng có thể thay đổi.</p>{intervals.length ? intervals.map((x, i) => <div className="doctor-schedule-row" key={`${x.startAt}-${i}`}><strong>{moment(x.startAt)} – {moment(x.endAt)}</strong><span>{x.busy ? 'Bận' : 'Khả dụng'} · {x.roomName || x.roomCode || 'Chưa có phòng'}</span></div>) : <p>Không có khoảng khả dụng trong thời gian đã chọn. Hãy chọn ngày khác hoặc liên hệ quản lý lịch.</p>}</section></>;
  return <><header className="doctor-heading"><div><span className="doctor-kicker">Tài khoản chuyên môn</span><h1>Hồ sơ cá nhân</h1><p>Thông tin chuyên môn và các trường bạn được phép cập nhật.</p></div></header><section className="doctor-surface doctor-profile"><h2>{doctor.profile?.fullName || 'Bác sĩ'}</h2><p>{doctor.profile?.professionalTitle || 'Chưa có chức danh'} · {doctor.specialties?.map((x) => x.name).join(', ') || 'Chưa có chuyên khoa'}</p><p>Hạng tư vấn: {doctor.consultationRank || 'Chưa cập nhật'} · Trạng thái: {doctor.status}</p><form onSubmit={save} className="doctor-profile-form"><label>Tiểu sử<textarea maxLength={2000} value={biography} onChange={(e) => setBiography(e.target.value)} /></label><label>Ngôn ngữ (ngăn cách bằng dấu phẩy)<input value={languages} onChange={(e) => setLanguages(e.target.value)} /></label><label>Đường dẫn ảnh HTTPS<input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} /></label><p>Tên, chức danh và chuyên khoa do quản trị viên cập nhật. Để xóa ảnh, vui lòng liên hệ quản trị viên.</p>{feedback && <p role="status">{feedback}</p>}<button className="doctor-primary-button" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button></form></section></>;
}
