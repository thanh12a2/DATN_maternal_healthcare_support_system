import { useEffect, useState, type FormEvent } from 'react';
import type { Requester } from '../../../services/catalog';
import {
  activateCategory, activateTag, cancelRankSurcharge, createCategory, createTag,
  deactivateCategory, deactivateTag, listAdminCategories, listAdminTags,
  listRankSurcharges, scheduleRankSurcharge,
  type ServiceCategoryItem, type CatalogTagItem, type DoctorRankSurchargeItem,
  type TagGroup,
} from '../../../services/adminCatalog';

export function CatalogMetadataManager({ request }: { request: Requester }) {
  const [categories, setCategories] = useState<ServiceCategoryItem[]>([]);
  const [tags, setTags] = useState<CatalogTagItem[]>([]);
  const [surcharges, setSurcharges] = useState<DoctorRankSurchargeItem[]>([]);
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [tagCode, setTagCode] = useState('');
  const [tagName, setTagName] = useState('');
  const [tagGroup, setTagGroup] = useState<TagGroup>('LABEL');
  const [rankCode, setRankCode] = useState('');
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function reload() {
    const [c, t, s] = await Promise.all([listAdminCategories(request), listAdminTags(request), listRankSurcharges(request)]);
    setCategories(c); setTags(t); setSurcharges(s);
  }
  useEffect(() => { void reload().catch(error => setNotice(error instanceof Error ? error.message : 'Không tải được danh mục.')); }, [request]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice('');
    try { await action(); await reload(); setNotice(success); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể cập nhật danh mục.'); }
    finally { setBusy(false); }
  }
  function createCategoryForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); void run(async () => { await createCategory(request, { code: categoryCode.trim(), name: categoryName.trim() }); setCategoryCode(''); setCategoryName(''); }, 'Đã tạo nhóm dịch vụ.');
  }
  function createTagForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); void run(async () => { await createTag(request, { code: tagCode.trim(), name: tagName.trim(), group: tagGroup }); setTagCode(''); setTagName(''); }, 'Đã tạo thẻ.');
  }
  return <div className="clinic-metadata-grid">
    <article className="clinic-card"><h2>Nhóm dịch vụ ({categories.length})</h2><div className="clinic-metadata-list">{categories.map(c => <div className="clinic-schedule-row" key={c.id}><span>{c.name} · {c.code} · {c.status}</span><button className="clinic-link" disabled={busy} onClick={() => void run(() => c.status === 'ACTIVE' ? deactivateCategory(request, c.id) : activateCategory(request, c.id), 'Đã cập nhật nhóm dịch vụ.')}>{c.status === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}</button></div>)}</div><form className="clinic-form" onSubmit={createCategoryForm}><input required minLength={2} value={categoryCode} onChange={e => setCategoryCode(e.target.value)} placeholder="Mã nhóm" /><input required minLength={2} value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="Tên nhóm" /><button disabled={busy}>Thêm nhóm</button></form></article>
    <article className="clinic-card"><h2>Thẻ dịch vụ ({tags.length})</h2><div className="clinic-metadata-list">{tags.map(t => <div className="clinic-schedule-row" key={t.id}><span>{t.name} · {t.group} · {t.status}</span><button className="clinic-link" disabled={busy} onClick={() => void run(() => t.status === 'ACTIVE' ? deactivateTag(request, t.id) : activateTag(request, t.id), 'Đã cập nhật thẻ.')}>{t.status === 'ACTIVE' ? 'Tạm ngưng' : 'Kích hoạt'}</button></div>)}</div><form className="clinic-form" onSubmit={createTagForm}><input required minLength={2} value={tagCode} onChange={e => setTagCode(e.target.value)} placeholder="Mã thẻ" /><input required minLength={2} value={tagName} onChange={e => setTagName(e.target.value)} placeholder="Tên thẻ" /><select value={tagGroup} onChange={e => setTagGroup(e.target.value as TagGroup)}>{['LABEL', 'AUDIENCE', 'FEATURE', 'AGE', 'GENDER'].map(g => <option key={g} value={g}>{g}</option>)}</select><button disabled={busy}>Thêm thẻ</button></form></article>
    <article className="clinic-card"><h2>Phụ thu hạng bác sĩ</h2><div className="clinic-metadata-list">{surcharges.map(s => <div className="clinic-schedule-row" key={s.id}><span>{s.rankCode} · {Number(s.amountMinor).toLocaleString('vi-VN')} VND · {s.status}</span>{s.status === 'SCHEDULED' && <button className="clinic-link" disabled={busy} onClick={() => void run(() => cancelRankSurcharge(request, s.id), 'Đã hủy phụ thu.')}>Hủy</button>}</div>)}</div><form className="clinic-form" onSubmit={e => { e.preventDefault(); void run(() => scheduleRankSurcharge(request, { rankCode, amountMinor: Number(amount), currency: 'VND', effectiveFrom: new Date(`${from}T00:00:00+07:00`).toISOString() }), 'Đã lên lịch phụ thu.'); }}><input required minLength={2} value={rankCode} onChange={e => setRankCode(e.target.value)} placeholder="Mã hạng bác sĩ" /><input required min={0} type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Phụ thu VND" /><input required type="date" value={from} onChange={e => setFrom(e.target.value)} /><button disabled={busy}>Lên lịch phụ thu</button></form></article>
    {notice && <p className="clinic-note" role="status">{notice}</p>}
  </div>;
}
