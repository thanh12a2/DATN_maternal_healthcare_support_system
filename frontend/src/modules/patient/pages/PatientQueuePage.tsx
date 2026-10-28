import { useEffect, useState } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate } from '../../../app/navigation';
import { PatientSidebar } from '../../../shared/components/navigation/PatientSidebar';
import { ApiError } from '../../../services/api';
import { getAppointment, type Appointment } from '../../../services/appointment';
import { getActiveJourney, type QueueJourney, type QueueTicket } from '../../../services/queue';
import '../../../styles/patient-home.css';
import '../../../styles/patient-portal.css';
import '../../../styles/patient-queue.css';

const reconnectDelay = (attempt: number) => Math.min(10_000, 1_000 * 2 ** Math.min(attempt, 3));

type QueueVisualState = 'waiting' | 'turn' | 'late';

function rawState(ticket?: QueueTicket | null) {
  return String(ticket?.state ?? '').toUpperCase().replace(/^TICKET_STATE_/, '');
}

function visualState(ticket?: QueueTicket | null): QueueVisualState {
  const state = rawState(ticket);
  if (state === 'CALLED' || state === 'IN_SERVICE') return 'turn';
  if (state === 'SKIPPED') return 'late';
  return 'waiting';
}

const stateCopy: Record<QueueVisualState, { label: string; helper: string }> = {
  waiting: {
    label: 'Chưa đến lượt',
    helper: 'Bạn nên có mặt tại khu vực chờ và theo dõi trạng thái hàng đợi.',
  },
  turn: {
    label: 'Đến lượt bạn',
    helper: 'Vui lòng chuẩn bị vào phòng khám theo hướng dẫn của nhân viên.',
  },
  late: {
    label: 'Trễ lượt',
    helper: 'Ticket đã quá lượt gọi. Vui lòng liên hệ quầy lễ tân để được hỗ trợ.',
  },
};

