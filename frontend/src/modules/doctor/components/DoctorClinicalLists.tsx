import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../../app/navigation';
import { DoctorEncounterActions } from './DoctorEncounterActions';
import { DoctorClinicalResources } from './DoctorClinicalResources';
import { DoctorEncounterWorkspace } from './DoctorEncounterWorkspace';
import type { Requester } from '../../../services/catalog';
import { listAllDoctorAppointments, type Appointment } from '../../../services/appointment';
import { listAllDoctorEncounters, type Encounter } from '../../../services/clinical';

const dateText = (s?: string) => s ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(s)) : 'Chưa có thời gian';
const labels: Record<string, string> = { BOOKED: 'Đã đặt', CHECKED_IN: 'Đã check-in', IN_CLINICAL_CARE: 'Đang khám', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', NO_SHOW: 'Vắng mặt', REASSIGNMENT_REQUIRED: 'Cần phân công lại', DRAFT: 'Chờ bắt đầu', IN_PROGRESS: 'Đang khám', READY_FOR_REVIEW: 'Chờ duyệt', FINALIZED: 'Đã hoàn tất', AWAITING_RESULTS: 'Chờ kết quả' };
const status = (s?: string) => labels[s ?? ''] ?? s ?? 'Chưa cập nhật';

export function DoctorClinicalLists({ section, request }: { section: string; request: Requester }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState('');
  const [day, setDay] = useState('');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(() => section === 'encounters' ? window.sessionStorage.getItem('doctor-selected-encounter') ?? '' : '');
  const [tab, setTab] = useState('visit');
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (section !== 'encounters') return;
    const next = window.sessionStorage.getItem('doctor-selected-encounter');
    if (next) { setSelected(next); window.sessionStorage.removeItem('doctor-selected-encounter'); }
  }, [section]);

  useEffect(() => {
    let active = true; if (!hasLoaded.current) setLoading(true); setError('');
    void Promise.all([listAllDoctorAppointments(request), listAllDoctorEncounters(request)]).then(([a, e]) => {
      if (!active) return; hasLoaded.current = true; setAppointments(a); setEncounters(e); setLoading(false);
    }).catch((e: unknown) => { if (active) { setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu'); setLoading(false); } });
    return () => { active = false; };
  }, [request, reload]);
  const rows = useMemo(() => section === 'appointments' ? appointments : encounters, [section, appointments, encounters]);
  const appointmentFor = (row: Appointment | Encounter) => section === 'appointments' ? row as Appointment : appointments.find((a) => a.id === (row as Encounter).appointmentId);
  const visible = rows.filter((row) => {
    const a = appointmentFor(row); const state = section === 'appointments' ? (row as Appointment).status : String((row as Encounter).state ?? '');
    return (!search || `${a?.appointmentCode ?? ''} ${a?.patientName ?? ''}`.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))) && (!day || (a?.startAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(a.startAt)) === day : false)) && (!filter || filter === state);
  });
  const chosen = visible.find((row) => row.id === selected);
  if (loading) return <div className="doctor-loading" role="status" aria-label="Đang tải dữ liệu"><i /><i /><i /></div>;
  if (error) return <section className="doctor-error" role="alert"><strong>Không thể tải danh sách</strong><p>{error}</p><button className="doctor-primary-button" onClick={() => setReload((n) => n + 1)}>Thử lại</button></section>;
  if (section === 'encounters') return <DoctorEncounterWorkspace appointments={appointments} encounters={encounters} selected={selected} onSelect={setSelected} onReload={() => setReload((n) => n + 1)} request={request} />;
  return <><header className="doctor-heading"><div><span className="doctor-kicker">Không gian chuyên môn</span><h1>{section === 'appointments' ? 'Lịch khám' : 'Hồ sơ khám'}</h1><p>Danh sách thuộc phân công của bạn.</p></div></header><div className="doctor-filters"><label>Tìm bệnh nhân hoặc mã lịch hẹn<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên bệnh nhân hoặc mã lịch hẹn" /></label><label>Ngày khám<input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label><label>Trạng thái<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Tất cả</option>{[...new Set(rows.map((x) => String(section === 'appointments' ? (x as Appointment).status ?? '' : (x as Encounter).state ?? '')))].filter(Boolean).map((s) => <option key={s} value={s}>{status(s)}</option>)}</select></label></div><div className="doctor-list-layout"><section className="doctor-surface doctor-list">{visible.length ? visible.map((row, index) => { const a = appointmentFor(row); const state = section === 'appointments' ? (row as Appointment).status : String((row as Encounter).state ?? ''); return <button className={'doctor-list-row ' + (chosen === row ? 'is-selected' : '')} key={row.id ?? index} onClick={() => { setSelected(row.id ?? ''); setTab('visit'); }}><strong>{a?.patientName || 'Chưa có tên bệnh nhân'}</strong><span>{a?.appointmentCode || 'Hồ sơ khám'} · {dateText(a?.startAt)} · {a?.pricing?.serviceName || 'Chưa có tên dịch vụ'}</span><small>{status(state)} · {String(a?.roomName || a?.roomCode || 'Chưa có phòng')}</small></button>; }) : <div className="doctor-empty"><strong>Không có kết quả</strong><p>Thử đổi bộ lọc hoặc quay lại khi có lịch được phân công.</p></div>}</section><aside className="doctor-surface doctor-profile">{!chosen ? <div className="doctor-empty"><strong>Chọn một mục</strong><p>Chọn lịch khám hoặc hồ sơ để xem chi tiết.</p></div> : section === 'appointments' ? <><h2>{appointmentFor(chosen)?.patientName || 'Bệnh nhân'}</h2><p>{appointmentFor(chosen)?.appointmentCode || 'Lịch khám'}</p><p>{dateText(appointmentFor(chosen)?.startAt)} · {status((chosen as Appointment).status)}</p><p>{appointmentFor(chosen)?.pricing?.serviceName || 'Chưa có tên dịch vụ'}</p><p>Phòng: {String(appointmentFor(chosen)?.roomName || appointmentFor(chosen)?.roomCode || 'Chưa có phòng')}</p><button className="doctor-primary-button" disabled={!['CHECKED_IN', 'IN_CLINICAL_CARE'].includes(String((chosen as Appointment).status)) || !encounters.some((e) => e.appointmentId === chosen.id)} onClick={() => { const match = encounters.find((e) => e.appointmentId === chosen.id); if (match?.id) { window.sessionStorage.setItem('doctor-selected-encounter', match.id); setSelected(match.id); setFilter(''); setDay(''); setSearch(''); navigate('/workspace/doctor/encounters'); } }}>Mở encounter</button><p>{['CHECKED_IN', 'IN_CLINICAL_CARE'].includes(String((chosen as Appointment).status)) ? 'Nếu nút chưa khả dụng, hồ sơ chưa được phân công hoặc chưa được tạo.' : 'Lịch chưa check-in hoặc không ở trạng thái khám.'}</p></> : <><h2>Hồ sơ khám</h2><p>{appointmentFor(chosen)?.appointmentCode || 'Chưa có mã lịch hẹn'} · {status(String((chosen as Encounter).state ?? ''))}</p><div className="doctor-tabs">{[['visit','Thông tin'],['vitalSigns','Dấu hiệu sinh tồn'],['diagnoses','Chẩn đoán'],['notes','Ghi chú'],['prescriptions','Đơn thuốc'],['plans','Điều trị']].map(([id, title]) => <button key={id} className={tab === id ? 'is-selected' : ''} onClick={() => setTab(id)}>{title}</button>)}</div>{tab === 'visit' ? <p>{String((chosen as Encounter).chiefComplaint || 'Chưa có thông tin lý do khám.')}</p> : ['prescriptions', 'plans'].includes(tab) && chosen.id ? <DoctorClinicalResources request={request} encounterId={chosen.id} patientId={String((chosen as Encounter).patientId ?? '')} encounterState={String((chosen as Encounter).state ?? '')} kind={tab as 'prescriptions' | 'plans'} /> : <ClinicalValues value={(chosen as Encounter)[tab]} />}<DoctorEncounterActions key={chosen.id} encounter={chosen as Encounter} appointment={appointmentFor(chosen)} request={request} onSaved={() => setReload((n) => n + 1)} /></>}</aside></div></>;
}

function ClinicalValues({ value }: { value: unknown }) {
  if (!Array.isArray(value) || !value.length) return <p>Chưa có dữ liệu cho mục này.</p>;
  return <div>{value.map((item: Record<string, unknown>, index) => <p key={index}>{Object.entries(item).filter(([key, v]) => !/id|version|encounter|author|recordedBy/i.test(key) && v != null && typeof v !== 'object').map(([key, v]) => `${key}: ${String(v)}`).join(' · ')}</p>)}</div>;
}
