import { useState } from 'react';
import { getPatientPreferences, deletePatientPreferences, type PatientPreferences as Preferences, type ChatRequest, type ChatPersonalization } from '../../../../services/chatbot';
const period = { any:'Bất kỳ buổi', morning:'Buổi sáng', afternoon:'Buổi chiều', evening:'Buổi tối' };
function Values({ value }: { value: Preferences }) {
  return <>
    {value.values.preferredSelectionMode && <p>{value.values.preferredSelectionMode === 'RANK' ? 'Bệnh viện sắp xếp · Hạng cơ bản' : 'Thích chọn bác sĩ; vẫn cần chọn tên cụ thể'}</p>}
    {value.values.preferredPeriod && <p>{period[value.values.preferredPeriod]}</p>}
    {!Object.keys(value.values).length && <p>Chưa có sở thích đặt khám đã lưu.</p>}
    {value.expiresAt && <p>Lưu đến: {new Date(value.expiresAt).toLocaleString('vi-VN')}</p>}
  </>;
}
export function PatientPreferences({ request, onChanged }: { request: ChatRequest; onChanged?: () => void }) {
  const [value,setValue]=useState<Preferences | null>(null);
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function read(remove=false) {
    setBusy(true); setError('');
    try { setValue(await (remove ? deletePatientPreferences(request) : getPatientPreferences(request))); if(remove) onChanged?.(); }
    catch { setError('Chưa đọc hoặc xóa được sở thích. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  return <div className="chatbot-preferences">
    <button type="button" aria-expanded={!!value} disabled={busy} onClick={()=>value ? setValue(null) : read()}>Sở thích đặt khám</button>
    {busy && <span role="status">Đang cập nhật…</span>}
    {value && <div className="chatbot-preferences-panel" aria-label="Sở thích đặt khám của tôi"><strong>Bạn tự khai — không phải bệnh án</strong>
      <Values value={value} /><p>Chỉ lưu khi bạn yêu cầu “ghi nhớ”. Phiên chat và sở thích được xóa riêng.</p>
      <button type="button" disabled={busy || !Object.keys(value.values).length} onClick={()=>read(true)}>Xóa sở thích đã lưu</button>
      <button type="button" onClick={()=>setValue(null)}>Đóng sở thích</button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
export function PersonalizationNotice({ value }: { value: ChatPersonalization }) {
  return <aside className="chatbot-preferences" aria-label="Nguồn thông tin cá nhân hóa">
    {value.official && <><strong>Dữ liệu chính thức — hệ thống</strong>
      <p>Hồ sơ cơ bản: {value.official.profileStatus === 'COMPLETE' ? 'Đã có' : 'Chưa có'}</p>
      {value.official.lastCompleted && <p>Lần khám đã hoàn thành gần nhất kết thúc: {new Date(value.official.lastCompleted.endAt).toLocaleString('vi-VN')}</p>}
      <p>Đối chiếu: {new Date(value.official.checkedAt).toLocaleString('vi-VN')}</p>
    </>}
    <details><summary>Sở thích do bạn tự khai tại lượt này</summary><Values value={value.userDeclared} /></details>
    <p>{value.aiSummary}</p>
  </aside>;
}
