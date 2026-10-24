import { useEffect, useMemo, useState } from 'react';
import type { Requester } from '../../services/catalog';
import { ApiError } from '../../services/api';
import { listEncounters, listTreatmentPlans, type Encounter, type TreatmentPlan } from '../../services/clinical';
import { listConsultations, type Consultation } from '../../services/operations';
import '../../styles/doctor-content.css';

type DataState = 'loading' | 'ready' | 'error';
const short = (value?: string) => value ? value.slice(0, 8).toUpperCase() : '—';
const time = (value?: string) => value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—';
const labelStatus = (value?: string) => ({ ACTIVE: 'Đang xử lý', OPEN: 'Đang mở', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn tất', FINALIZED: 'Đã khóa' }[value ?? ''] ?? value ?? 'Chờ cập nhật');

export function DoctorWorkspace({ section, request, email }: { section: string; request: Requester; email?: string }) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [state, setState] = useState<DataState>('loading');
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    Promise.all([listEncounters(request), listConsultations(request), listTreatmentPlans(request)])
      .then(([nextEncounters, nextConsultations, nextPlans]) => { if (live) { setEncounters(nextEncounters); setConsultations(nextConsultations); setPlans(nextPlans); setState('ready'); } })
      .catch(reason => { if (live) { setError(reason instanceof ApiError ? reason.message : 'Không thể tải dữ liệu bác sĩ.'); setState('error'); } });
    return () => { live = false; };
  }, [request]);
  const pending = useMemo(() => encounters.filter(item => !['COMPLETED', 'FINALIZED'].includes(String(item.status))).length, [encounters]);
  const heading: Record<string, [string, string]> = {
    overview: ['Tổng quan', 'Theo dõi lịch khám, encounter và công việc được phân công.'],
    appointments: ['Lịch khám', 'Các lịch khám được backend cấp quyền cho tài khoản hiện tại.'],
    patients: ['Bệnh nhân', 'Danh sách bệnh nhân chỉ hiển thị qua encounter được phân công.'],
    encounters: ['Encounter', 'Theo dõi và cập nhật hồ sơ khám theo state được phép.'],
    schedule: ['Lịch làm việc', 'Availability chỉ hiển thị khi Doctor Service cấp dữ liệu cho tài khoản.'],
    consultations: ['Tư vấn', 'Các cuộc hội thoại được phân công cho bác sĩ.'],
    profile: ['Hồ sơ cá nhân', 'Thông tin tài khoản và chuyên môn được backend cấp quyền.'],
  };
  const [title, copy] = heading[section] ?? heading.overview;
  if (state === 'loading') return <div className="doctor-loading" aria-busy="true"><i /><i /><i /><i /></div>;
  if (state === 'error') return <section className="doctor-empty" role="alert"><strong>Không thể tải dữ liệu</strong><p>{error}</p></section>;
  if (section === 'overview') return <DoctorOverview encounters={encounters} consultations={consultations} plans={plans} pending={pending} />;
  if (section === 'schedule') return <DoctorSchedule />;
  if (section === 'profile') return <DoctorProfile email={email} />;
  if (section === 'consultations') return <DoctorConsultations items={consultations} />;
  return <DoctorTable title={title} copy={copy} items={encounters} section={section} />;
}

function DoctorOverview({ encounters, consultations, plans, pending }: { encounters: Encounter[]; consultations: Consultation[]; plans: TreatmentPlan[]; pending: number }) {
  return <>
    <header className="doctor-heading"><div><span className="doctor-kicker">Hồ sơ công việc</span><h1>Tổng quan</h1></div><span className="doctor-heading-meta">07:30 — 17:30</span></header>
    <section className="doctor-kpi-grid"><article className="doctor-kpi doctor-kpi-primary"><span>Lịch khám hôm nay</span><strong>{String(encounters.length).padStart(2, '0')}</strong><small>Encounter được cấp quyền</small></article><article className="doctor-kpi"><span>Bệnh nhân đang chờ</span><strong>{String(pending).padStart(2, '0')}</strong><small>Chưa hoàn tất hồ sơ</small></article><article className="doctor-kpi"><span>Encounter chưa hoàn tất</span><strong>{String(pending).padStart(2, '0')}</strong><small>Cần cập nhật hồ sơ</small></article><article className="doctor-kpi"><span>Tư vấn chưa đọc</span><strong>{String(consultations.length).padStart(2, '0')}</strong><small>Trao đổi được phân công</small></article></section>
    <section className="doctor-overview-grid"><article className="doctor-surface doctor-today"><header className="doctor-panel-head"><div><span className="doctor-kicker">Lịch trong ngày</span><h2>Hôm nay</h2></div><span className="doctor-round-count">{encounters.length}</span></header><div className="doctor-timeline">{encounters.length ? encounters.slice(0, 6).map((item, index) => <div className="doctor-timeline-row" key={item.id ?? index}><span className="doctor-time">{time(item.startedAt)}</span><i className="doctor-time-line" /><span><strong>Bệnh nhân được phân công</strong><small>Encounter {short(item.id)} · {labelStatus(item.status)}</small></span><span className="doctor-state">{labelStatus(item.status)}</span></div>) : <p className="doctor-panel-empty">Chưa có lịch/encounter được backend cấp quyền.</p>}</div></article><aside className="doctor-surface doctor-work"><header className="doctor-panel-head"><div><span className="doctor-kicker">Đang xử lý</span><h2>{String(pending).padStart(2, '0')} hồ sơ</h2></div></header>{encounters.slice(0, 2).map((item, index) => <button className="doctor-work-row" type="button" key={item.id ?? index}><span><strong>Hồ sơ được phân công</strong><small>Encounter {short(item.id)}</small></span><span>›</span></button>)}{plans.slice(0, 1).map((plan, index) => <button className="doctor-work-row" type="button" key={plan.id ?? index}><span><strong>{plan.title ?? 'Kế hoạch điều trị'}</strong><small>{labelStatus(plan.status)}</small></span><span>›</span></button>)}</aside></section>
  </>;
}

