import { FormEvent, useEffect, useMemo, useState } from 'react';
import { navigate } from '../../../app/navigation';
import { ApiError } from '../../../services/api';
import {
  listConsultationMessages,
  listAllDoctorConsultations,
  markConsultationRead,
  sendConsultationMessage,
  type Consultation,
  type ConsultationMessage,
} from '../../../services/operations';
import type { Requester } from '../../../services/catalog';
import '../../../styles/doctor-content.css';
import { DoctorProfileSchedule } from './DoctorProfileSchedule';
import { DoctorClinicalLists } from './DoctorClinicalLists';
import { DoctorPatients } from './DoctorPatients';
import { listAllDoctorAppointments, type Appointment } from '../../../services/appointment';
import { listAllDoctorEncounters, type Encounter } from '../../../services/clinical';

type DataState = 'loading' | 'ready' | 'error';

const copy: Record<string, { eyebrow: string; title: string; description: string }> = {
  overview: { eyebrow: 'Không gian chuyên môn', title: 'Tổng quan', description: 'Theo dõi các công việc được phân quyền cho tài khoản của bạn.' },
  appointments: { eyebrow: 'Lịch khám', title: 'Lịch khám', description: 'Các lịch đã được phân công cho bác sĩ.' },
  patients: { eyebrow: 'Bệnh nhân', title: 'Bệnh nhân phân công', description: 'Chỉ hiển thị bệnh nhân thuộc lịch khám hoặc encounter của bạn.' },
  encounters: { eyebrow: 'Hồ sơ khám', title: 'Encounter', description: 'Theo dõi và cập nhật hồ sơ khám theo đúng trạng thái nghiệp vụ.' },
  schedule: { eyebrow: 'Khả dụng làm việc', title: 'Lịch làm việc', description: 'Các ca làm việc và khoảng thời gian khả dụng của bạn.' },
  consultations: { eyebrow: 'Trao đổi trực tuyến', title: 'Tư vấn', description: 'Xử lý các cuộc hội thoại được giao cho bạn.' },
  profile: { eyebrow: 'Tài khoản chuyên môn', title: 'Hồ sơ cá nhân', description: 'Thông tin hồ sơ bác sĩ được Doctor Service cấp quyền.' },
};

const waitingStates = new Set(['OPEN', 'ASSIGNED']);

function displayStatus(value?: string) {
  const labels: Record<string, string> = {
    OPEN: 'Chờ tiếp nhận',
    ASSIGNED: 'Đã phân công',
    ANSWERED: 'Đã phản hồi',
    CLOSED: 'Đã đóng',
  };
  return labels[value ?? ''] ?? value ?? 'Chờ cập nhật';
}

function formatMoment(value?: string | null) {
  if (!value) return 'Chưa có hoạt động';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Chưa có hoạt động'
    : new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(date);
}

function initials(value?: string) {
  return (value ?? 'BS').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'BS';
}

function messageFor(error: unknown) {
  if (error instanceof ApiError && error.statusCode === 403) return 'Tài khoản không có quyền xem dữ liệu này.';
  return error instanceof Error ? error.message : 'Không thể tải dữ liệu. Vui lòng thử lại.';
}

export function DoctorWorkspace({ section, request, userId }: { section: string; request: Requester; userId?: string }) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [state, setState] = useState<DataState>('loading');
  const [error, setError] = useState('');

  const load = async () => {
    setState('loading');
    setError('');
    try {
      const rows = await listAllDoctorConsultations(request);
      setConsultations(rows);
      setState('ready');
    } catch (reason) {
      setError(messageFor(reason));
      setState('error');
    }
  };

  useEffect(() => { if (section === 'overview' || section === 'consultations') void load(); }, [request, section]);

  const assigned = useMemo(() => userId ? consultations : [], [consultations, userId]);
  const needsResponse = useMemo(() => assigned.filter((item) => waitingStates.has(String(item.status))).length, [assigned]);

  if (section === 'profile' || section === 'schedule') return <DoctorProfileSchedule section={section} request={request} />;
  if (section === 'appointments' || section === 'encounters') return <DoctorClinicalLists section={section} request={request} />;
  if (section === 'patients') return <DoctorPatients request={request} />;
  if (section !== 'overview' && section !== 'consultations') return <ContractPending section={section} />;

  if (state === 'loading') return <DoctorLoading />;
  if (state === 'error') return <DoctorError message={error} onRetry={() => void load()} />;

  if (section === 'overview') return <DoctorOverview consultations={assigned} needsResponse={needsResponse} request={request} />;
  return <ConsultationWorkspace items={assigned} request={request} userId={userId} onRead={async () => { setConsultations(await listAllDoctorConsultations(request)); }} />;
}

