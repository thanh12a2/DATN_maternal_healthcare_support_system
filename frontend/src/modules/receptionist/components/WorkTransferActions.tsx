import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Popconfirm, Space } from 'antd';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import type { Requester } from '../../../services/catalog';
import { admitReceptionCase, getReceptionCase } from '../../../services/operations';
import type { Item } from './ReceptionCaseWork';

type Invoice = { id: string; version: number; status: string; payment?: { id: string; status: string; method: string; reference?: string | null } | null };

export function WorkTransferActions({ item, request, onUpdated }: { item: Item; request: Requester; onUpdated: () => void }) {
  const { user } = useAuthSession();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const load = useCallback(async () => {
    const current = await getReceptionCase(request, item.id);
    if (current.patientId !== item.patientId || current.appointmentId !== item.appointmentId) throw new Error('Case không khớp với lịch đang mở.');
    const id = current.admission?.invoiceId;
    return { current, invoice: id ? await request<Invoice>(`/api/billing/invoices/${encodeURIComponent(id)}`) : null };
  }, [request, item.id, item.patientId, item.appointmentId]);
  useEffect(() => {
    let live = true;
    setInvoice(null); setError('');
    const refresh = () => { void load().then(result => { if (live) setInvoice(result.invoice); }).catch(() => { if (live) setError('Không thể tải trạng thái giao dịch.'); }); };
    refresh();
    const changed = () => refresh();
    window.addEventListener('reception-work-changed', changed);
    return () => { live = false; window.removeEventListener('reception-work-changed', changed); };
  }, [load]);
  const perform = async (operation: 'verify' | 'reject') => {
    setBusy(true); setError('');
    try {
      const latest = await load();
      if (!user || latest.current.workClaimedBy !== user.userId) throw new Error('Bạn không còn phụ trách case này. Hãy tải lại công việc.');
      const payment = latest.invoice?.payment;
      if (!latest.invoice || latest.invoice.status !== 'PAYMENT_PENDING_VERIFICATION' || !payment || payment.status !== 'RECORDED' || payment.method !== 'MANUAL_BANK_TRANSFER') throw new Error('Giao dịch đã thay đổi. Hãy tải lại hóa đơn.');
      await request(`/api/billing/payments/${encodeURIComponent(payment.id)}/${operation}`, { method: 'POST', body: JSON.stringify({ expectedInvoiceVersion: latest.invoice.version, ...(operation === 'reject' ? { reason: reason.trim() } : {}) }) });
      setInvoice(null); setRejectOpen(false); setReason('');
      if (operation === 'verify') {
        try { await admitReceptionCase(request, item.id); }
        catch { setError('Đã xác nhận chuyển khoản. Kiểm tra trạng thái check-in trước khi thử tiếp nhận lại.'); }
      }
      onUpdated();
      window.dispatchEvent(new CustomEvent('reception-work-changed', { detail: 'all' }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể cập nhật giao dịch.'); }
    finally { setBusy(false); }
  };
  const pending = invoice?.status === 'PAYMENT_PENDING_VERIFICATION' && invoice.payment?.status === 'RECORDED' && invoice.payment.method === 'MANUAL_BANK_TRANSFER';
  return <>
    {error && <Alert type="warning" showIcon message={error} />}
    {pending && <><span>Mã chuyển khoản: {invoice?.payment?.reference || 'Chưa cung cấp'}</span><Space wrap><Popconfirm title="Xác nhận đã kiểm tra giao dịch?" onConfirm={() => void perform('verify')}><Button type="primary" disabled={item.claim !== 'MINE' || busy}>Xác nhận chuyển khoản</Button></Popconfirm><Button danger disabled={item.claim !== 'MINE' || busy} onClick={() => setRejectOpen(true)}>Từ chối</Button></Space></>}
    <Modal title="Từ chối giao dịch" open={rejectOpen} okText="Từ chối giao dịch" okButtonProps={{ danger: true, disabled: reason.trim().length < 3, loading: busy }} onCancel={() => { setRejectOpen(false); setReason(''); }} onOk={() => void perform('reject')}><Input.TextArea aria-label="Lý do từ chối" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} /></Modal>
  </>;
}