function DoctorTable({ title, copy, items, section }: { title: string; copy: string; items: Encounter[]; section: string }) {
  return <><header className="doctor-heading"><div><span className="doctor-kicker">Doctor workspace</span><h1>{title}</h1><p>{copy}</p></div></header><section className="doctor-surface doctor-table-surface"><div className="doctor-filter-bar"><label><span>Tìm kiếm</span><input placeholder="Tìm trong dữ liệu được phân công" /></label><label><span>Trạng thái</span><select><option>Tất cả</option><option>Đang xử lý</option><option>Hoàn tất</option></select></label></div><div className="doctor-table"><div className="doctor-table-row doctor-table-header"><span>Thời gian</span><span>{section === 'patients' ? 'Bệnh nhân' : 'Encounter'}</span><span>Trạng thái</span><span>Thao tác</span></div>{items.length ? items.map((item, index) => <button className="doctor-table-row" key={item.id ?? index} type="button"><span className="doctor-time">{time(item.startedAt)}</span><span><strong>{section === 'patients' ? 'Bệnh nhân được phân công' : 'Encounter ' + short(item.id)}</strong><small>Appointment {short(item.appointmentId)}</small></span><span>{labelStatus(item.status)}</span><span>›</span></button>) : <p className="doctor-panel-empty">Chưa có dữ liệu được phân công.</p>}</div></section></>;
}
function DoctorSchedule() { return <><header className="doctor-heading"><div><span className="doctor-kicker">Availability</span><h1>Lịch làm việc</h1><p>Hiển thị availability khi Doctor Service cấp dữ liệu theo tài khoản.</p></div></header><section className="doctor-surface doctor-schedule-surface"><div className="doctor-schedule-empty"><strong>Chưa có availability được cấp cho màn hình này</strong><span>Không tạo lịch giả; hãy cập nhật contract Doctor profile/availability để liên kết lịch cá nhân.</span></div></section></>; }
function DoctorProfile({ email }: { email?: string }) { return <><header className="doctor-heading"><div><span className="doctor-kicker">Tài khoản</span><h1>Hồ sơ cá nhân</h1></div></header><section className="doctor-surface doctor-profile-card"><div className="doctor-profile-top"><span className="doctor-profile-avatar">BS</span><div><h2>{email?.split('@')[0] ?? 'Bác sĩ'}</h2><p>{email ?? 'Tài khoản Doctor'}</p></div><span className="doctor-active-state">Đang hoạt động</span></div><dl className="doctor-profile-list"><div><dt>Chức danh</dt><dd>Theo Doctor Service</dd></div><div><dt>Chuyên khoa</dt><dd>Theo Doctor Service</dd></div><div><dt>Hạng tư vấn</dt><dd>Theo Doctor Service</dd></div></dl></section></>; }
function DoctorConsultations({ items }: { items: Consultation[] }) { return <><header className="doctor-heading"><div><span className="doctor-kicker">Tư vấn</span><h1>Tư vấn</h1><p>Các cuộc hội thoại được backend cấp quyền.</p></div></header><section className="doctor-surface doctor-conversation-list">{items.length ? items.map((item, index) => <button className="doctor-conversation" key={item.id ?? index}><span className="doctor-conversation-avatar">BN</span><span><strong>{item.subject ?? 'Cuộc hội thoại'}</strong><small>{labelStatus(item.status)}</small></span><b>01</b></button>) : <p className="doctor-panel-empty">Chưa có cuộc hội thoại được phân công.</p>}</section></>; }
