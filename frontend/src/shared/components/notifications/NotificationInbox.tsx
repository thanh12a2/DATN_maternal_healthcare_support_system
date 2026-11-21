import { useCallback, useEffect, useState } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate } from '../../../app/navigation';
import '../../../styles/notification-inbox.css';

type Notice = { id: string; title: string; body: string; readAt: string | null; createdAt: string; resourceType?: string | null };
type Page = { items: Notice[]; page: number; pageSize: number; total: number };
export function NotificationInbox() {
  const { request, user } = useAuthSession();
  const [data, setData] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unread, setUnread] = useState(0);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [inbox, count] = await Promise.all([request<Page>(`/api/notifications/in-app?page=${page}`), request<{ count: number }>('/api/notifications/in-app/unread-count')]); setData(inbox); setUnread(count.count); }
    catch { setError('Không thể tải thông báo. Vui lòng thử lại.'); }
    finally { setLoading(false); }
  }, [page, request]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener('notifications:arrived', refresh);
    return () => window.removeEventListener('notifications:arrived', refresh);
  }, [load]);
  const read = async (id?: string) => {
    setBusy(true); setError('');
    try { await request(id ? `/api/notifications/in-app/${encodeURIComponent(id)}/read` : '/api/notifications/in-app/read-all', { method: 'POST' }); await load(); window.dispatchEvent(new Event('notifications:updated')); }
    catch { setError('Không thể cập nhật trạng thái. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  };
  const open = async (item: Notice) => {
    if (!item.readAt) await read(item.id);
    if (item.resourceType === 'appointment') navigate(user?.role === 'DOCTOR' ? '/workspace/doctor/appointments' : '/lich-hen');
    if (item.resourceType === 'consultation' && user?.role === 'DOCTOR') navigate('/workspace/doctor/consultations');
    if (item.resourceType === 'queue' && user?.role === 'PATIENT') navigate('/lich-hen');
  };
  return <section className="notification-inbox" aria-label="Thông báo">
    <header><div><h2>Thông báo</h2><p>Các cập nhật mới từ phòng khám.</p></div><button type="button" disabled={busy || !unread} onClick={() => void read()}>Đánh dấu tất cả đã đọc</button></header>
    {error && <div role="alert">{error} <button type="button" onClick={() => void load()}>Thử lại</button></div>}
    {loading ? <p role="status">Đang tải thông báo...</p> : data?.items.length ? <div>{data.items.map(item => <article key={item.id} className={item.readAt ? '' : 'is-unread'}><div><strong>{item.title}{!item.readAt && <span> Mới</span>}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small></div><button type="button" disabled={busy} onClick={() => void open(item)}>{item.resourceType === 'appointment' ? 'Xem lịch hẹn' : item.resourceType === 'consultation' ? 'Xem tư vấn' : item.resourceType === 'queue' ? 'Xem lịch hẹn' : item.readAt ? 'Đã đọc' : 'Đánh dấu đã đọc'}</button></article>)}</div> : !error && <p>Chưa có thông báo. Các cập nhật sẽ xuất hiện tại đây.</p>}
    {data && data.total > data.pageSize && <nav aria-label="Trang thông báo"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>Trang {page}</span><button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Trang sau</button></nav>}
  </section>;
}
