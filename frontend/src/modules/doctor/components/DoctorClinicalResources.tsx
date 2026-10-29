import { useEffect, useState } from 'react';
import type { Requester } from '../../../services/catalog';
import { listPrescriptions, listTreatmentPlans } from '../../../services/clinical';

export function DoctorClinicalResources({ request, encounterId, kind }: { request: Requester; encounterId: string; kind: 'prescriptions' | 'plans' }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const query = new URLSearchParams({ encounterId }).toString();
    void (kind === 'prescriptions' ? listPrescriptions(request, query) : listTreatmentPlans(request, query)).then((rows) => { if (active) { setItems(rows); setLoading(false); } }).catch((reason: unknown) => { if (active) { setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu.'); setLoading(false); } });
    return () => { active = false; };
  }, [request, encounterId, kind, revision]);
  if (loading) return <div className="doctor-message-loading" role="status" aria-label="Đang tải"><i /><i /></div>;
  if (error) return <div role="alert"><p>{error}</p><button className="doctor-secondary-button" onClick={() => setRevision((n) => n + 1)}>Thử lại</button></div>;
  if (!items.length) return <p>Chưa có {kind === 'prescriptions' ? 'đơn thuốc' : 'kế hoạch điều trị'} cho hồ sơ khám này.</p>;
  return <div>{items.map((item, index) => <div className="doctor-schedule-row" key={String(item.id ?? index)}><div><strong>{kind === 'plans' ? String(item.title || 'Kế hoạch điều trị') : 'Đơn thuốc'}</strong><p>Trạng thái: {String(item.status ?? 'Chưa cập nhật')}</p>{Array.isArray(item.items) && item.items.map((entry: Record<string, unknown>, i: number) => <p key={i}>{String(entry.medicationName ?? entry.title ?? 'Nội dung')} {entry.dose ? `· ${String(entry.dose)}` : ''} {entry.frequency ? `· ${String(entry.frequency)}` : ''}</p>)}</div></div>)}<p>Chỉnh sửa chưa khả dụng khi hệ thống chưa hoàn tất kiểm tra phiên bản và trạng thái.</p></div>;
}