function DoctorOverview({ consultations, needsResponse, request }: { consultations: Consultation[]; needsResponse: number; request: Requester }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void Promise.all([listAllDoctorAppointments(request), listAllDoctorEncounters(request)]).then(([a, e]) => { if (active) { setAppointments(a); setEncounters(e); setLoading(false); } }).catch((reason: unknown) => { if (active) { setError(messageFor(reason)); setLoading(false); } });
    return () => { active = false; };
  }, [request, revision]);
  if (loading) return <DoctorLoading />;
  if (error) return <DoctorError message={error} onRetry={() => setRevision((n) => n + 1)} />;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const todaysAppointments = appointments.filter((a) => a.startAt && new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(a.startAt)) === today);
  const latest = consultations.slice(0, 4);
  return <>
    <PageHeading section="overview" aside="Dữ liệu theo quyền truy cập" />
    <section className="doctor-kpi-grid" aria-label="Tổng quan công việc">
      <Metric label="Lịch khám hôm nay" value={todaysAppointments.length} hint="Lịch được phân công trong ngày" emphasis />
      <Metric label="Bệnh nhân đang chờ" value={todaysAppointments.filter((a) => a.status === 'CHECKED_IN').length} hint="Lịch đã check-in, chưa bắt đầu khám" />
      <Metric label="Encounter cần hoàn tất" value={encounters.filter((e) => ['DRAFT', 'IN_PROGRESS', 'AWAITING_RESULTS', 'READY_FOR_REVIEW'].includes(String(e.state))).length} hint="Hồ sơ được giao chưa hoàn tất" />
      <Metric label="Tư vấn chưa đọc" value={consultations.filter((item) => (item.unreadCount ?? 0) > 0).length} hint="Số cuộc tư vấn có tin chưa đọc" />
    </section>
    <section className="doctor-overview-grid">
      <article className="doctor-surface">
        <div className="doctor-panel-head">
          <div><span className="doctor-kicker">{needsResponse} cuộc tư vấn cần xử lý</span><h2>Hộp thư tư vấn</h2></div>
          <button className="doctor-text-button" type="button" onClick={() => navigate('/workspace/doctor/consultations')}>Xem tất cả</button>
        </div>
        {latest.length ? <div className="doctor-activity-list">{latest.map((item, index) => <button className="doctor-activity-row" type="button" key={item.id ?? index} onClick={() => navigate('/workspace/doctor/consultations')}>
          <span className="doctor-activity-avatar">{initials(item.subject || 'BN')}</span>
          <span><strong>{item.subject || 'Cuộc tư vấn của bệnh nhân'}</strong><small>{displayStatus(item.status)} · {formatMoment(item.lastMessageAt ?? item.updatedAt)}</small></span>
          <span className={'doctor-status doctor-status-' + String(item.status ?? '').toLowerCase()}>{displayStatus(item.status)}</span>
        </button>)}</div> : <EmptyState title="Chưa có cuộc tư vấn" body="Khi có hội thoại được phân công, chúng sẽ xuất hiện tại đây." />}
      </article>
      <aside className="doctor-surface doctor-guidance-card">
        <span className="doctor-kicker">Truy cập nhanh</span><h2>Ca làm việc của bạn</h2>
        {todaysAppointments.length ? todaysAppointments.map((a) => <div className="doctor-schedule-row" key={a.id}><strong>{formatMoment(a.startAt)}</strong><span>{a.patientName || 'Bệnh nhân'} · {a.pricing?.serviceName || a.appointmentCode}</span></div>) : <p className="doctor-shortcut-note">Chưa có lịch khám được phân công hôm nay.</p>}
        <div className="doctor-shortcuts"><button className="doctor-primary-button" type="button" onClick={() => navigate('/workspace/doctor/appointments')}>Lịch khám</button><button className="doctor-secondary-button" type="button" onClick={() => navigate('/workspace/doctor/encounters')}>Hồ sơ khám</button></div>
      </aside>
    </section>
  </>;
}