function formatDateTime(value?: string) {
  if (!value) return 'Đang cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Đang cập nhật';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function appointmentDoctorLabel(appointment?: Appointment | null) {
  if (!appointment) return 'Đang cập nhật';
  if (appointment.assignedDoctorId) return 'Bác sĩ phụ trách';
  if (appointment.assignedRankCode) return 'Bác sĩ hạng ' + appointment.assignedRankCode;
  return 'Đang phân công';
}

export function PatientQueuePage() {
  const auth = useAuthSession();
  const [journey, setJourney] = useState<QueueJourney | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const controller = new AbortController();

    const refreshQueue = async () => {
      const nextJourney = await getActiveJourney(auth.request);
      if (!live) return;
      setJourney(nextJourney);
      setState('ready');
      setError('');
      if (nextJourney?.appointmentId) {
        void getAppointment(auth.request, String(nextJourney.appointmentId))
          .then((nextAppointment) => { if (live) setAppointment(nextAppointment); })
          .catch(() => { if (live) setAppointment(null); });
      } else {
        setAppointment(null);
      }
    };

    const initialLoad = async () => {
      try {
        await refreshQueue();
      } catch (reason) {
        if (!live) return;
        if (reason instanceof ApiError && reason.statusCode === 404) setState('ready');
        else {
          setState('error');
          setError(reason instanceof Error ? reason.message : 'Không thể tải hàng đợi.');
        }
      }
    };

    const consumeEvents = async () => {
      let attempt = 0;
      while (live) {
        try {
          const response = await auth.stream('/api/queue/me/events', controller.signal);
          if (!response.body) throw new Error('SSE body is unavailable');
          attempt = 0;
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (live) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true });
            const blocks = buffer.split('\n\n');
            buffer = blocks.pop() ?? '';
            for (const block of blocks) {
              if (block.includes('event:') && block.includes('data:')) await refreshQueue();
            }
          }
          if (live) await new Promise((resolve) => setTimeout(resolve, reconnectDelay(attempt++)));
        } catch (reason) {
          if (!live || (reason instanceof DOMException && reason.name === 'AbortError')) break;
          await new Promise((resolve) => setTimeout(resolve, reconnectDelay(attempt++)));
        }
      }
    };

    void initialLoad();
    void consumeEvents();
    return () => {
      live = false;
      controller.abort();
    };
  }, [auth.request, auth.stream]);

  const ticket = journey?.tickets?.[0] ?? null;
  const activeState = visualState(ticket);
  const copy = stateCopy[activeState];
  const appointmentTitle = appointment?.pricing?.serviceName || 'Lịch khám';
  const appointmentTime = formatDateTime(appointment?.startAt);
  const doctor = appointmentDoctorLabel(appointment);
  const ticketState = rawState(ticket);
  const isTerminal = ticketState === 'COMPLETED' || ticketState === 'CANCELLED';
  const progress = activeState === 'turn' ? 100 : activeState === 'late' ? 100 : undefined;
  const progressText = progress === undefined ? 'Đang cập nhật theo tiến độ phục vụ' : progress === 100 ? 'Đã đến lượt xử lý' : 'Đang chờ được gọi';

  return (
    <div className="patient-home-shell patient-desktop-portal">
      <PatientSidebar onLogout={() => void auth.signOut().then(() => navigate('/dang-nhap', { replace: true }))} />
      <main className="patient-main-view patient-queue-main">
        <section className="patient-portal-page patient-queue-page">
          {state === 'loading' && <div className="patient-queue-card patient-queue-card-empty"><p>Đang tải trạng thái hàng đợi…</p></div>}
          {state === 'error' && <div className="patient-queue-card patient-queue-card-empty" role="alert"><p>{error}</p></div>}
          {state === 'ready' && !ticket && <div className="patient-queue-card patient-queue-card-empty"><h2>Chưa có hàng đợi đang hoạt động</h2><p>Khi hoàn tất tiếp nhận, số thứ tự của bạn sẽ hiển thị tại đây.</p></div>}
          {state === 'ready' && ticket && (
            <article className={'patient-queue-card patient-queue-state-' + activeState}>
              <div className="patient-queue-banner">
                <div className="patient-queue-banner-status"><span className="patient-queue-dot" aria-hidden="true" /><strong>{copy.label}</strong></div>
                <span className="patient-queue-banner-caption">{isTerminal ? 'Hàng đợi đã kết thúc' : 'Trạng thái được cập nhật tự động'}</span>
              </div>

              <div className="patient-queue-meta">
                <div><span>Ngày và giờ</span><strong>{appointmentTime}</strong></div>
                <div><span>Bác sĩ</span><strong>{doctor}</strong></div>
                <div><span>Phòng</span><strong>{ticket.roomCode || 'Đang phân phòng'}</strong></div>
              </div>

              <div className="patient-queue-body">
                <div className="patient-queue-title"><span>Lịch khám</span><h2>{appointmentTitle}</h2></div>
                <div className="patient-queue-numbers">
                  <div><span>Đang phục vụ</span><strong className="is-muted">—</strong></div>
                  <div className="patient-queue-number-divider" aria-hidden="true" />
                  <div><span>Số của bạn</span><strong className="is-accent">{ticket.ticketCode || '—'}</strong><small>{ticket.stageName || ticket.stageCode || 'Giai đoạn đang xử lý'}</small></div>
                </div>
                <div className="patient-queue-progress">
                  <div className="patient-queue-progress-head"><strong>Tiến độ hàng đợi</strong><span>{progressText}</span></div>
                  <div className="patient-queue-progress-track" role="progressbar" aria-label="Tiến độ hàng đợi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? 0}>
                    <span className="patient-queue-progress-value" style={{ width: progress === undefined ? '18%' : progress + '%' }} />
                  </div>
                </div>
                <div className="patient-queue-guidance"><strong>Gợi ý:</strong> {copy.helper}</div>
              </div>
            </article>
          )}
        </section>
      </main>
    </div>
  );
}
