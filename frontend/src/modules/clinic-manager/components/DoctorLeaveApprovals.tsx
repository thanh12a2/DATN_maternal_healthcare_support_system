import { useEffect, useState } from 'react';
import type { Requester } from '../../../services/catalog';
import { ApiError } from '../../../services/api';
import {
  cancelDoctorLeave, listDoctorLeaveRequests, reviewDoctorLeave,
  type DoctorLeaveRequest,
} from '../../../services/doctor';

const reasonNames: Record<string, string> = {
  PERSONAL_LEAVE: 'Việc cá nhân', SICK_LEAVE: 'Nghỉ ốm',
  TRAINING: 'Đào tạo', EMERGENCY: 'Khẩn cấp', OTHER: 'Khác',
};
const statusNames: Record<string, string> = {
  PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', CANCELLED: 'Đã hủy',
};
const workTime = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
}).format(new Date(value));

export function DoctorLeaveApprovals({ request, onChanged }: {
  request: Requester; onChanged: () => Promise<void>;
}) {
  const [items, setItems] = useState<DoctorLeaveRequest[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  async function reload() {
    const rows = await listDoctorLeaveRequests(request);
    setItems(rows);
    setLoading(false);
  }
  useEffect(() => {
    void reload().catch(error => {
      setNotice(error instanceof Error ? error.message : 'Không tải được yêu cầu nghỉ ca.');
      setLoading(false);
    });
  }, [request]);

  async function decide(item: DoctorLeaveRequest, action: 'approve' | 'reject' | 'cancel') {
    const reason = reasons[item.id]?.trim() ?? '';
    if (action === 'reject' && reason.length < 3) {
      setNotice('Nhập lý do từ chối ít nhất 3 ký tự.');
      return;
    }
    if (action === 'cancel' && reason.length < 3) {
      setNotice('Nhập lý do hủy ít nhất 3 ký tự.');
      return;
    }
    setBusyId(item.id);
    setNotice('');
    try {
      if (action === 'cancel') await cancelDoctorLeave(request, item, reason);
      else await reviewDoctorLeave(request, item, action === 'approve', reason);
      await Promise.all([reload(), onChanged()]);
      setNotice(action === 'approve' ? 'Đã duyệt nghỉ ca. Giờ của ca này không còn cho bệnh nhân đặt.' :
        action === 'reject' ? 'Đã từ chối yêu cầu. Ca làm vẫn được mở để đặt lịch.' : 'Đã hủy quyết định nghỉ ca.');
    } catch (error) {
      setNotice(error instanceof ApiError && error.code === 'SHIFT_HAS_APPOINTMENTS'
        ? 'Ca đã có lịch hẹn. Hãy đổi hoặc hủy các lịch hẹn trong ca trước khi duyệt nghỉ.'
        : error instanceof Error ? error.message : 'Không thể xử lý yêu cầu.');
      await reload().catch(() => undefined);
    } finally {
      setBusyId('');
    }
  }

  const pending = items.filter(item => item.status === 'PENDING');
  const history = items.filter(item => item.status !== 'PENDING');
  const visibleItems = showHistory ? [...pending, ...history] : pending;
  return <section className="clinic-card clinic-leave-approvals">
    <div className="clinic-card-head"><div><h2>Yêu cầu nghỉ ca {pending.length ? `(${pending.length} chờ duyệt)` : ''}</h2>
      <p>Bác sĩ xin nghỉ ca đã xếp. Chỉ yêu cầu được duyệt mới chặn giờ đặt lịch của bệnh nhân.</p></div>
      <div className="clinic-leave-head-actions">{history.length > 0 && <button type="button" className="clinic-small-action" aria-expanded={showHistory} onClick={() => setShowHistory(value => !value)}>{showHistory ? 'Ẩn lịch sử' : `Xem lịch sử (${history.length})`}</button>}
        <button type="button" className="clinic-link" onClick={() => void reload()}>Làm mới</button></div></div>
    {loading ? <p className="clinic-muted">Đang tải yêu cầu…</p> : !visibleItems.length ? <p className="clinic-leave-empty">Không có yêu cầu nghỉ ca chờ duyệt.</p> :
      <div className="clinic-leave-list">{visibleItems.map(item =>
        <div className="clinic-leave-row" key={item.id}>
          <div><strong>{item.doctor?.profile?.fullName || 'Bác sĩ'} · {new Date(item.workDate).toLocaleDateString('vi-VN')}</strong>
            <span>{workTime(item.startAt)}–{workTime(item.endAt)} · {reasonNames[item.reasonCode] ?? item.reasonCode}</span>
            {item.note && <small>{item.note}</small>}
            {item.reviewReason && <small>Phản hồi: {item.reviewReason}</small>}
          </div>
          <span className={`clinic-leave-status is-${item.status.toLowerCase()}`}>{statusNames[item.status]}</span>
          {(item.status === 'PENDING' || item.status === 'APPROVED') &&
            <div className="clinic-leave-actions"><input aria-label={`Lý do xử lý yêu cầu của ${item.doctor?.profile?.fullName || 'bác sĩ'}`} placeholder="Lý do từ chối / hủy" maxLength={500}
              value={reasons[item.id] ?? ''} onChange={event => setReasons(previous => ({ ...previous, [item.id]: event.target.value }))} />
              {item.status === 'PENDING' ? <><button disabled={!!busyId} onClick={() => void decide(item, 'approve')}>Duyệt nghỉ</button>
                <button disabled={!!busyId} onClick={() => void decide(item, 'reject')}>Từ chối</button></> :
                <button disabled={!!busyId} onClick={() => void decide(item, 'cancel')}>Hủy duyệt</button>}
            </div>}
        </div>)}</div>}
    {notice && <p className="clinic-note" role="status">{notice}</p>}
  </section>;
}
