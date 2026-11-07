import { useEffect, useState } from 'react';
import { CheckCircleOutlined as CheckCircle2, RightOutlined as ChevronRight, ProfileOutlined as ClipboardList, FileTextOutlined as FileText, LoadingOutlined as LoaderCircle, PlusOutlined as Plus, SearchOutlined as Search, DeleteOutlined as Trash2, WarningOutlined as TriangleAlert, CloseOutlined as X } from '@ant-design/icons';
import { createPrescription, createTreatmentPlan, listMedications, listPrescriptions, listTreatmentPlans, prescriptionAction, treatmentPlanAction, updatePrescription, updateTreatmentPlan } from '../../../services/clinical';
import type { Medication, Prescription, TreatmentPlan } from '../../../services/clinical';
import type { Requester } from '../../../services/catalog';
import '../../../styles/doctor-clinical-resources.css';

type Item = Record<string, any>;
type Resource = Prescription | TreatmentPlan;
type Line = { title: string; dose: string; route: string; frequency: string; durationDays: string; instruction: string; medicationCode: string; planType: string; dueAt: string; original: Item };
type Props = { request: Requester; encounterId: string; patientId?: string; encounterState?: string; kind: 'prescriptions' | 'plans' };

const blankLine = (): Line => ({ title: '', dose: '', route: '', frequency: '', durationDays: '', instruction: '', medicationCode: '', planType: 'CARE_INSTRUCTION', dueAt: '', original: {} });
const labels: Record<string, string> = { DRAFT: 'Bản nháp', ISSUED: 'Đã kê đơn', DISPENSED: 'Đã cấp thuốc', CANCELLED: 'Đã hủy', ACTIVE: 'Đang thực hiện', COMPLETED: 'Đã hoàn thành', DONE: 'Đã hoàn thành', PENDING: 'Chưa thực hiện', IN_PROGRESS: 'Đang thực hiện' };
const planTypes: Record<string, string> = { CARE_INSTRUCTION: 'Hướng dẫn chăm sóc', CONSULTATION: 'Tư vấn', DELIVERY: 'Sinh con', LAB_TEST: 'Xét nghiệm', MEDICATION: 'Điều trị bằng thuốc', ULTRASOUND: 'Siêu âm', VACCINATION: 'Tiêm chủng' };
const statusLabel = (value: unknown) => labels[String(value)] || String(value || 'Chưa cập nhật');
const formatDate = (value: unknown) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleDateString('vi-VN');
};
const localDateTime = (value: unknown) => {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number: number) => String(number).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
};
const formatDateTime = (value: unknown) => {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
};
const message = (error: unknown) => {
  const raw = error instanceof Error ? error.message : '';
  if (raw.includes('VERSION_CONFLICT')) return 'Dữ liệu đã được cập nhật ở phiên khác. Tải lại danh sách trước khi thử lại.';
  if (raw.includes('MEDICATION_NOT_AVAILABLE')) return 'Thuốc đã chọn không còn hoạt động. Vui lòng chọn thuốc khác từ danh mục.';
  if (raw.includes('ENCOUNTER_NOT_IN_PROGRESS') || raw.includes('INVALID_STATE')) return 'Trạng thái hiện tại không cho phép thao tác này. Vui lòng tải lại hồ sơ.';
  return raw || 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
};
const toLine = (item: Item, prescriptions: boolean): Line => ({
  title: String((prescriptions ? item.medicationName : item.title) || ''),
  dose: String(item.dose || ''), route: String(item.route || ''), frequency: String(item.frequency || ''),
  durationDays: String(item.durationDays || ''),
  instruction: String((prescriptions ? item.instruction : item.description) || ''),
  planType: String(item.type || 'CARE_INSTRUCTION'), dueAt: localDateTime(item.dueAt),
  medicationCode: String(item.medicationCode || ''), original: item,
});

