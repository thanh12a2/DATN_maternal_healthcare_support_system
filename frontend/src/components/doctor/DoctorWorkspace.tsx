import { FormEvent, useEffect, useMemo, useState } from 'react';
import { navigate } from '../../app/navigation';
import { ApiError } from '../../services/api';
import {
  listConsultationMessages,
  listConsultations,
  sendConsultationMessage,
  type Consultation,
  type ConsultationMessage,
} from '../../services/operations';
import type { Requester } from '../../services/catalog';
import '../../styles/doctor-content.css';

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
      const rows = await listConsultations(request, 'limit=50');
      setConsultations(rows);
      setState('ready');
    } catch (reason) {
      setError(messageFor(reason));
      setState('error');
    }
  };

  useEffect(() => { void load(); }, [request]);

  const assigned = useMemo(() => consultations.filter((item) => item.assignedDoctorId === userId), [consultations, userId]);
  const needsResponse = useMemo(() => consultations.filter((item) => waitingStates.has(String(item.status))).length, [consultations]);

  if (state === 'loading') return <DoctorLoading />;
  if (state === 'error') return <DoctorError message={error} onRetry={() => void load()} />;

  if (section === 'overview') return <DoctorOverview consultations={consultations} assigned={assigned} needsResponse={needsResponse} />;
  if (section === 'consultations') return <ConsultationWorkspace items={consultations} request={request} userId={userId} onRefresh={load} />;
  return <ContractPending section={section} onRetry={() => void load()} />;
}

function DoctorOverview({ consultations, assigned, needsResponse }: { consultations: Consultation[]; assigned: Consultation[]; needsResponse: number }) {
  const latest = consultations.slice(0, 4);
  return <>
    <PageHeading section="overview" aside="Dữ liệu theo quyền truy cập" />
    <section className="doctor-kpi-grid" aria-label="Tổng quan công việc">
      <Metric label="Tư vấn cần xử lý" value={needsResponse} hint="Các cuộc hội thoại đang mở hoặc được giao" emphasis />
      <Metric label="Được phân công" value={assigned.length} hint="Tư vấn gắn với tài khoản của bạn" />
      <Metric label="Đã phản hồi" value={consultations.filter((item) => item.status === 'ANSWERED').length} hint="Theo trạng thái Consultation Service" />
      <Metric label="Đã hoàn tất" value={consultations.filter((item) => item.status === 'CLOSED').length} hint="Cuộc tư vấn đã đóng" />
    </section>
    <section className="doctor-overview-grid">
      <article className="doctor-surface">
        <div className="doctor-panel-head">
          <div><span className="doctor-kicker">Ưu tiên hôm nay</span><h2>Hộp thư tư vấn</h2></div>
          <button className="doctor-text-button" type="button" onClick={() => navigate('/workspace/doctor/consultations')}>Xem tất cả</button>
        </div>
        {latest.length ? <div className="doctor-activity-list">{latest.map((item, index) => <button className="doctor-activity-row" type="button" key={item.id ?? index} onClick={() => navigate('/workspace/doctor/consultations')}>
          <span className="doctor-activity-avatar">{initials(item.subject || 'BN')}</span>
          <span><strong>{item.subject || 'Cuộc tư vấn của bệnh nhân'}</strong><small>{displayStatus(item.status)} · {formatMoment(item.lastMessageAt ?? item.updatedAt)}</small></span>
          <span className={'doctor-status doctor-status-' + String(item.status ?? '').toLowerCase()}>{displayStatus(item.status)}</span>
        </button>)}</div> : <EmptyState title="Chưa có cuộc tư vấn" body="Khi có hội thoại được phân công, chúng sẽ xuất hiện tại đây." />}
      </article>
      <aside className="doctor-surface doctor-guidance-card">
        <span className="doctor-kicker">Luồng làm việc</span><h2>Làm việc an toàn theo quyền</h2>
        <ol className="doctor-guidance-list"><li><b>01</b><span>Mở cuộc tư vấn được giao và xem lịch sử trao đổi.</span></li><li><b>02</b><span>Phản hồi trực tiếp trong hội thoại; hệ thống lưu đúng người gửi.</span></li><li><b>03</b><span>Hồ sơ khám chỉ mở khi API đã lọc theo assignment.</span></li></ol>
      </aside>
    </section>
  </>;
}

