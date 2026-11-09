import { useCallback, useEffect, useState } from 'react';
import { BellOutlined } from '@ant-design/icons';
import { Badge, Button, Popover } from 'antd';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { subscribeToRealtimeStream } from '../../../services/realtimeStream';
import { useReceptionCaseWork } from './ReceptionCaseWork';
import '../../../styles/reception-work.css';

export function ReceptionWorkBell({ onFindAppointment = () => undefined }: { onFindAppointment?: (code: string) => void }) {
  const { stream } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [arrival, setArrival] = useState(0);
  const onArrival = useCallback(() => setArrival(n => n + 1), []);
  const cases = useReceptionCaseWork(onArrival, onFindAppointment);
  useEffect(() => {
    if (!stream) return;
    const signal = (category: string) => window.dispatchEvent(new CustomEvent('reception-work-changed', { detail: category }));
    return subscribeToRealtimeStream({ url: '/api/notifications/reception/work-stream', streamFn: stream,
      onEvent: event => signal((event as unknown as { category?: string }).category ?? 'all'),
      onStatusChange: status => { if (status === 'CONNECTED') signal('all'); } });
  }, [stream]);
  return <>
    <span className="reception-reviews-sr" aria-live="polite">{arrival > 0 ? 'Có thông tin tiếp nhận mới.' : ''}</span>
    <Popover trigger="click" open={open} onOpenChange={setOpen} content={cases.panel} placement="bottomRight">
      <Badge count={cases.available} overflowCount={99}><Button key={arrival} className={arrival ? 'reception-review-arrival' : ''} aria-label={`Công việc tiếp nhận, ${cases.available} cần chú ý`} icon={<BellOutlined />} /></Badge>
    </Popover>
  </>;
}
