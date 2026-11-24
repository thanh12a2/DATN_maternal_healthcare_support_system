import { useEffect, useState, type FormEvent } from 'react';
import type { Requester } from '../../../services/catalog';
import {
  createDoctor, updateDoctor, linkDoctorSpecialty, unlinkDoctorSpecialty,
  type DoctorItem, type SpecialtyItem,
} from '../../../services/adminDoctors';
import type { ManagedStaff } from '../../../services/clinicManager';
import { uploadProfileImage } from '../../../services/profileImages';

export function DoctorProfileManager({ request, selected, doctors, staff, specialties, refresh }: {
  request: Requester; selected: DoctorItem | null; doctors: DoctorItem[];
  staff: ManagedStaff[]; specialties: SpecialtyItem[]; refresh: () => Promise<void>;
}) {
  const [accountId, setAccountId] = useState('');
  const [licenseNumber, setLicense] = useState('');
  const [fullName, setName] = useState('');
  const [biography, setBiography] = useState('');
  const [practiceStartYear, setYear] = useState('');
  const [specialtyId, setSpecialty] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setName(selected?.profile?.fullName ?? '');
    setBiography(selected?.profile?.biography ?? '');
    setYear(selected?.profile?.practiceStartYear ? String(selected.profile.practiceStartYear) : '');
    setSpecialty(selected?.specialties?.find(s => s.isPrimary)?.id ?? '');
    setNotice('');
  }, [selected?.id]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice('');
    try { await action(); await refresh(); setNotice(success); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể cập nhật bác sĩ.'); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected) await run(() => updateDoctor(request, selected.id, selected.version, {
      profile: { fullName, biography, ...(practiceStartYear ? { practiceStartYear: Number(practiceStartYear) } : {}) },
    }), 'Đã cập nhật hồ sơ bác sĩ.');
    else await run(() => createDoctor(request, {
      accountId, licenseNumber, profile: { fullName, biography,
        ...(practiceStartYear ? { practiceStartYear: Number(practiceStartYear) } : {}) },
      ...(specialtyId ? { specialtyId } : {}),
    }), 'Đã tạo hồ sơ bác sĩ.');
  }

  const unusedAccounts = staff.filter(s => s.role === 'DOCTOR' && !doctors.some(d => d.accountId === s.userId));
  return <div className="clinic-form clinic-compact-form">
    <strong>{selected ? 'Hồ sơ bác sĩ' : 'Tạo hồ sơ bác sĩ từ tài khoản nhân sự'}</strong>
    <form className="clinic-form" onSubmit={e => void submit(e)}>
      {!selected && <><label>Tài khoản bác sĩ<select required value={accountId} onChange={e => setAccountId(e.target.value)}><option value="">Chọn tài khoản chưa có hồ sơ</option>{unusedAccounts.map(s => <option key={s.userId} value={s.userId}>{s.email}</option>)}</select></label><label>Số CCHN<input required value={licenseNumber} onChange={e => setLicense(e.target.value)} /></label></>}
      <label>Họ tên<input required minLength={2} value={fullName} onChange={e => setName(e.target.value)} /></label>
      <label>Tiểu sử<textarea value={biography} onChange={e => setBiography(e.target.value)} /></label>
      <label>Năm bắt đầu hành nghề<input type="number" min={1950} max={new Date().getFullYear()} value={practiceStartYear} onChange={e => setYear(e.target.value)} /></label>
      {!selected && <label>Chuyên khoa chính<select value={specialtyId} onChange={e => setSpecialty(e.target.value)}><option value="">Chưa gán</option>{specialties.filter(s => s.status === 'ACTIVE').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      <button disabled={busy || (!selected && !unusedAccounts.length)}>{selected ? 'Lưu hồ sơ' : 'Tạo hồ sơ'}</button>
      {!selected && !unusedAccounts.length && <small>Tạo tài khoản bác sĩ ở mục Nhân sự trước khi lập hồ sơ.</small>}
    </form>
    {selected && <div className="clinic-form clinic-compact-form"><strong>Chuyên khoa của bác sĩ</strong>
      {selected.specialties?.map(s => <div className="clinic-schedule-row" key={s.id}><span>{s.name}{s.isPrimary ? ' · chính' : ''}</span><button type="button" className="clinic-link" disabled={busy} onClick={() => void run(() => unlinkDoctorSpecialty(request, selected.id, s.id), 'Đã bỏ chuyên khoa.')}>Bỏ gán</button></div>)}
      <select value={specialtyId} onChange={e => setSpecialty(e.target.value)}><option value="">Chọn chuyên khoa</option>{specialties.filter(s => s.status === 'ACTIVE' && !selected.specialties?.some(x => x.id === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <button type="button" disabled={busy || !specialtyId || selected.specialties?.some(s => s.id === specialtyId)} onClick={() => void run(() => linkDoctorSpecialty(request, selected.id, specialtyId, !selected.specialties?.length), 'Đã gán chuyên khoa.')}>Gán chuyên khoa</button>
    </div>}
    {selected && <div className="clinic-form clinic-compact-form"><strong>Ảnh đại diện bác sĩ</strong>
      <small>{selected.profile?.photoUrl ? 'Đã có ảnh đại diện.' : 'Chưa có ảnh đại diện.'} JPG, PNG hoặc WebP, tối đa 5 MB.</small>
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (file.size > 5 * 1024 * 1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)) { setNotice('Ảnh phải là JPG, PNG hoặc WebP và không quá 5 MB.'); return; } void run(() => uploadProfileImage(request, `/api/doctors/${selected.id}/photo`, file), 'Đã tải ảnh bác sĩ lên server.'); }} />
      {selected.profile?.photoUrl && <button type="button" className="is-danger" disabled={busy} onClick={() => void run(() => request(`/api/doctors/${selected.id}/photo`, { method: 'DELETE' }), 'Đã xóa ảnh bác sĩ.')}>Xóa ảnh</button>}
    </div>}
    {notice && <p className="clinic-note" role="status">{notice}</p>}
  </div>;
}
