import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircleOutlined, CloudUploadOutlined, DownloadOutlined, FileImageOutlined, FilePdfOutlined, FolderOpenOutlined, InfoCircleOutlined, LoadingOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import type { Requester } from '../../../services/catalog';
import '../../../styles/doctor-clinical-files.css';

type ClinicalFile = { id: string; fileName: string; mediaType: string; sizeBytes: number; createdAt: string };
const maxSize = 5 * 1024 * 1024;
const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const fileDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa có thời gian' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
};
const base64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1] ?? '') : reject(new Error('Không đọc được file.'));
  reader.onerror = () => reject(new Error('Không đọc được file.'));
  reader.readAsDataURL(file);
});

export function DoctorClinicalFiles({ encounterId, encounterState, request }: { encounterId: string; encounterState: string; request: Requester }) {
  const { stream } = useAuthSession();
  const [files, setFiles] = useState<ClinicalFile[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [listFailed, setListFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const path = `/api/documents/clinical-results/${encodeURIComponent(encounterId)}`;
  const load = useCallback(async () => {
    setLoading(true); setError(''); setListFailed(false);
    try { const response = await request<{ data: ClinicalFile[] }>(path); setFiles(response.data); }
    catch { setListFailed(true); setError('Không thể tải danh sách file. Vui lòng thử lại.'); }
    finally { setLoading(false); }
  }, [path, request]);
  useEffect(() => { void load(); }, [load]);
  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || busy) return;
    if (file.size > maxSize || !file.size || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) { setListFailed(false); setError('Chọn file PDF, JPG hoặc PNG có dung lượng tối đa 5 MB.'); return; }
    setBusy(true); setError(''); setListFailed(false); setNotice('');
    try {
      await request(path, { method: 'POST', body: JSON.stringify({ fileName: file.name, mediaType: file.type, contentBase64: await base64(file) }) });
      setFile(null); setInputKey(value => value + 1); await load(); setNotice('Đã tải file lên hồ sơ khám.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tải file lên.'); }
    finally { setBusy(false); }
  };
  const download = async (item: ClinicalFile) => {
    setBusy(true); setDownloadingId(item.id); setError(''); setListFailed(false); setNotice('');
    try {
      const response = await stream(`${path}/${encodeURIComponent(item.id)}/content`);
      if (!response.ok) throw new Error('Không thể tải file. Vui lòng thử lại.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = item.fileName; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể tải file.'); }
    finally { setBusy(false); setDownloadingId(null); }
  };
  const canUpload = encounterState === 'IN_PROGRESS';
  return <div className="doctor-files">
    <form className="doctor-files-upload" onSubmit={upload}>
      <div className="doctor-files-upload-heading">
        <span className="doctor-files-upload-icon" aria-hidden="true"><CloudUploadOutlined /></span>
        <div><h4>Thêm file xét nghiệm</h4><p>Lưu tài liệu vào hồ sơ của lượt khám này.</p></div>
      </div>
      <div className={'doctor-files-picker' + (file ? ' has-file' : '')}>
        <span className="doctor-files-picker-icon" aria-hidden="true">{file ? <CheckCircleOutlined /> : <FilePdfOutlined />}</span>
        <div className="doctor-files-picker-copy">
          <strong>{file ? file.name : 'Chọn file từ thiết bị'}</strong>
          <span>{file ? `${fileSize(file.size)} · Sẵn sàng tải lên` : 'PDF, JPG hoặc PNG · Tối đa 5 MB'}</span>
        </div>
        <label className={'doctor-files-choose' + (!canUpload || busy ? ' is-disabled' : '')}>
          <input key={inputKey} type="file" accept="application/pdf,image/jpeg,image/png" disabled={busy || !canUpload} onChange={event => { setFile(event.target.files?.[0] ?? null); setError(''); setNotice(''); }} />
          {file ? 'Đổi file' : 'Chọn file'}
        </label>
      </div>
      <div className="doctor-files-upload-footer">
        <p><InfoCircleOutlined aria-hidden="true" /> File chưa được quét mã độc tự động.</p>
        <button className="doctor-files-primary" type="submit" disabled={!file || busy || !canUpload}>{busy && !downloadingId ? <LoadingOutlined /> : <CloudUploadOutlined />} {busy && !downloadingId ? 'Đang tải lên...' : 'Tải lên hồ sơ'}</button>
      </div>
      {!canUpload && <p className="doctor-files-locked">Chỉ có thể tải lên khi hồ sơ đang khám.</p>}
    </form>
    {error && <div className="doctor-files-message is-error" role="alert"><span>{error}</span><button type="button" onClick={() => listFailed ? void load() : setError('')}>{listFailed ? 'Thử lại' : 'Đóng'}</button></div>}
    {notice && <div className="doctor-files-message is-success" role="status"><CheckCircleOutlined /> {notice}</div>}
    <section className="doctor-files-library" aria-label="Danh sách file xét nghiệm">
      <div className="doctor-files-library-heading"><div><h4>Tài liệu của lượt khám</h4><p>Các file đã được lưu vào hồ sơ này.</p></div>{!loading && <span>{files.length} file</span>}</div>
      {loading ? <div className="doctor-files-loading" role="status"><LoadingOutlined /> Đang tải danh sách file...</div> : files.length ? <div className="doctor-files-list">{files.map(item => <article key={item.id} className="doctor-files-item">
        <span className="doctor-files-item-icon" aria-hidden="true">{item.mediaType === 'application/pdf' ? <FilePdfOutlined /> : <FileImageOutlined />}</span>
        <div className="doctor-files-item-copy"><strong title={item.fileName}>{item.fileName}</strong><span>{item.mediaType === 'application/pdf' ? 'PDF' : item.mediaType === 'image/png' ? 'PNG' : 'JPG'} <i>·</i> {fileSize(item.sizeBytes)} <i>·</i> {fileDate(item.createdAt)}</span></div>
        <button className="doctor-files-download" type="button" disabled={busy} onClick={() => void download(item)}>{downloadingId === item.id ? <LoadingOutlined /> : <DownloadOutlined />} <span>{downloadingId === item.id ? 'Đang tải...' : 'Tải file'}</span></button>
      </article>)}</div> : !error && <div className="doctor-files-empty"><FolderOpenOutlined /><strong>Chưa có file xét nghiệm</strong><p>Chọn và tải file lên để lưu tài liệu cho lượt khám.</p></div>}
      <div className="doctor-files-privacy"><SafetyCertificateOutlined /> File được lưu theo lượt khám đang chọn.</div>
    </section>
  </div>;
}
