import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, Modal, Popconfirm, Space, Tag, Typography } from 'antd';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { admitReceptionCase, getReceptionCase, getReceptionPatient, verifyReceptionIdentity, type ReceptionCase } from '../../../services/operations';
import { createWorkArrivalTracker } from './workArrivalTracker';

type Item = { id: string; caseCode: string; patientId: string; type: 'SCHEDULED' | 'WALK_IN'; appointmentId: string | null; arrivalAt: string; status: string; admissionStatus: string | null; queueTicketCode?: string | null; queueRoomCode?: string | null; claim: 'AVAILABLE' | 'MINE' | 'OTHER' };
type Invoice = { id: string; invoiceNumber: string; status: string; version: number; totalMinor: number; payment?: { id: string; status: string; method: string; reference?: string | null } | null };

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
    <Space wrap>{item.status === 'ADMITTED' ? <Button size="small" onClick={() => action(item, 'dismiss')}>Đã xem</Button> : <>{item.claim === 'AVAILABLE' && <Button size="small" type="primary" loading={busy === item.id} onClick={() => action(item, 'claim')}>Nhận xử lý</Button>}{item.claim === 'OTHER' && <Button size="small" onClick={() => Modal.info({ title: 'Đã có người xử lý', content: 'Case này đang do lễ tân khác phụ trách. Chỉ người phụ trách hoặc quản trị viên mới có thể trả lại case.' })}>Mở case</Button>}{item.claim === 'MINE' && <><Button size="small" onClick={() => action(item, 'open')}>Mở case</Button><Button size="small" disabled={Boolean(busy)} onClick={() => action(item, 'release')}>Trả lại</Button></>}</>}</Space>
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
export function useReceptionCaseWork(onArrival: () => void, onFind: (code: string) => void) {
  const { request } = useAuthSession();
  const [items, setItems] = useState<Item[]>([]);
  const [available, setAvailable] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [previous, setPrevious] = useState<(string | null)[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);
  const [caseData, setCaseData] = useState<ReceptionCase | null>(null);
  const [caseMessage, setCaseMessage] = useState('');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
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
        setCaseData(await getReceptionCase(request, item.id)); setCaseMessage(''); setSelected(item);
      } else await request(`/api/reception/work/${encodeURIComponent(item.id)}/${operation}`, { method: 'POST' });
      await load();
    } catch (e) { const message = e instanceof Error ? e.message : 'Không thể cập nhật công việc.'; await load(); setError(message); }
    finally { setBusy(''); }
  };
  useEffect(() => {
    let live = true;
    setInvoice(null);
    const id = caseData?.admission?.invoiceId;
    if (id) void request<Invoice>(`/api/billing/invoices/${encodeURIComponent(id)}`).then(value => { if (live) setInvoice(value); }).catch(() => { if (live) setCaseMessage('Không thể tải hóa đơn; đóng case và thử lại.'); });
    return () => { live = false; };
  }, [caseData?.admission?.invoiceId, request]);
  useEffect(() => {
    const changed = (event: Event) => {
      const category = (event as CustomEvent<string>).detail;
      const id = caseData?.admission?.invoiceId;
      if (id && (category === 'payment' || category === 'all')) void request<Invoice>(`/api/billing/invoices/${encodeURIComponent(id)}`).then(setInvoice).catch(() => setCaseMessage('Không thể cập nhật trạng thái hóa đơn.'));
    };
    window.addEventListener('reception-work-changed', changed);
    return () => window.removeEventListener('reception-work-changed', changed);
  }, [caseData?.admission?.invoiceId, request]);
  const verifyTransfer = async () => {
    if (!selected || !invoice?.payment || selectedClaim !== 'MINE') return;
    setBusy(selected.id); setCaseMessage('');
    try {
      await request(`/api/billing/payments/${encodeURIComponent(invoice.payment.id)}/verify`, { method: 'POST', body: JSON.stringify({ expectedInvoiceVersion: invoice.version }) });
      setInvoice({ ...invoice, status: 'PAID', payment: { ...invoice.payment, status: 'VERIFIED' } });
      try {
        await admitReceptionCase(request, selected.id);
        const current = await getReceptionCase(request, selected.id);
        setCaseData(current);
        setCaseMessage(current.status === 'ADMITTED' ? 'Đã xác nhận thanh toán và hoàn tất tiếp nhận.' : 'Đã xác nhận thanh toán; tiếp nhận chưa hoàn tất. Vui lòng kiểm tra trạng thái case.');
      } catch {
        const current = await getReceptionCase(request, selected.id).catch(() => null);
        if (current) setCaseData(current);
        setCaseMessage(current?.status === 'ADMITTED' ? 'Đã xác nhận thanh toán và hoàn tất tiếp nhận.' : 'Đã xác nhận thanh toán; hệ thống đang xử lý hoặc chưa tạo được lượt chờ. Kiểm tra lại case trước khi thử lại.');
      }
      await load();
    } catch (e) { setCaseMessage(e instanceof Error ? e.message : 'Không thể xác nhận thanh toán.'); }
    finally { setBusy(''); }
  };
  const rejectTransfer = async () => {
    if (!selected || !invoice?.payment || selectedClaim !== 'MINE' || rejectReason.trim().length < 3) return;
    setBusy(selected.id); setCaseMessage('');
    try {
      await request(`/api/billing/payments/${encodeURIComponent(invoice.payment.id)}/reject`, { method: 'POST', body: JSON.stringify({ expectedInvoiceVersion: invoice.version, reason: rejectReason.trim() }) });
      setInvoice({ ...invoice, status: 'OUTSTANDING', payment: { ...invoice.payment, status: 'REJECTED' } });
      setRejectOpen(false); setRejectReason('');
      setCaseMessage('Đã từ chối giao dịch. Hóa đơn vẫn cần được xử lý.');
      await load();
    } catch (e) { setCaseMessage(e instanceof Error ? e.message : 'Không thể từ chối giao dịch.'); }
    finally { setBusy(''); }
  };
  const processCase = async (operation: 'verify' | 'admit') => {
    if (!selected) return;
    setBusy(selected.id); setCaseMessage('');
    try {
      if (operation === 'verify') await verifyReceptionIdentity(request, selected.id, { method: 'APPOINTMENT_CODE', result: 'VERIFIED', verifiedFields: ['fullName', 'appointmentId'] });
      else await admitReceptionCase(request, selected.id);
      const current = await getReceptionCase(request, selected.id);
      setCaseData(current);
      setCaseMessage(current.admission?.status === 'AWAITING_PAYMENT' ? 'Case đang chờ thanh toán. Mở lịch để tiếp tục xử lý hóa đơn.' : current.status === 'ADMITTED' ? 'Đã hoàn tất tiếp nhận và tạo lượt chờ.' : 'Đã xác minh danh tính.');
      await load();
    } catch (e) { setCaseMessage(e instanceof Error ? e.message : 'Không thể xử lý case.'); await load(); }
    finally { setBusy(''); }
  };
  const selectedClaim = selected && items.find(item => item.id === selected.id)?.claim;
  const panel = <div className="reception-reviews">
    <div className="reception-reviews-header"><div><strong>Tiếp nhận cần xử lý</strong><div>Case chờ bước tiếp theo hoặc cần thử lại</div></div><Button size="small" onClick={() => void load()}>Làm mới</Button></div>
    {error && <Alert type="error" showIcon message={error} />}
    {loading ? <p>Đang tải công việc…</p> : items.length === 0 ? <p>Không có case tiếp nhận cần xử lý.</p> : items.map(item => <CaseRow key={item.id} item={item} busy={busy} action={(row, operation) => void action(row, operation)} />)}
    {(next || previous.length > 0) && <Space><Button size="small" disabled={!previous.length} onClick={() => { const pages = [...previous]; setCursor(pages.pop() ?? null); setPrevious(pages); }}>Trang trước</Button><Button size="small" disabled={!next} onClick={() => { setPrevious([...previous, cursor]); setCursor(next); }}>Trang tiếp</Button></Space>}
    <Modal title={selected ? `Tiếp nhận ${selected.caseCode}` : 'Tiếp nhận'} open={Boolean(selected)} onCancel={() => { setSelected(null); setCaseData(null); }} footer={null}>
      <p>Trạng thái: {caseData?.status || 'Đang tải'}</p>
      {caseMessage && <Alert showIcon type={caseData?.status === 'ADMITTED' ? 'success' : 'info'} message={caseMessage} />}
      {invoice && <div><p>Hóa đơn {invoice.invoiceNumber} · {invoice.totalMinor.toLocaleString('vi-VN')} ₫ · {invoice.status}</p>
        {invoice.status === 'PAYMENT_PENDING_VERIFICATION' && invoice.payment?.method === 'MANUAL_BANK_TRANSFER' && invoice.payment.status === 'RECORDED' && <><p>Mã chuyển khoản: {invoice.payment.reference || 'Chưa cung cấp'}</p><Space><Popconfirm title="Xác nhận đã kiểm tra giao dịch?" onConfirm={() => void verifyTransfer()}><Button disabled={selectedClaim !== 'MINE' || Boolean(busy)} type="primary">Xác nhận chuyển khoản</Button></Popconfirm><Button danger disabled={selectedClaim !== 'MINE' || Boolean(busy)} onClick={() => setRejectOpen(true)}>Từ chối</Button></Space></>}
      </div>}
      <Space wrap style={{ marginTop: 16 }}>
        <Button type="primary" disabled={selectedClaim !== 'MINE' || caseData?.status !== 'OPEN' || Boolean(busy)} onClick={() => void processCase('verify')}>Đã kiểm tra và xác minh danh tính</Button>
        <Button type="primary" disabled={selectedClaim !== 'MINE' || !['IDENTITY_VERIFIED', 'ADMISSION_IN_PROGRESS'].includes(String(caseData?.status)) || Boolean(busy)} onClick={() => void processCase('admit')}>Admit / Check-in</Button>
        {selected?.appointmentId && <Button onClick={() => { void request<{ appointmentCode?: string }>(`/api/appointment/appointments/${encodeURIComponent(selected.appointmentId!)}`).then(a => { if (a.appointmentCode) { setSelected(null); onFind(a.appointmentCode); } }).catch(() => setCaseMessage('Không thể mở lịch hẹn.')); }}>Mở lịch và hóa đơn</Button>}
      </Space>
    </Modal>
    <Modal title="Từ chối giao dịch" open={rejectOpen} okText="Từ chối giao dịch" okButtonProps={{ danger: true, disabled: rejectReason.trim().length < 3, loading: Boolean(busy) }} onCancel={() => { setRejectOpen(false); setRejectReason(''); }} onOk={() => void rejectTransfer()}><Input.TextArea aria-label="Lý do từ chối" value={rejectReason} onChange={event => setRejectReason(event.target.value)} maxLength={500} /></Modal>
  </div>;
  return { available, panel };
}
