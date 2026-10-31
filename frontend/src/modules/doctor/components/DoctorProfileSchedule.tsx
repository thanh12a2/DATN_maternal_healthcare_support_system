import { useEffect, useState, type FormEvent } from 'react';
import { CameraOutlined, CheckCircleOutlined, ClockCircleOutlined, FileTextOutlined, GlobalOutlined, MedicineBoxOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { Requester } from '../../../services/catalog';
import { getMyDoctor, listMyAvailability, updateMyDoctor, type DoctorInterval, type MyDoctor } from '../../../services/doctor';
import { getDoctorOccupancy } from '../../../services/appointment';
import '../../../styles/doctor-profile.css';

const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const moment = (value: string) => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
const ranks: Record<string, string> = { BASIC: 'Cơ bản', SPECIALIST_I: 'Bác sĩ CKI', SPECIALIST_II: 'Bác sĩ CKII', MASTER: 'Thạc sĩ', ASSOC_PROFESSOR: 'Phó giáo sư', PROFESSOR: 'Giáo sư', EXPERT: 'Chuyên gia', HEAD_DOCTOR: 'Bác sĩ trưởng khoa' };
const statuses: Record<string, string> = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động', DRAFT: 'Bản nháp' };
const initials = (name?: string) => (name || 'Bác sĩ').trim().split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi') || 'BS';
const dateText = (value?: string) => value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : 'Chưa cập nhật';
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
  const [feedbackError, setFeedbackError] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => { setImageFailed(false); }, [photoUrl]);

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
    const normalizedLanguages = languages.split(',').map((x) => x.trim()).filter(Boolean);
    if (normalizedLanguages.some((value) => value.length < 2 || value.length > 10) || new Set(normalizedLanguages.map((value) => value.toLocaleLowerCase('vi'))).size !== normalizedLanguages.length) {
      setFeedbackError(true); setFeedback('Mỗi ngôn ngữ cần từ 2 đến 10 ký tự và không được trùng nhau.'); return;
    }
    if (!photoUrl.trim() && doctor.profile?.photoUrl) { setFeedbackError(true); setFeedback('Để xóa ảnh hiện tại, vui lòng liên hệ quản trị viên.'); return; }
    if (photoUrl.trim()) {
      try { if (new URL(photoUrl.trim()).protocol !== 'https:') throw new Error(); }
      catch { setFeedbackError(true); setFeedback('Vui lòng nhập đường dẫn ảnh HTTPS hợp lệ.'); return; }
    }
    setSaving(true); setFeedback(''); setFeedbackError(false);
    try {
      const body = { biography, languages: normalizedLanguages, ...(photoUrl.trim() ? { photoUrl: photoUrl.trim() } : {}) };
      const updated = await updateMyDoctor(request, doctor, body); setDoctor(updated); setPhotoUrl(updated.profile?.photoUrl ?? ''); setBiography(updated.profile?.biography ?? ''); setLanguages((updated.profile?.languages ?? []).join(', ')); setEditingPhoto(false); setFeedback('Đã lưu thông tin hồ sơ.');
    } catch (e) { setFeedbackError(true); setFeedback(e instanceof Error ? e.message : 'Không thể lưu hồ sơ.'); }
    finally { setSaving(false); }
  };
  if (loading) return <div className="doctor-loading" role="status" aria-label="Đang tải dữ liệu"><i /><i /><i /></div>;
  if (error || !doctor) return <section className="doctor-error" role="alert"><strong>Không thể tải dữ liệu</strong><p>{error || 'Không tìm thấy hồ sơ bác sĩ.'}</p><button className="doctor-primary-button" onClick={() => setRevision((n) => n + 1)}>Thử lại</button></section>;
  if (section === 'schedule') return <><header className="doctor-heading"><div><span className="doctor-kicker">Khả dụng làm việc</span><h1>Lịch làm việc</h1><p>Khoảng thời gian theo lịch và điều chỉnh của bạn.</p></div></header><div className="doctor-filters"><label>Ngày bắt đầu<input type="date" value={date} onChange={(e) => setDate(e.target.value || localDate())} /></label><label>Phạm vi<select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={1}>Ngày</option><option value={7}>Tuần</option></select></label></div><section className="doctor-surface doctor-schedule"><h2>Lịch và thời gian bận</h2><p>Dữ liệu được đối chiếu với lịch hẹn và giữ chỗ tại thời điểm tải; tình trạng có thể thay đổi.</p>{intervals.length ? intervals.map((x, i) => <div className="doctor-schedule-row" key={`${x.startAt}-${i}`}><strong>{moment(x.startAt)} – {moment(x.endAt)}</strong><span>{x.busy ? 'Bận' : 'Khả dụng'} · {x.roomName || x.roomCode || 'Chưa có phòng'}</span></div>) : <p>Không có khoảng khả dụng trong thời gian đã chọn. Hãy chọn ngày khác hoặc liên hệ quản lý lịch.</p>}</section></>;
  const name = doctor.profile?.fullName || 'Bác sĩ';
  const specialtyNames = doctor.specialties?.map((item) => item.name).filter(Boolean) ?? [];
  return <div className="doctor-account">
    <header className="doctor-heading"><div><span className="doctor-kicker">Tài khoản chuyên môn</span><h1>Hồ sơ cá nhân</h1><p>Quản lý thông tin chuyên môn và giới thiệu của bạn.</p></div></header>
    <section className="doctor-account-hero doctor-surface">
      <div className="doctor-account-avatar" aria-label={'Ảnh đại diện ' + name}>
        {photoUrl && !imageFailed ? <img src={photoUrl} alt={'Ảnh đại diện của ' + name} onError={() => setImageFailed(true)} /> : <span aria-hidden="true">{initials(name)}</span>}
      </div>
      <div className="doctor-account-identity">
        <span className="doctor-account-overline">HỒ SƠ BÁC SĨ</span><h2>{name}</h2>
        <p>{doctor.profile?.professionalTitle || 'Chưa cập nhật chức danh'} <span aria-hidden="true">·</span> {specialtyNames.join(', ') || 'Chưa cập nhật chuyên khoa'}</p>
        <div className="doctor-account-badges"><span className={'doctor-account-status status-' + doctor.status.toLowerCase()}><i />{statuses[doctor.status] || doctor.status || 'Chưa cập nhật'}</span>{doctor.consultationRank && <span className="doctor-account-rank">Hạng tư vấn: {ranks[doctor.consultationRank] || doctor.consultationRank}</span>}</div>
      </div>
      <button type="button" className="doctor-account-photo-button" onClick={() => setEditingPhoto(true)}><CameraOutlined /> Đổi ảnh đại diện</button>
    </section>
    <div className="doctor-account-grid">
      <aside className="doctor-account-sidebar">
        <section className="doctor-account-card doctor-surface">
          <div className="doctor-account-card-heading"><div><span className="doctor-account-overline">HỒ SƠ CHUYÊN MÔN</span><h3>Thông tin bác sĩ</h3></div><SafetyCertificateOutlined /></div>
          <dl className="doctor-account-facts">
            <div><dt>Số chứng chỉ hành nghề</dt><dd>{doctor.licenseNumber || 'Chưa cập nhật'}</dd></div>
            <div><dt>Chức danh</dt><dd>{doctor.profile?.professionalTitle || 'Chưa cập nhật'}</dd></div>
            <div><dt>Bắt đầu hành nghề</dt><dd>{doctor.profile?.practiceStartYear || 'Chưa cập nhật'}</dd></div>
            <div><dt>Phòng khám</dt><dd>{doctor.roomName ? doctor.roomName + (doctor.roomCode ? ' · ' + doctor.roomCode : '') : doctor.roomCode || 'Chưa cập nhật'}</dd></div>
            <div><dt>Ngày tạo hồ sơ</dt><dd>{dateText(doctor.createdAt)}</dd></div>
            <div><dt>Cập nhật gần nhất</dt><dd>{dateText(doctor.updatedAt)}</dd></div>
          </dl>
        </section>
        <section className="doctor-account-card doctor-surface"><div className="doctor-account-card-heading"><div><span className="doctor-account-overline">LĨNH VỰC</span><h3>Chuyên khoa</h3></div><MedicineBoxOutlined /></div>
          {doctor.specialties?.length ? <div className="doctor-account-specialties">{doctor.specialties.map((item, index) => <span key={item.name + index}>{item.name}{item.isPrimary && <small>Chính</small>}</span>)}</div> : <p className="doctor-account-empty">Chưa có chuyên khoa được phân công.</p>}
        </section>
      </aside>
      <form onSubmit={save} className="doctor-account-editor doctor-surface">
        <div className="doctor-account-editor-head"><div><span className="doctor-account-overline">THÔNG TIN CÁ NHÂN</span><h3>Giới thiệu chuyên môn</h3><p>Cập nhật thông tin giới thiệu và ngôn ngữ sử dụng trong hồ sơ.</p></div><FileTextOutlined /></div>
        <div className="doctor-account-editor-body">
          <label className="doctor-account-field"><span><FileTextOutlined /> Tiểu sử</span><textarea maxLength={2000} value={biography} onChange={(e) => setBiography(e.target.value)} placeholder="Giới thiệu về kinh nghiệm và lĩnh vực chuyên môn" rows={7} /><small>{biography.length}/2000 ký tự</small></label>
          <label className="doctor-account-field"><span><GlobalOutlined /> Ngôn ngữ sử dụng</span><input aria-label="Ngôn ngữ sử dụng" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Ví dụ: vi, en" /><small>Phân cách các ngôn ngữ bằng dấu phẩy; mỗi mục từ 2 đến 10 ký tự.</small></label>
          {editingPhoto && <div className="doctor-account-photo-editor"><label className="doctor-account-field"><span><CameraOutlined /> Ảnh đại diện</span><input aria-label="Ảnh đại diện" type="url" maxLength={2048} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." /><small>Nhập đường dẫn ảnh HTTPS để xem trước. Lưu thay đổi để cập nhật hồ sơ.</small></label>{imageFailed && photoUrl && <p className="doctor-account-photo-error">Không thể tải ảnh từ đường dẫn này. Vui lòng kiểm tra lại.</p>}<button type="button" className="doctor-account-link" onClick={() => { setPhotoUrl(doctor.profile?.photoUrl ?? ''); setEditingPhoto(false); }}>Hủy thay đổi ảnh</button></div>}
          <div className="doctor-account-note"><ClockCircleOutlined /><span>Tên, chức danh, chứng chỉ và chuyên khoa do quản trị viên hoặc người quản lý cập nhật. Để xóa ảnh hiện tại, vui lòng liên hệ quản trị viên.</span></div>
          {feedback && <div className={'doctor-account-feedback' + (feedbackError ? ' is-error' : '')} role={feedbackError ? 'alert' : 'status'}>{!feedbackError && <CheckCircleOutlined />}{feedback}</div>}
        </div>
        <div className="doctor-account-editor-footer"><span>Thông tin được lưu vào hồ sơ bác sĩ của bạn.</span><button className="doctor-primary-button" type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
      </form>
    </div>
  </div>;
}