export function DoctorClinicalResources({ request, encounterId, patientId, encounterState, kind }: Props) {
  const prescriptions = kind === 'prescriptions';
  const [rows, setRows] = useState<Resource[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<'create' | 'edit' | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [catalog, setCatalog] = useState<Medication[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    const queryString = new URLSearchParams({ encounterId }).toString();
    (prescriptions ? listPrescriptions(request, queryString) : listTreatmentPlans(request, queryString))
      .then((data) => {
        if (!live) return;
        setRows(data);
        setSelectedId((current) => data.some((item) => item.id === current) ? current : String(data[0]?.id || ''));
      })
      .catch((err) => { if (live) setError(message(err)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [request, encounterId, prescriptions, revision]);

  useEffect(() => { setForm(null); setSelectedId(''); setCancelOpen(false); setNotice(''); setActionError(''); }, [encounterId, kind]);

  useEffect(() => {
    if (!prescriptions || !form) return;
    let live = true;
    setCatalogLoading(true); setCatalogError('');
    listMedications(request).then((data) => { if (live) setCatalog(data); })
      .catch((err) => { if (live) setCatalogError(message(err)); })
      .finally(() => { if (live) setCatalogLoading(false); });
    return () => { live = false; };
  }, [request, prescriptions, form, catalogRevision]);

  const selected = rows.find((row) => row.id === selectedId) as Item | undefined;
  const editable = encounterState === 'IN_PROGRESS';
  const manageable = editable || encounterState === 'FINALIZED';
  const lockedReason = !patientId ? 'Hồ sơ chưa có bệnh nhân để lập chỉ định.' : encounterState === 'DRAFT' ? 'Cần bắt đầu khám trước khi lập hoặc chỉnh sửa chỉ định.' : 'Trạng thái lượt khám hiện tại không cho phép tạo hoặc chỉnh sửa bản nháp.';
  const resourceName = prescriptions ? 'đơn thuốc' : 'kế hoạch điều trị';
  const selectedItems = Array.isArray(selected?.items) ? selected.items as Item[] : [];

  function startForm(mode: 'create' | 'edit') {
    setActionError(''); setNotice(''); setCancelOpen(false); setPickerIndex(null); setQuery(''); setChangeReason(''); setEffectiveFrom(''); setEffectiveTo('');
    setTitle(mode === 'edit' && !prescriptions ? String(selected?.title || '') : '');
    setNote(mode === 'edit' ? String((prescriptions ? selected?.note : selected?.summary) || '') : '');
    setLines(mode === 'edit' && selectedItems.length ? selectedItems.map((item) => toLine(item, prescriptions)) : [blankLine()]);
    setForm(mode);
  }

  function updateLine(index: number, changes: Partial<Line>) {
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...changes } : line));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const editingActivePlan = !prescriptions && form === 'edit' && selected?.status === 'ACTIVE';
    if ((!editable && !(editingActivePlan && manageable)) || !patientId || busy) return;
    if (editingActivePlan && !changeReason.trim()) { setActionError('Vui lòng nhập lý do thay đổi kế hoạch đang thực hiện.'); return; }
    if (!prescriptions && effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) { setActionError('Ngày kết thúc phải từ ngày bắt đầu trở đi.'); return; }
    if (!prescriptions && !title.trim()) { setActionError('Vui lòng nhập tên kế hoạch.'); return; }
    if (lines.some((line) => !line.title.trim() || (prescriptions && (!line.dose.trim() || !line.route.trim() || !line.frequency.trim())))) {
      setActionError(prescriptions ? 'Vui lòng chọn thuốc và nhập liều dùng, đường dùng, tần suất cho từng thuốc.' : 'Vui lòng nhập tên cho từng nội dung điều trị.'); return;
    }
    if (prescriptions && lines.some((line) => !line.medicationCode && !line.original.id)) {
      setActionError('Vui lòng chọn thuốc mới từ danh mục.'); return;
    }
    setBusy(true); setActionError('');
    const items = lines.map((line) => prescriptions ? {
      ...line.original, medicationCode: line.medicationCode || null, medicationName: line.title.trim(),
      dose: line.dose.trim(), route: line.route.trim(), frequency: line.frequency.trim(), durationDays: line.durationDays ? Number(line.durationDays) : null, instruction: line.instruction.trim(),
    } : { ...line.original, type: line.planType, title: line.title.trim(), description: line.instruction.trim(), dueAt: line.dueAt === localDateTime(line.original.dueAt) ? line.original.dueAt || null : line.dueAt ? new Date(line.dueAt).toISOString() : null });
    try {
      if (prescriptions) {
        if (form === 'edit') await updatePrescription(request, selectedId, { version: selected?.version, items });
        else await createPrescription(request, { encounterId, patientId, items });
      } else if (form === 'edit') await updateTreatmentPlan(request, selectedId, { version: selected?.version, title: title.trim(), summary: note.trim(), items, ...(editingActivePlan ? { reason: changeReason.trim() } : {}) });
      else await createTreatmentPlan(request, { encounterId, patientId, title: title.trim(), summary: note.trim(), ...(effectiveFrom ? { effectiveFrom } : {}), ...(effectiveTo ? { effectiveTo } : {}), items });
      if (form === 'create') setSelectedId('');
      setForm(null); setNotice('Đã lưu ' + resourceName + '.'); setRevision((value) => value + 1);
    } catch (err) { setActionError(message(err)); }
    finally { setBusy(false); }
  }

  async function act(action: string, itemId?: string) {
    if (!selected || busy) return;
    setBusy(true); setActionError('');
    try {
      if (prescriptions) await prescriptionAction(request, selectedId, action, { version: selected.version, ...(action === 'cancel' ? { reason: cancelReason.trim() } : {}) });
      else await treatmentPlanAction(request, selectedId, action, { version: selected.version, ...(action === 'cancel' ? { reason: cancelReason.trim() } : {}) }, itemId);
      setCancelOpen(false); setCancelReason(''); setNotice('Đã cập nhật ' + resourceName + '.'); setRevision((value) => value + 1);
    } catch (err) { setActionError(message(err)); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="clinical-loading" aria-label="Đang tải dữ liệu"><span /><span /><span /></div>;
  if (error) return <div className="clinical-state"><TriangleAlert style={{ fontSize: 24 }} /><h3>Không thể tải {resourceName}</h3><p>{error}</p><button className="clinical-button" onClick={() => setRevision((value) => value + 1)}>Thử lại</button></div>;

  return <section className="clinical-resources">
    <div className="clinical-heading">
      <div><span className="clinical-eyebrow">CHỈ ĐỊNH KHÁM</span><h3>{prescriptions ? 'Đơn thuốc' : 'Kế hoạch điều trị'}</h3><p>{prescriptions ? 'Theo dõi và kê đơn cho lần khám đang chọn.' : 'Theo dõi các nội dung điều trị của lần khám đang chọn.'}</p></div>
      <button className="clinical-button clinical-button-primary" disabled={!editable || !patientId || busy} title={!editable || !patientId ? lockedReason : undefined} onClick={() => startForm('create')}><Plus style={{ fontSize: 16 }} /> {prescriptions ? 'Tạo đơn thuốc' : 'Tạo kế hoạch điều trị'}</button>
    </div>
    {(!editable || !patientId) && <p className="clinical-hint">{lockedReason}</p>}
    {notice && <div className="clinical-notice" role="status"><CheckCircle2 style={{ fontSize: 17 }} />{notice}</div>}
    {actionError && <div className="clinical-error" role="alert"><TriangleAlert style={{ fontSize: 17 }} />{actionError} <button type="button" className="clinical-link" onClick={() => { setActionError(''); setRevision((value) => value + 1); }}>Tải lại dữ liệu</button></div>}
    <div className="clinical-layout">
      <aside className="clinical-list">
        <div className="clinical-list-heading"><span>Danh sách</span><span className="clinical-count">{rows.length}</span></div>
        {rows.length === 0 ? <div className="clinical-list-empty"><ClipboardList style={{ fontSize: 24 }} /><strong>Chưa có {resourceName}</strong><span>{editable && patientId ? 'Tạo mới để bắt đầu ghi nhận chỉ định.' : 'Dữ liệu sẽ hiển thị khi có chỉ định cho lần khám này.'}</span></div>
          : rows.map((row, index) => { const item = row as Item; return <button type="button" className={'clinical-list-item' + (row.id === selectedId && !form ? ' is-selected' : '')} key={String(row.id || index)} onClick={() => { setSelectedId(String(row.id)); setForm(null); setCancelOpen(false); setActionError(''); }}>
            <span className="clinical-list-icon">{prescriptions ? <FileText style={{ fontSize: 18 }} /> : <ClipboardList style={{ fontSize: 18 }} />}</span>
            <span className="clinical-list-copy"><strong>{prescriptions ? 'Đơn thuốc ' + (index + 1) : String(item.title || 'Kế hoạch điều trị')}</strong><small>{formatDate(item.createdAt)} · {Array.isArray(item.items) ? item.items.length : 0} {prescriptions ? 'thuốc' : 'nội dung'}</small><span className={'clinical-status status-' + String(item.status || '').toLowerCase()}>{statusLabel(item.status)}</span></span><ChevronRight style={{ fontSize: 16 }} />
          </button>; })}
      </aside>
      <div className="clinical-detail">
        {form ? <form onSubmit={submit} className="clinical-form">
          <div className="clinical-detail-header"><div><span className="clinical-eyebrow">{form === 'edit' ? 'CHỈNH SỬA' : 'TẠO MỚI'}</span><h4>{prescriptions ? 'Thông tin đơn thuốc' : 'Thông tin kế hoạch'}</h4><p>Thông tin được lưu vào hồ sơ của lần khám này.</p></div><button type="button" className="clinical-icon-button" aria-label="Đóng biểu mẫu" onClick={() => setForm(null)}><X style={{ fontSize: 19 }} /></button></div>
          {!prescriptions && <label className="clinical-field">Tên kế hoạch<input aria-label="Tên kế hoạch" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhập tên kế hoạch" /></label>}
          {!prescriptions && <label className="clinical-field">Tóm tắt kế hoạch<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Mục tiêu và hướng theo dõi" rows={2} /></label>}
          {!prescriptions && form === 'create' && <div className="clinical-field-grid clinical-date-fields"><label className="clinical-field">Có hiệu lực từ<input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /><span>Để trống để bắt đầu từ hôm nay.</span></label><label className="clinical-field">Đến ngày<input type="date" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} /><span>Không bắt buộc.</span></label></div>}
          {!prescriptions && form === 'edit' && selected?.status === 'ACTIVE' && <label className="clinical-field">Lý do thay đổi<textarea value={changeReason} onChange={(event) => setChangeReason(event.target.value)} placeholder="Nhập lý do điều chỉnh kế hoạch" rows={2} /></label>}
          <div className="clinical-section-heading"><div><h5>{prescriptions ? 'Thuốc trong đơn' : 'Nội dung điều trị'}</h5><p>{prescriptions ? 'Chọn thuốc từ danh mục và nhập chỉ định cụ thể.' : 'Ghi nhận từng nội dung cần thực hiện.'}</p></div><span className="clinical-count">{lines.length}</span></div>
          {prescriptions && catalogError && <div className="clinical-error" role="alert">Không tải được danh mục thuốc: {catalogError} <button type="button" className="clinical-link" onClick={() => setCatalogRevision((value) => value + 1)}>Thử lại</button></div>}
          {lines.map((line, index) => {
            const medication = catalog.find((entry) => entry.code === line.medicationCode);
            const matches = catalog.filter((entry) => [entry.name, entry.code, entry.activeIngredient, entry.strength].some((value) => String(value || '').toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))));
            return <div className="clinical-line" key={index}>
              <div className="clinical-line-heading"><strong>{prescriptions ? 'Thuốc' : 'Nội dung'} {index + 1}</strong>{lines.length > 1 && !(selected?.status === 'ACTIVE' && line.original.id) && <button type="button" className="clinical-icon-button" aria-label={'Xóa ' + (prescriptions ? 'thuốc ' : 'nội dung ') + (index + 1)} onClick={() => { setLines(lines.filter((_, i) => i !== index)); setPickerIndex(null); }}><Trash2 style={{ fontSize: 16 }} /></button>}</div>
              {prescriptions ? <>
                <div className="clinical-field">Thuốc từ danh mục
                  <button type="button" className="clinical-picker-trigger" onClick={() => { setPickerIndex(pickerIndex === index ? null : index); setQuery(''); }}><span>{line.title || 'Tìm và chọn thuốc'}</span><Search style={{ fontSize: 17 }} /></button>
                  {line.medicationCode && !catalogLoading && !catalogError && !medication && <span className="clinical-inline-warning">Thuốc này không còn trong danh mục đang hoạt động. Hãy chọn thuốc khác trước khi lưu.</span>}
                  {!line.medicationCode && line.original.id && <span className="clinical-inline-warning">Thuốc cũ chưa liên kết danh mục. Chọn thuốc từ danh mục nếu cần cập nhật.</span>}
                  {pickerIndex === index && <div className="clinical-picker">
                    <label className="clinical-search"><Search style={{ fontSize: 16 }} /><input autoFocus aria-label="Tìm thuốc trong danh mục" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên thuốc, hoạt chất hoặc mã thuốc" /></label>
                    {catalogLoading ? <p className="clinical-picker-message">Đang tải danh mục thuốc...</p> : catalogError ? <p className="clinical-picker-message">Không thể tải danh mục thuốc.</p> : matches.length === 0 ? <p className="clinical-picker-message">Không tìm thấy thuốc phù hợp.</p> : <div className="clinical-picker-results">{matches.map((entry) => <button type="button" key={entry.code} onClick={() => { updateLine(index, { title: entry.name, medicationCode: entry.code, route: entry.route || '', dose: '', frequency: '', original: { ...line.original, medicationCode: entry.code, strength: entry.strength, dosageForm: entry.dosageForm } }); setPickerIndex(null); }}><strong>{entry.name}</strong><span>{[entry.activeIngredient, entry.strength, entry.dosageForm].filter(Boolean).join(' · ')}</span></button>)}</div>}
                  </div>}
                </div>
                {medication && <div className="clinical-medication-info"><div><strong>{medication.name}</strong><span>{[medication.activeIngredient, medication.strength, medication.dosageForm].filter(Boolean).join(' · ')}</span></div>{medication.pregnancyCategory && <span className="clinical-category">Thai kỳ: {medication.pregnancyCategory.replace('CATEGORY_', 'nhóm ')}</span>}{medication.pregnancyWarning && <p><TriangleAlert style={{ fontSize: 15 }} />{medication.pregnancyWarning}</p>}</div>}
                <div className="clinical-field-grid"><label className="clinical-field">Liều dùng<input aria-label={'Liều dùng ' + (index + 1)} value={line.dose} onChange={(event) => updateLine(index, { dose: event.target.value })} placeholder="Nhập liều dùng" /></label><label className="clinical-field">Đường dùng<input aria-label={'Đường dùng ' + (index + 1)} value={line.route} onChange={(event) => updateLine(index, { route: event.target.value })} placeholder="Nhập đường dùng" /></label><label className="clinical-field">Tần suất<input aria-label={'Tần suất ' + (index + 1)} value={line.frequency} onChange={(event) => updateLine(index, { frequency: event.target.value })} placeholder="Nhập tần suất" /></label><label className="clinical-field">Số ngày dùng<input type="number" min="1" step="1" value={line.durationDays} onChange={(event) => updateLine(index, { durationDays: event.target.value })} placeholder="Không bắt buộc" /></label></div>
              </> : <label className="clinical-field">Tên nội dung<input aria-label="Tên nội dung" value={line.title} onChange={(event) => updateLine(index, { title: event.target.value })} placeholder="Nhập nội dung điều trị" /></label>}
              {!prescriptions && <div className="clinical-field-grid clinical-plan-fields"><label className="clinical-field">Loại nội dung<select value={line.planType} onChange={(event) => updateLine(index, { planType: event.target.value })}>{!planTypes[line.planType] && <option value={line.planType}>{line.planType}</option>}{Object.entries(planTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="clinical-field">Thời hạn thực hiện<input type="datetime-local" value={line.dueAt} onChange={(event) => updateLine(index, { dueAt: event.target.value })} /></label></div>}
              <label className="clinical-field">{prescriptions ? 'Hướng dẫn sử dụng' : 'Mô tả'}<textarea value={line.instruction} onChange={(event) => updateLine(index, { instruction: event.target.value })} rows={2} placeholder={prescriptions ? 'Hướng dẫn dành cho bệnh nhân' : 'Mô tả chi tiết nội dung'} /></label>
            </div>;
          })}
          <button type="button" className="clinical-add" onClick={() => setLines([...lines, blankLine()])}><Plus style={{ fontSize: 16 }} /> Thêm {prescriptions ? 'thuốc' : 'nội dung'}</button>
          <div className="clinical-form-footer"><button type="button" className="clinical-button" onClick={() => setForm(null)}>Hủy</button><button type="submit" className="clinical-button clinical-button-primary" disabled={busy}>{busy && <LoaderCircle style={{ fontSize: 16 }} className="clinical-spin" />}Lưu</button></div>
        </form> : selected ? <>
          <div className="clinical-detail-header"><div><span className="clinical-eyebrow">{prescriptions ? 'CHI TIẾT ĐƠN THUỐC' : 'CHI TIẾT KẾ HOẠCH'}</span><h4>{prescriptions ? 'Đơn thuốc' : String(selected.title || 'Kế hoạch điều trị')}</h4><p>Ngày tạo {formatDate(selected.createdAt)}</p></div><span className={'clinical-status status-' + String(selected.status || '').toLowerCase()}>{statusLabel(selected.status)}</span></div>
          {selected.status === 'CANCELLED' && selected.cancelReason && <div className="clinical-summary"><span>Lý do hủy</span><p>{String(selected.cancelReason)}</p></div>}
          {!prescriptions && <div className="clinical-summary"><span>Tóm tắt</span><div><p>{String(selected.summary || 'Chưa có tóm tắt kế hoạch.')}</p><p>Hiệu lực: {formatDate(selected.effectiveFrom)}{selected.effectiveTo ? ' – ' + formatDate(selected.effectiveTo) : ''}</p></div></div>}
          <div className="clinical-section-heading"><div><h5>{prescriptions ? 'Danh sách thuốc' : 'Nội dung điều trị'}</h5><p>{selectedItems.length} {prescriptions ? 'thuốc trong đơn' : 'nội dung trong kế hoạch'}</p></div></div>
          {selectedItems.length === 0 ? <p className="clinical-hint">Chưa có nội dung. Chỉnh sửa bản nháp để bổ sung.</p> : <div className="clinical-detail-items">{selectedItems.map((item, index) => <article className="clinical-detail-item" key={String(item.id || index)}>
            <span className="clinical-item-number">{String(index + 1).padStart(2, '0')}</span><div className="clinical-item-copy"><div className="clinical-item-top"><strong>{String((prescriptions ? item.medicationName : item.title) || 'Chưa cập nhật')}</strong>{!prescriptions && <span className={'clinical-status status-' + String(item.status || '').toLowerCase()}>{statusLabel(item.status)}</span>}</div>
              {prescriptions ? <><p>{[item.strength, item.dosageForm].filter(Boolean).join(' · ') || 'Chưa có thông tin dạng thuốc'}</p><div className="clinical-dose"><span><b>Liều dùng</b>{String(item.dose || 'Chưa cập nhật')}</span><span><b>Đường dùng</b>{String(item.route || 'Chưa cập nhật')}</span><span><b>Tần suất</b>{String(item.frequency || 'Chưa cập nhật')}</span></div>{item.durationDays && <p>Thời gian dùng: {String(item.durationDays)} ngày</p>}{item.instruction && <p>Hướng dẫn: {String(item.instruction)}</p>}</> : <>{item.type && <p>Loại: {planTypes[String(item.type)] || String(item.type)}</p>}{item.description && <p>{String(item.description)}</p>}{item.dueAt && <p>Thời hạn: {formatDateTime(item.dueAt)}</p>}{selected.status === 'ACTIVE' && ['PENDING', 'IN_PROGRESS'].includes(String(item.status)) && <button type="button" className="clinical-link" disabled={!manageable || busy} title={!manageable ? 'Chỉ có thể cập nhật khi lần khám đang khám hoặc đã hoàn tất.' : undefined} onClick={() => act('complete', String(item.id))}>Đánh dấu hoàn thành</button>}</>}
            </div></article>)}</div>}
          <div className="clinical-actions">
            {selected.status === 'DRAFT' && <button className="clinical-button" disabled={!editable || !patientId || busy} title={!editable || !patientId ? lockedReason : undefined} onClick={() => startForm('edit')}>Chỉnh sửa</button>}
            {!prescriptions && selected.status === 'ACTIVE' && <button className="clinical-button" disabled={!manageable || !patientId || busy} title={!manageable ? 'Chỉ có thể cập nhật khi lần khám đang khám hoặc đã hoàn tất.' : undefined} onClick={() => startForm('edit')}>Điều chỉnh kế hoạch</button>}
            {selected.status === 'DRAFT' && <button className="clinical-button clinical-button-primary" disabled={!editable || busy || !selectedItems.length} title={!editable ? lockedReason : !selectedItems.length ? 'Cần có ít nhất một nội dung.' : undefined} onClick={() => act(prescriptions ? 'issue' : 'activate')}>{prescriptions ? 'Xác nhận đơn thuốc' : 'Bắt đầu kế hoạch'}</button>}
            {!prescriptions && selected.status === 'ACTIVE' && <button className="clinical-button clinical-button-primary" disabled={!manageable || busy} onClick={() => act('complete')}>Hoàn thành kế hoạch</button>}
            {((prescriptions && ['DRAFT', 'ISSUED'].includes(String(selected.status))) || (!prescriptions && ['DRAFT', 'ACTIVE'].includes(String(selected.status)))) && <button className="clinical-button clinical-button-danger" disabled={!(selected.status === 'DRAFT' ? editable : manageable) || busy} title={!(selected.status === 'DRAFT' ? editable : manageable) ? 'Trạng thái lần khám không cho phép hủy chỉ định này.' : undefined} onClick={() => { setCancelOpen(true); setActionError(''); }}>Hủy {resourceName}</button>}
          </div>
          {cancelOpen && <div className="clinical-cancel"><strong>Xác nhận hủy {resourceName}</strong><label className="clinical-field">Lý do hủy<textarea aria-label="Lý do hủy" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={2} placeholder="Nhập lý do hủy" /></label><div><button className="clinical-button" onClick={() => setCancelOpen(false)}>Quay lại</button><button className="clinical-button clinical-button-danger" disabled={busy || !cancelReason.trim()} onClick={() => act('cancel')}>Xác nhận hủy</button></div></div>}
        </> : <div className="clinical-detail-empty"><div className="clinical-empty-icon">{prescriptions ? <FileText style={{ fontSize: 26 }} /> : <ClipboardList style={{ fontSize: 26 }} />}</div><h4>{rows.length ? 'Chọn một ' + resourceName : 'Chưa có ' + resourceName}</h4><p>{rows.length ? 'Chọn từ danh sách để xem thông tin và thao tác.' : 'Chỉ định được tạo cho lần khám này sẽ xuất hiện tại đây.'}</p></div>}
      </div>
    </div>
  </section>;
}