function ConsultationWorkspace({ items, request, userId, onRefresh }: { items: Consultation[]; request: Requester; userId?: string; onRefresh: () => Promise<void> }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(() => items[0]?.id);
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [messagesState, setMessagesState] = useState<DataState>('loading');
  const [messagesError, setMessagesError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  useEffect(() => {
    if (!selected?.id) { setMessages([]); setMessagesState('ready'); return; }
    let alive = true;
    setMessagesState('loading');
    void listConsultationMessages(request, selected.id).then((rows) => {
      if (!alive) return;
      setMessages(rows);
      setMessagesState('ready');
    }).catch((reason) => {
      if (!alive) return;
      setMessagesError(messageFor(reason));
      setMessagesState('error');
    });
    return () => { alive = false; };
  }, [request, selected?.id]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!selected?.id || !body || sending) return;
    setSending(true);
    try {
      await sendConsultationMessage(request, selected.id, { body });
      setDraft('');
      const rows = await listConsultationMessages(request, selected.id);
      setMessages(rows);
      await onRefresh();
    } catch (reason) {
      setMessagesError(messageFor(reason));
    } finally { setSending(false); }
  };

  return <>
    <PageHeading section="consultations" aside={`${items.length} cuộc hội thoại`} />
    <section className="doctor-consultation-layout">
      <aside className="doctor-surface doctor-thread-list" aria-label="Danh sách tư vấn">
        <div className="doctor-panel-head"><div><span className="doctor-kicker">Hộp thư</span><h2>Cuộc trò chuyện</h2></div><span className="doctor-round-count">{items.length}</span></div>
        {items.length ? items.map((item, index) => <button key={item.id ?? index} className={'doctor-thread ' + (item.id === selected?.id ? 'is-selected' : '')} type="button" onClick={() => setSelectedId(item.id)}>
          <span className="doctor-activity-avatar">{initials(item.subject || 'BN')}</span><span><strong>{item.subject || 'Cuộc tư vấn của bệnh nhân'}</strong><small>{displayStatus(item.status)} · {formatMoment(item.lastMessageAt ?? item.updatedAt)}</small></span>
        </button>) : <EmptyState title="Chưa có cuộc tư vấn" body="Bạn chưa được gán cuộc hội thoại nào." compact />}
      </aside>
      <article className="doctor-surface doctor-chat-panel">
        {!selected ? <EmptyState title="Chọn một cuộc tư vấn" body="Danh sách bên trái sẽ hiển thị các cuộc tư vấn được backend phân quyền." /> : <>
          <header className="doctor-chat-head"><span className="doctor-activity-avatar">{initials(selected.subject || 'BN')}</span><div><strong>{selected.subject || 'Cuộc tư vấn của bệnh nhân'}</strong><small>{displayStatus(selected.status)} · cập nhật {formatMoment(selected.updatedAt ?? selected.lastMessageAt)}</small></div><span className={'doctor-status doctor-status-' + String(selected.status ?? '').toLowerCase()}>{displayStatus(selected.status)}</span></header>
          <div className="doctor-message-area" aria-live="polite">
            {messagesState === 'loading' && <div className="doctor-message-loading"><i /><i /><i /></div>}
            {messagesState === 'error' && <EmptyState title="Không tải được tin nhắn" body={messagesError} compact />}
            {messagesState === 'ready' && (messages.length ? messages.map((message, index) => <div className={'doctor-message ' + (message.senderAccountId === userId ? 'is-own' : '')} key={message.id ?? index}><p>{message.body || 'Tin nhắn trống'}</p><small>{message.senderAccountId === userId ? 'Bạn' : 'Người tham gia'} · {formatMoment(message.sentAt)}</small></div>) : <EmptyState title="Chưa có tin nhắn" body="Bạn có thể bắt đầu phản hồi từ ô bên dưới." compact />)}
          </div>
          <form className="doctor-composer" onSubmit={submit}><label htmlFor="doctor-message">Nội dung phản hồi</label><div><textarea id="doctor-message" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Nhập phản hồi cho bệnh nhân…" maxLength={4000} disabled={sending} /><button type="submit" disabled={!draft.trim() || sending}>{sending ? 'Đang gửi…' : 'Gửi phản hồi'}</button></div></form>
        </>}
      </article>
    </section>
  </>;
}

function ContractPending({ section, onRetry }: { section: string; onRetry: () => void }) {
  const page = copy[section] ?? copy.overview;
  const details: Record<string, string> = {
    appointments: 'Appointment Service chưa có API chỉ trả lịch được phân công cho bác sĩ đang đăng nhập.',
    patients: 'Danh sách bệnh nhân phải được backend lọc theo lịch khám/encounter được giao trước khi hiển thị.',
    encounters: 'Medical Record Service chưa có API REST trả về encounter theo bác sĩ hiện tại; không thể dùng danh sách toàn hệ thống.',
    schedule: 'Doctor Service có API lịch làm việc theo doctorId nhưng chưa có API xác định doctorId của tài khoản đang đăng nhập.',
    profile: 'Doctor Service có API hồ sơ theo doctorId nhưng chưa có API /doctors/me để nạp hồ sơ của tài khoản hiện tại.',
  };
  return <><PageHeading section={section} /><section className="doctor-surface doctor-contract-state"><span className="doctor-contract-icon" aria-hidden="true">⌁</span><div><span className="doctor-kicker">Đang chờ contract an toàn</span><h2>{page.title} chưa thể nạp dữ liệu</h2><p>{details[section] ?? 'Chức năng chưa có contract API phù hợp.'}</p><p className="doctor-contract-note">Màn hình không dùng UUID thủ công, không suy đoán doctorId và không hiển thị dữ liệu ngoài assignment.</p><button className="doctor-primary-button" type="button" onClick={onRetry}>Thử tải lại</button></div></section></>;
}

function PageHeading({ section, aside }: { section: string; aside?: string }) {
  const page = copy[section] ?? copy.overview;
  return <header className="doctor-heading"><div><span className="doctor-kicker">{page.eyebrow}</span><h1>{page.title}</h1><p>{page.description}</p></div>{aside && <span className="doctor-heading-meta">{aside}</span>}</header>;
}

function Metric({ label, value, hint, emphasis = false }: { label: string; value: number; hint: string; emphasis?: boolean }) {
  return <article className={'doctor-kpi ' + (emphasis ? 'doctor-kpi-primary' : '')}><span>{label}</span><strong>{String(value).padStart(2, '0')}</strong><small>{hint}</small></article>;
}

function EmptyState({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return <div className={'doctor-empty ' + (compact ? 'is-compact' : '')}><strong>{title}</strong><p>{body}</p></div>;
}

function DoctorLoading() { return <div className="doctor-loading" role="status" aria-label="Đang tải dữ liệu"><i /><i /><i /><i /></div>; }
function DoctorError({ message, onRetry }: { message: string; onRetry: () => void }) { return <section className="doctor-error" role="alert"><strong>Không thể tải workspace Doctor</strong><p>{message}</p><button className="doctor-primary-button" type="button" onClick={onRetry}>Thử lại</button></section>; }