function ConsultationWorkspace({ items, request, userId, onRead }: { items: Consultation[]; request: Requester; userId?: string; onRead: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(() => items[0]?.id);
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [messagesState, setMessagesState] = useState<DataState>('loading');
  const [messagesError, setMessagesError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [reloadMessages, setReloadMessages] = useState(0);
  const [sendError, setSendError] = useState('');
  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  useEffect(() => {
    if (!selected?.id) { setMessages([]); setMessagesState('ready'); return; }
    let alive = true;
    setMessagesState('loading');
    void listConsultationMessages(request, selected.id).then(async (rows) => {
      if (!alive) return;
      setMessages(rows);
      setMessagesState('ready');
      const lastSequence = Math.max(0, ...rows.map((message) => message.sequenceNo ?? 0));
      if (lastSequence && (selected.unreadCount ?? 0) > 0) {
        try { await markConsultationRead(request, selected.id!, lastSequence); if (alive) await onRead(); }
        catch (reason) { if (alive) setSendError(`Không cập nhật được trạng thái đã đọc: ${messageFor(reason)}`); }
      }
    }).catch((reason) => {
      if (!alive) return;
      setMessagesError(messageFor(reason));
      setMessagesState('error');
    });
    return () => { alive = false; };
  }, [request, selected?.id, reloadMessages]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!selected?.id || !body || sending || selected.status === 'CLOSED') return;
    setSending(true);
    setSendError('');
    try {
      await sendConsultationMessage(request, selected.id, { body });
      setDraft('');
      setReloadMessages((value) => value + 1);
    } catch (reason) {
      setSendError(`${messageFor(reason)} Hãy tải lại hội thoại để kiểm tra trước khi gửi lại.`);
    } finally { setSending(false); }
  };

  return <>
    <PageHeading section="consultations" aside={`${items.length} cuộc hội thoại`} />
    <section className="doctor-consultation-layout">
      <aside className="doctor-surface doctor-thread-list" aria-label="Danh sách tư vấn">
        <div className="doctor-panel-head"><div><span className="doctor-kicker">Hộp thư</span><h2>Cuộc trò chuyện</h2></div><span className="doctor-round-count">{items.length}</span></div>
        {items.length ? items.map((item, index) => <button key={item.id ?? index} className={'doctor-thread ' + (item.id === selected?.id ? 'is-selected' : '')} type="button" onClick={() => setSelectedId(item.id)}>
          <span className="doctor-activity-avatar">{initials(item.subject || 'BN')}</span><span><strong>{item.subject || 'Cuộc tư vấn của bệnh nhân'}</strong><small>{displayStatus(item.status)} · {formatMoment(item.lastMessageAt ?? item.updatedAt)}</small>{(item.unreadCount ?? 0) > 0 && <span className="doctor-status">{item.unreadCount} tin chưa đọc</span>}</span>
        </button>) : <EmptyState title="Chưa có cuộc tư vấn" body="Bạn chưa được gán cuộc hội thoại nào." compact />}
      </aside>
      <article className="doctor-surface doctor-chat-panel">
        {!selected ? <EmptyState title="Chọn một cuộc tư vấn" body="Danh sách bên trái sẽ hiển thị các cuộc tư vấn được backend phân quyền." /> : <>
          <header className="doctor-chat-head"><span className="doctor-activity-avatar">{initials(selected.subject || 'BN')}</span><div><strong>{selected.subject || 'Cuộc tư vấn của bệnh nhân'}</strong><small>{displayStatus(selected.status)} · cập nhật {formatMoment(selected.updatedAt ?? selected.lastMessageAt)}</small></div><span className={'doctor-status doctor-status-' + String(selected.status ?? '').toLowerCase()}>{displayStatus(selected.status)}</span></header>
          <div className="doctor-message-area" aria-live="polite">
            {messagesState === 'loading' && <div className="doctor-message-loading"><i /><i /><i /></div>}
            {messagesState === 'error' && <div><EmptyState title="Không tải được tin nhắn" body={messagesError} compact /><button className="doctor-secondary-button" type="button" onClick={() => setReloadMessages((value) => value + 1)}>Thử lại</button></div>}
            {messagesState === 'ready' && (messages.length ? messages.map((message, index) => <div className={'doctor-message ' + (message.senderAccountId === userId ? 'is-own' : '')} key={message.id ?? index}><p>{message.body || 'Tin nhắn trống'}</p><small>{message.senderAccountId === userId ? 'Bạn' : 'Người tham gia'} · {formatMoment(message.sentAt)}</small></div>) : <EmptyState title="Chưa có tin nhắn" body="Bạn có thể bắt đầu phản hồi từ ô bên dưới." compact />)}
          </div>
          <form className="doctor-composer" onSubmit={submit}>{sendError && <p role="alert" className="doctor-send-error">{sendError} <button type="button" className="doctor-secondary-button" onClick={() => setReloadMessages((value) => value + 1)}>Tải lại tin nhắn</button></p>}{selected.status === 'CLOSED' && <p className="doctor-shortcut-note">Cuộc tư vấn đã đóng, không thể gửi phản hồi.</p>}<label htmlFor="doctor-message">Nội dung phản hồi</label><div><textarea id="doctor-message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Nhập phản hồi cho bệnh nhân…" maxLength={4000} disabled={sending || selected.status === 'CLOSED'} /><button type="submit" disabled={!draft.trim() || sending || selected.status === 'CLOSED'}>{sending ? 'Đang gửi…' : 'Gửi phản hồi'}</button></div></form>
        </>}
      </article>
    </section>
  </>;
}

function ContractPending({ section }: { section: string }) {
  const page = copy[section] ?? copy.overview;
  const details: Record<string, string> = {
    appointments: 'Appointment Service chưa có API chỉ trả lịch được phân công cho bác sĩ đang đăng nhập.',
    patients: 'Danh sách bệnh nhân phải được backend lọc theo lịch khám/encounter được giao trước khi hiển thị.',
    encounters: 'Medical Record Service chưa có API REST trả về encounter theo bác sĩ hiện tại; không thể dùng danh sách toàn hệ thống.',
    schedule: 'Doctor Service có API lịch làm việc theo doctorId nhưng chưa có API xác định doctorId của tài khoản đang đăng nhập.',
    profile: 'Doctor Service có API hồ sơ theo doctorId nhưng chưa có API /doctors/me để nạp hồ sơ của tài khoản hiện tại.',
  };
  return <><PageHeading section={section} /><section className="doctor-surface doctor-contract-state"><span className="doctor-contract-icon" aria-hidden="true">⌁</span><div><span className="doctor-kicker">Chưa có dữ liệu được phân quyền</span><h2>{page.title} chưa thể nạp dữ liệu</h2><p>{details[section] ?? 'Chức năng chưa có contract API phù hợp.'}</p><p className="doctor-contract-note">Vui lòng liên hệ quản trị viên để được hỗ trợ kết nối và phân quyền.</p></div></section></>;
}

function PageHeading({ section, aside }: { section: string; aside?: string }) {
  const page = copy[section] ?? copy.overview;
  return <header className="doctor-heading"><div><span className="doctor-kicker">{page.eyebrow}</span><h1>{page.title}</h1><p>{page.description}</p></div>{aside && <span className="doctor-heading-meta">{aside}</span>}</header>;
}

function Metric({ label, value, hint, emphasis = false }: { label: string; value: number | null; hint: string; emphasis?: boolean }) {
  return <article className={'doctor-kpi ' + (emphasis ? 'doctor-kpi-primary' : '')}><span>{label}</span><strong>{value === null ? '—' : String(value).padStart(2, '0')}</strong><small>{hint}</small></article>;
}

function EmptyState({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return <div className={'doctor-empty ' + (compact ? 'is-compact' : '')}><strong>{title}</strong><p>{body}</p></div>;
}

function DoctorLoading() { return <div className="doctor-loading" role="status" aria-label="Đang tải dữ liệu"><i /><i /><i /><i /></div>; }
function DoctorError({ message, onRetry }: { message: string; onRetry: () => void }) { return <section className="doctor-error" role="alert"><strong>Không thể tải workspace Doctor</strong><p>{message}</p><button className="doctor-primary-button" type="button" onClick={onRetry}>Thử lại</button></section>; }
