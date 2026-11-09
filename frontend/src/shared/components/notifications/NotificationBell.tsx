import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { NotificationInbox } from './NotificationInbox';
import { subscribeToRealtimeStream } from '../../../services/realtimeStream';
import '../../../styles/notification-inbox.css';

type Notice = { id: string; title: string; readAt: string | null };

export function NotificationBell() {
  const { request, stream, user } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [arrival, setArrival] = useState<Notice | null>(null);
  const known = useRef<Set<string> | null>(null);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const [page, count] = await Promise.all([
        request<{ items: Notice[] }>('/api/notifications/in-app?page=1'),
        request<{ count: number }>('/api/notifications/in-app/unread-count'),
      ]);
      if (current !== sequence.current) return;
      setUnread(count.count);
      const previous = known.current;
      const newNotice = previous && page.items.find(item => !item.readAt && !previous.has(item.id));
      known.current = new Set(page.items.map(item => item.id));
      if (newNotice) { setArrival(newNotice); window.dispatchEvent(new Event('notifications:arrived')); }
    } catch { /* Keep the last successful badge until the next retry. */ }
  }, [request]);
  useEffect(() => {
    known.current = null; setUnread(0); setArrival(null); setOpen(false);
    void refresh();
    const sync = () => { void refresh(); window.dispatchEvent(new Event('notifications:arrived')); };
    const visible = () => { if (document.visibilityState === 'visible') sync(); };
    const unsubscribe = subscribeToRealtimeStream({ url: '/api/notifications/in-app/stream', streamFn: stream,
      onEvent: () => sync(), onStatusChange: status => { if (status === 'CONNECTED') sync(); } });
    window.addEventListener('notifications:updated', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { sequence.current++; unsubscribe(); window.removeEventListener('notifications:updated', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [refresh, stream, user?.userId]);
  useEffect(() => {
    if (!arrival) return;
    const timer = window.setTimeout(() => setArrival(null), 5000);
    return () => window.clearTimeout(timer);
  }, [arrival]);

  return <div className="notification-bell-wrap">
    <button type="button" className={`notification-bell ${arrival ? 'has-arrival' : ''}`} aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'} aria-expanded={open} onClick={() => { setOpen(!open); setArrival(null); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
      {unread > 0 && <span className="notification-bell-badge">{unread > 99 ? '99+' : unread}</span>}
    </button>
    <div className="notification-announcement" aria-live="polite">{arrival && !open && <button type="button" className="notification-toast" onClick={() => { setOpen(true); setArrival(null); }}><strong>Thông báo mới</strong><span>{arrival.title}</span></button>}</div>
    {open && <div className="notification-popover"><div className="notification-popover-close"><button type="button" onClick={() => { setOpen(false); void refresh(); }}>Đóng</button></div><NotificationInbox /></div>}
  </div>;
}
