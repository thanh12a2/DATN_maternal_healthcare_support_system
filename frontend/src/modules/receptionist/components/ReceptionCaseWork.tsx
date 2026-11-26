import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal, Space, Tag, Typography } from 'antd';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { getReceptionPatient } from '../../../services/operations';
import { createWorkArrivalTracker } from './workArrivalTracker';

export type Item = { id: string; caseCode: string; patientId: string; type: 'SCHEDULED' | 'WALK_IN'; appointmentId: string | null; arrivalAt: string; status: string; admissionStatus: string | null; queueTicketCode?: string | null; queueRoomCode?: string | null; claim: 'AVAILABLE' | 'MINE' | 'OTHER' };

function CaseRow({ item, busy, action }: { item: Item; busy: string; action: (item: Item, operation: 'claim' | 'release' | 'open' | 'dismiss') => void }) {
  const { request } = useAuthSession();
  const [name, setName] = useState('');
  const [appointmentCode, setAppointmentCode] = useState('');
  useEffect(() => {
    let live = true;
    void getReceptionPatient(request, item.patientId).then(patient => { if (live) setName(patient?.fullName || ''); }).catch(() => undefined);
    if (item.appointmentId) void request<{ appointmentCode?: string }>(`/api/appointment/appointments/${encodeURIComponent(item.appointmentId)}`).then(appointment => { if (live) setAppointmentCode(appointment.appointmentCode || ''); }).catch(() => undefined);
    return () => { live = false; };
  }, [request, item.patientId, item.appointmentId]);
  return <article>
    <Typography.Text strong>{name || 'Bệnh nhân'}</Typography.Text> <Tag color={item.claim === 'MINE' ? 'blue' : item.claim === 'OTHER' ? 'default' : 'green'}>{item.claim === 'MINE' ? 'Bạn đang xử lý' : item.claim === 'OTHER' ? 'Đã có người xử lý' : 'Chưa nhận'}</Tag>
    <p>{item.caseCode} · {item.type === 'WALK_IN' ? 'Vãng lai' : 'Có lịch'}{appointmentCode ? ` · ${appointmentCode}` : ''}</p>
    <p>{status(item)} · Đến {new Date(item.arrivalAt).toLocaleString('vi-VN')}</p>
    {item.status === 'ADMITTED' && <p>Đã thanh toán hoặc đủ điều kiện tiếp nhận · {item.queueTicketCode ? `Số thứ tự ${item.queueTicketCode}` : 'Đã tạo lượt chờ'}{item.queueRoomCode ? ` · Phòng ${item.queueRoomCode}` : ''}</p>}
    <Space wrap>{item.status === 'ADMITTED' ? <Button size="small" onClick={() => action(item, 'dismiss')}>Đã xem</Button> : <>{item.claim === 'AVAILABLE' && <Button size="small" type="primary" loading={busy === item.id} onClick={() => action(item, 'claim')}>Nhận xử lý</Button>}{item.claim === 'OTHER' && <Button size="small" onClick={() => Modal.info({ title: 'Đã có người xử lý', content: 'Case này đang do lễ tân khác phụ trách. Chỉ người phụ trách hoặc quản trị viên mới có thể trả lại case.' })}>Xem trạng thái</Button>}{item.claim === 'MINE' && <><Button size="small" onClick={() => action(item, 'open')}>Tiếp tục xử lý</Button><Button size="small" disabled={Boolean(busy)} onClick={() => action(item, 'release')}>Trả lại</Button></>}</>}</Space>
  </article>;
}
function status(item: Item) {
  if (item.status === 'ADMITTED') return 'Đã hoàn tất tiếp nhận';
  if (item.admissionStatus === 'FAILED_RETRYABLE') return 'Tiếp nhận lỗi, cần thử lại';
  if (item.admissionStatus === 'AWAITING_PAYMENT') return 'Chờ đủ điều kiện thanh toán';
  if (item.status === 'OPEN') return 'Chờ xác minh danh tính';
  if (item.status === 'IDENTITY_VERIFIED') return 'Chờ tiếp nhận';
  return 'Tiếp nhận chưa hoàn tất';
}
export function useReceptionCaseWork(onArrival: () => void, onOpenCase: (item: Item) => void = () => undefined) {
  const { request } = useAuthSession();
  const [items, setItems] = useState<Item[]>([]);
  const [available, setAvailable] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [previous, setPrevious] = useState<(string | null)[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const arrivalTracker = useRef(createWorkArrivalTracker());
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const response = await request<{ data: { items: Item[]; availableCount: number; nextCursor: string | null } }>(`/api/reception/work${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
      if (current !== sequence.current) return;
      const data = response.data;
      if (arrivalTracker.current(cursor, data.items, data.availableCount)) onArrival();
      setItems(data.items); setAvailable(data.availableCount); setNext(data.nextCursor); setError('');
    } catch { if (current === sequence.current) setError('Không thể tải các case tiếp nhận.'); }
    finally { if (current === sequence.current) setLoading(false); }
  }, [request, cursor, onArrival]);
  useEffect(() => {
    setLoading(true); void load();
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { sequence.current++; document.removeEventListener('visibilitychange', visible); };
  }, [load]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = (event: Event) => { const group = (event as CustomEvent<string>).detail; if (group === 'case' || group === 'all') { clearTimeout(timer); timer = setTimeout(() => void load(), 150); } };
    window.addEventListener('reception-work-changed', changed);
    return () => { clearTimeout(timer); window.removeEventListener('reception-work-changed', changed); };
  }, [load]);
  const action = async (item: Item, operation: 'claim' | 'release' | 'open' | 'dismiss') => {
    setBusy(item.id);
    try {
      if (operation === 'open') {
        onOpenCase(item);
      } else await request(`/api/reception/work/${encodeURIComponent(item.id)}/${operation}`, { method: 'POST' });
      await load();
    } catch (e) { const message = e instanceof Error ? e.message : 'Không thể cập nhật công việc.'; await load(); setError(message); }
    finally { setBusy(''); }
  };
  const panel = <div className="reception-reviews">
    <div className="reception-reviews-header"><div><strong>Tiếp nhận cần xử lý</strong><div>Case chờ bước tiếp theo hoặc cần thử lại</div></div><Button size="small" onClick={() => void load()}>Làm mới</Button></div>
    {error && <Alert type="error" showIcon message={error} />}
    {loading ? <p>Đang tải công việc…</p> : items.length === 0 ? <p>Không có case tiếp nhận cần xử lý.</p> : items.map(item => <CaseRow key={item.id} item={item} busy={busy} action={(row, operation) => void action(row, operation)} />)}
    {(next || previous.length > 0) && <Space><Button size="small" disabled={!previous.length} onClick={() => { const pages = [...previous]; setCursor(pages.pop() ?? null); setPrevious(pages); }}>Trang trước</Button><Button size="small" disabled={!next} onClick={() => { setPrevious([...previous, cursor]); setCursor(next); }}>Trang tiếp</Button></Space>}
  </div>;
  return { available, panel };
}
