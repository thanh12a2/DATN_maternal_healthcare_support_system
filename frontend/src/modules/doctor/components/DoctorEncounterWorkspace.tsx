import { useState } from 'react';
import { CalendarOutlined, FileTextOutlined, MedicineBoxOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import type { Requester } from '../../../services/catalog';
import type { Appointment } from '../../../services/appointment';
import type { Encounter } from '../../../services/clinical';
import { DoctorEncounterActions } from './DoctorEncounterActions';
import { DoctorClinicalResources } from './DoctorClinicalResources';
import '../../../styles/doctor-encounters.css';

const stateLabels: Record<string, string> = { BOOKED: 'Đã đặt', CHECKED_IN: 'Đã check-in', IN_CLINICAL_CARE: 'Đang khám', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', NO_SHOW: 'Vắng mặt', REASSIGNMENT_REQUIRED: 'Cần phân công lại', DRAFT: 'Chờ bắt đầu', IN_PROGRESS: 'Đang khám', AWAITING_RESULTS: 'Chờ kết quả', READY_FOR_REVIEW: 'Chờ duyệt', FINALIZED: 'Đã hoàn tất' };
const stateLabel = (value: unknown) => stateLabels[String(value ?? '')] ?? String(value || 'Chưa cập nhật');
const dateTime = (value?: string) => value && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : 'Chưa có thời gian';
const tabs = [ ['visit', 'Tổng quan'], ['vitalSigns', 'Dấu hiệu sinh tồn'], ['diagnoses', 'Chẩn đoán'], ['notes', 'Ghi chú'], ['prescriptions', 'Đơn thuốc'], ['plans', 'Điều trị'] ] as const;
type Tab = typeof tabs[number][0];
type ClinicalRecord = Record<string, unknown>;
const entries = (value: unknown): ClinicalRecord[] => Array.isArray(value) ? value as ClinicalRecord[] : [];
const valueText = (value: unknown) => value === null || value === undefined || value === '' ? '—' : String(value);

export function DoctorEncounterWorkspace({ appointments, encounters, selected, onSelect, onReload, request }: { appointments: Appointment[]; encounters: Encounter[]; selected: string; onSelect: (id: string) => void; onReload: () => void; request: Requester }) {
  const [search, setSearch] = useState('');
  const [day, setDay] = useState('');
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState<Tab>('visit');
  const appointmentFor = (encounter: Encounter) => appointments.find((a) => a.id === encounter.appointmentId);
  const visible = encounters.filter((encounter) => {
    const appointment = appointmentFor(encounter);
    const searchable = `${appointment?.patientName ?? ''} ${appointment?.appointmentCode ?? ''}`.toLocaleLowerCase('vi');
    const date = appointment?.startAt && !Number.isNaN(Date.parse(appointment.startAt)) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(appointment.startAt)) : '';
    return searchable.includes(search.trim().toLocaleLowerCase('vi')) && (!day || date === day) && (!filter || encounter.state === filter);
  });
  const chosen = visible.find((item) => item.id === selected) ?? (selected ? undefined : visible[0]);
  const appointment = chosen ? appointmentFor(chosen) : undefined;
  const name = appointment?.patientName || 'Chưa có tên bệnh nhân';
  const vitals = entries(chosen?.vitalSigns), diagnoses = entries(chosen?.diagnoses), notes = entries(chosen?.notes);
  const title = tabs.find(([id]) => id === tab)?.[1] ?? 'Tổng quan';
  const select = (id: string) => { onSelect(id); setTab('visit'); };

  return <div className="encounter-workspace">
    <div className="encounter-page-heading"><div><span className="doctor-kicker">Không gian chuyên môn</span><h1>Hồ sơ khám</h1><p>Theo dõi và cập nhật các lượt khám được phân công.</p></div><div className="encounter-heading-summary"><span>Hồ sơ được giao</span><strong>{encounters.length}</strong></div></div>
    <div className="encounter-layout">
      <aside className="encounter-sidebar doctor-surface" aria-label="Danh sách hồ sơ khám">
        <div className="encounter-sidebar-head"><div><span className="encounter-overline">DANH SÁCH CỦA BẠN</span><h2>Lượt khám <span>{visible.length}</span></h2></div><FileTextOutlined aria-hidden="true" /></div>
        <div className="encounter-filters"><label className="encounter-search"><SearchOutlined aria-hidden="true" /><span className="encounter-sr-only">Tìm bệnh nhân hoặc mã lịch hẹn</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên hoặc mã lịch hẹn" /></label><div className="encounter-filter-row"><label><span>Ngày khám</span><input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label><label><span>Trạng thái</span><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Tất cả</option>{[...new Set(encounters.map((x) => String(x.state ?? '')))].filter(Boolean).map((s) => <option key={s} value={s}>{stateLabel(s)}</option>)}</select></label></div></div>
        <div className="encounter-list">{visible.length ? visible.map((item, index) => { const a = appointmentFor(item); const isSelected = chosen === item; return <button className={'encounter-list-item' + (isSelected ? ' is-selected' : '')} type="button" aria-pressed={isSelected} key={item.id ?? index} onClick={() => select(item.id ?? '')}><span className="encounter-list-avatar"><UserOutlined /></span><span className="encounter-list-copy"><span className="encounter-list-name">{a?.patientName || 'Chưa có tên bệnh nhân'}</span><span>{a?.appointmentCode || 'Chưa có mã lịch hẹn'}</span><small><CalendarOutlined /> {dateTime(a?.startAt)}</small></span><span className={'encounter-state state-' + String(item.state ?? '').toLowerCase()}>{stateLabel(item.state)}</span></button>; }) : <div className="encounter-list-empty"><FileTextOutlined /><strong>Không tìm thấy hồ sơ</strong><p>Thử thay đổi bộ lọc hoặc quay lại khi có lượt khám được phân công.</p></div>}</div>
      </aside>
      <main className="encounter-detail doctor-surface" aria-label="Chi tiết hồ sơ khám">{!chosen ? <div className="encounter-empty"><span><MedicineBoxOutlined /></span><h2>{visible.length ? 'Chọn một hồ sơ khám' : 'Chưa có hồ sơ phù hợp'}</h2><p>Chọn lượt khám từ danh sách để xem thông tin và cập nhật hồ sơ.</p></div> : <>
        <div className="encounter-patient-header"><div className="encounter-patient-avatar"><UserOutlined /></div><div className="encounter-patient-title"><span className="encounter-overline">HỒ SƠ KHÁM</span><h2>{name}</h2><p>{appointment?.appointmentCode || 'Chưa có mã lịch hẹn'} <span>•</span> {dateTime(appointment?.startAt)}</p></div><span className={'encounter-state encounter-header-state state-' + String(chosen.state ?? '').toLowerCase()}>{stateLabel(chosen.state)}</span></div>
        <div className="encounter-context"><div><span>Dịch vụ khám</span><strong>{appointment?.pricing?.serviceName || 'Chưa có thông tin dịch vụ'}</strong></div><div><span>Phòng khám</span><strong>{String(appointment?.roomName || appointment?.roomCode || 'Chưa có thông tin phòng')}</strong></div><div><span>Trạng thái lịch</span><strong>{appointment?.status ? stateLabel(appointment.status) : 'Chưa có lịch liên kết'}</strong></div></div>
        <div className="encounter-stepbar"><DoctorEncounterActions key={`${chosen.id}-toolbar`} scope="toolbar" encounter={chosen} appointment={appointment} request={request} onSaved={onReload} /></div>
        <nav className="encounter-tabs" aria-label="Các mục hồ sơ khám">{tabs.map(([id, label]) => <button key={id} type="button" className={tab === id ? 'is-active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>)}</nav>
        <div className="encounter-content">{tab !== 'prescriptions' && tab !== 'plans' && <div className="encounter-content-heading"><div><span className="encounter-overline">CHI TIẾT LƯỢT KHÁM</span><h3>{title}</h3></div><span className="encounter-content-caption">{appointment?.appointmentCode || 'Hồ sơ được phân công'}</span></div>}
          {tab === 'visit' && <div className="encounter-overview"><section className="encounter-card encounter-complaint"><span>Lý do khám</span><strong>{valueText(chosen.chiefComplaint) === '—' ? 'Chưa có thông tin lý do khám' : valueText(chosen.chiefComplaint)}</strong>{Boolean(chosen.clinicalSummary) && <p>{String(chosen.clinicalSummary)}</p>}</section><div className="encounter-overview-grid"><OverviewCard label="Dấu hiệu sinh tồn" count={vitals.length} onClick={() => setTab('vitalSigns')} /><OverviewCard label="Chẩn đoán" count={diagnoses.length} onClick={() => setTab('diagnoses')} /><OverviewCard label="Ghi chú" count={notes.length} onClick={() => setTab('notes')} /></div><p className="encounter-overview-hint">Chọn từng mục để xem chi tiết hoặc cập nhật trong quá trình khám.</p></div>}
          {(tab === 'vitalSigns' || tab === 'diagnoses' || tab === 'notes') && <><ClinicalEntries kind={tab} value={chosen[tab]} /><div className="encounter-entry-form"><DoctorEncounterActions key={`${chosen.id}-${tab}`} scope={tab} encounter={chosen} appointment={appointment} request={request} onSaved={onReload} />{chosen.state !== 'IN_PROGRESS' && <p className="encounter-form-hint">{chosen.state === 'DRAFT' ? 'Bắt đầu khám để cập nhật nội dung này.' : 'Trạng thái hồ sơ hiện tại không cho phép cập nhật nội dung này.'}</p>}</div></>}
          {(tab === 'prescriptions' || tab === 'plans') && chosen.id && <DoctorClinicalResources request={request} encounterId={chosen.id} patientId={String(chosen.patientId ?? '')} encounterState={String(chosen.state ?? '')} kind={tab} />}
        </div>
      </>}</main>
    </div>
  </div>;
}

function OverviewCard({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return <button type="button" className="encounter-card encounter-overview-card" onClick={onClick}><span>{label}</span><strong>{count}</strong><small>{count ? 'Xem thông tin đã ghi' : 'Chưa có dữ liệu'} <b aria-hidden="true">→</b></small></button>;
}

function ClinicalEntries({ kind, value }: { kind: 'vitalSigns' | 'diagnoses' | 'notes'; value: unknown }) {
  const rows = entries(value);
  if (!rows.length) return <div className="encounter-record-empty"><FileTextOutlined /><div><strong>Chưa có dữ liệu</strong><p>Thông tin được ghi sẽ hiển thị tại đây.</p></div></div>;
  return <div className="encounter-records">{rows.map((item, index) => <article className="encounter-record" key={String(item.id ?? index)}><div className="encounter-record-header"><strong>{kind === 'vitalSigns' ? 'Lần ghi nhận' : kind === 'diagnoses' ? valueText(item.description || 'Chẩn đoán') : 'Ghi chú khám'}</strong><span>{dateTime(String(item.recordedAt ?? item.createdAt ?? ''))}</span></div>{kind === 'vitalSigns' ? <div className="encounter-vitals">{([['Huyết áp', item.systolic != null || item.diastolic != null ? `${valueText(item.systolic)}/${valueText(item.diastolic)} mmHg` : null], ['Nhịp tim', item.heartRate != null ? `${item.heartRate} lần/phút` : null], ['Nhiệt độ', item.temperature != null ? `${item.temperature} °C` : null], ['Cân nặng', item.weight != null ? `${item.weight} kg` : null]] as const).map(([label, value]) => <div key={label}><span>{label}</span><strong>{valueText(value)}</strong></div>)}</div> : kind === 'diagnoses' ? <p>Mã chẩn đoán: {valueText(item.code)}</p> : <p className="encounter-note-text">{valueText(item.content ?? item.text)}</p>}</article>)}</div>;
}
