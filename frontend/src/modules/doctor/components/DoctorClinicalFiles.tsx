import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { Button, message, Modal, Popconfirm, Tag, Tooltip } from 'antd';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import type { Requester } from '../../../services/catalog';
import '../../../styles/doctor-clinical-files.css';

type ClinicalFile = {
  id: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  createdAt: string;
};

const maxSize = 5 * 1024 * 1024; // 5 MB

const fileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const fileDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có thời gian';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
};

const base64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result.split(',')[1] ?? '')
        : reject(new Error('Không đọc được file.'));
    reader.onerror = () => reject(new Error('Không đọc được file.'));
    reader.readAsDataURL(file);
  });

export function DoctorClinicalFiles({
  encounterId,
  encounterState,
  request,
}: {
  encounterId: string;
  encounterState: string;
  request: Requester;
}) {
  const { stream } = useAuthSession();
  const [files, setFiles] = useState<ClinicalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Xem trước tài liệu (Preview Modal)
  const [previewItem, setPreviewItem] = useState<ClinicalFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  const path = `/api/documents/clinical-results/${encodeURIComponent(encounterId)}`;

  const load = useCallback(async () => {
    if (!encounterId) return;
    setLoading(true);
    try {
      const response = await request<{ data: ClinicalFile[] }>(path);
      setFiles(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      console.warn('Load clinical files error:', err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [path, request, encounterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canUpload = encounterState === 'IN_PROGRESS' || encounterState === 'DRAFT';

  // Tự động tải lên ngay lập tức khi bác sĩ chọn file (hỗ trợ PDF, ảnh, Word .docx/.doc)
  const handleSelectFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || busy) return;
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
    const filesToUpload: File[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (!allowedExts.includes(ext)) {
        message.error(`Tệp "${f.name}" không hợp lệ. Chỉ hỗ trợ PDF, JPG, PNG, DOC hoặc DOCX.`);
        continue;
      }
      if (f.size > maxSize || f.size === 0) {
        message.error(`Tệp "${f.name}" vượt quá dung lượng tối đa 5 MB.`);
        continue;
      }
      filesToUpload.push(f);
    }

    if (filesToUpload.length === 0) return;

    setBusy(true);
    try {
      for (const f of filesToUpload) {
        setUploadingName(f.name);
        const contentB64 = await base64(f);
        await request(path, {
          method: 'POST',
          body: JSON.stringify({
            fileName: f.name,
            mediaType: f.type || 'application/pdf',
            contentBase64: contentB64,
          }),
        });
      }
      message.success(
        filesToUpload.length === 1
          ? `Đã lưu tệp "${filesToUpload[0].name}" vào bệnh án thành công.`
          : `Đã lưu thành công ${filesToUpload.length} tệp vào bệnh án.`
      );
      await load();
    } catch (reason: any) {
      message.error(reason?.message || 'Không thể tải file lên hồ sơ khám.');
    } finally {
      setBusy(false);
      setUploadingName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Tải file về máy tính
  const download = async (item: ClinicalFile) => {
    setDownloadingId(item.id);
    try {
      const response = await stream(`${path}/${encodeURIComponent(item.id)}/content`);
      if (!response.ok) throw new Error('Không thể tải file. Vui lòng thử lại.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = item.fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason: any) {
      message.error(reason?.message || 'Không thể tải file.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Mở modal xem trước tài liệu
  const handlePreview = async (item: ClinicalFile) => {
    setPreviewLoadingId(item.id);
    try {
      const response = await stream(`${path}/${encodeURIComponent(item.id)}/content`);
      if (!response.ok) throw new Error('Không thể tải nội dung file để xem trước.');
      const rawBlob = await response.blob();
      const inlineBlob = new Blob([rawBlob], { type: item.mediaType });
      const url = URL.createObjectURL(inlineBlob);
      setPreviewUrl(url);
      setPreviewItem(item);
    } catch (reason: any) {
      message.error(reason?.message || 'Không thể xem trước tệp.');
    } finally {
      setPreviewLoadingId(null);
    }
  };

  // Đóng modal xem trước
  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewItem(null);
  };

  // Xóa tệp khỏi ca khám
  const handleDelete = async (item: ClinicalFile) => {
    setDeletingId(item.id);
    try {
      await request(`${path}/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      });
      message.success(`Đã xóa tệp "${item.fileName}".`);
      await load();
    } catch (reason: any) {
      message.error(reason?.message || 'Không thể xóa tệp.');
    } finally {
      setDeletingId(null);
    }
  };

  const isWordDoc = (item?: ClinicalFile | null) => {
    if (!item) return false;
    const name = item.fileName.toLowerCase();
    return (
      name.endsWith('.docx') ||
      name.endsWith('.doc') ||
      item.mediaType.includes('word') ||
      item.mediaType.includes('officedocument')
    );
  };

  return (
    <div className="clinical-files-card">
      {/* Header */}
      <div className="clinical-files-header">
        <div className="files-header-title">
          <FolderOpenOutlined style={{ color: '#0B5CAD', fontSize: 16 }} />
          <span>Tài liệu & Kết quả cận lâm sàng</span>
        </div>
        <Tag color="blue" style={{ borderRadius: 12, fontWeight: 700, margin: 0 }}>
          {files.length} file
        </Tag>
      </div>

      {/* Upload Zone (Kéo thả hoặc nhấp chọn để tự động lưu ngay) */}
      <div className="clinical-upload-container">
        <div
          className={`clinical-dropzone ${isDragging ? 'is-dragging' : ''} ${
            !canUpload || busy ? 'is-disabled' : ''
          }`}
          onClick={() => {
            if (canUpload && !busy && fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (canUpload && !busy) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (canUpload && !busy && e.dataTransfer.files) {
              void handleSelectFiles(e.dataTransfer.files);
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/jpg,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: 'none' }}
            disabled={!canUpload || busy}
            onChange={(e) => {
              if (e.target.files) {
                void handleSelectFiles(e.target.files);
              }
            }}
          />
          {uploadingName ? (
            <div className="dropzone-content is-uploading">
              <span className="dropzone-icon uploading-icon">
                <LoadingOutlined spin />
              </span>
              <div className="dropzone-text">
                <strong style={{ color: '#0B5CAD' }}>Đang tự động lưu tệp vào bệnh án...</strong>
                <span title={uploadingName}>{uploadingName}</span>
              </div>
            </div>
          ) : (
            <div className="dropzone-content">
              <span className="dropzone-icon">
                <CloudUploadOutlined />
              </span>
              <div className="dropzone-text">
                <strong>Nhấp hoặc kéo thả file kết quả vào đây (Tự động lưu)</strong>
                <span>Hỗ trợ PDF, JPG, PNG, DOC/DOCX (tối đa 5 MB) · Cho phép chọn nhiều file</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Files List Section */}
      <div className="clinical-files-list-section">
        <div className="files-list-subtitle">
          <span>Tài liệu đã lưu trong ca khám ({files.length}):</span>
          {loading && <LoadingOutlined style={{ fontSize: 13, color: '#0B5CAD' }} />}
        </div>

        <div className="clinical-files-scroll-list">
          {files.length > 0 ? (
            files.map((item) => (
              <div key={item.id} className="clinical-file-item">
                {/* Nhấp vào phần thông tin để mở xem trước */}
                <div
                  className="file-item-left"
                  onClick={() => void handlePreview(item)}
                  title="Nhấp để xem trước nội dung tệp"
                  style={{ cursor: 'pointer' }}
                >
                  <span
                    className={`file-type-badge ${
                      item.mediaType === 'application/pdf'
                        ? 'type-pdf'
                        : isWordDoc(item)
                        ? 'type-word'
                        : 'type-img'
                    }`}
                  >
                    {item.mediaType === 'application/pdf' ? (
                      <FilePdfOutlined />
                    ) : isWordDoc(item) ? (
                      <FileWordOutlined />
                    ) : (
                      <FileImageOutlined />
                    )}
                  </span>
                  <div className="file-item-info">
                    <Tooltip title="Nhấp để mở xem chi tiết">
                      <strong className="file-item-title">{item.fileName}</strong>
                    </Tooltip>
                    <span className="file-item-meta">
                      {item.mediaType === 'application/pdf'
                        ? 'PDF'
                        : isWordDoc(item)
                        ? 'Word'
                        : 'Ảnh'}{' '}
                      · {fileSize(item.sizeBytes)} · {fileDate(item.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Các nút hành động */}
                <div className="file-item-right">
                  <Button
                    size="small"
                    icon={
                      previewLoadingId === item.id ? (
                        <LoadingOutlined />
                      ) : (
                        <EyeOutlined />
                      )
                    }
                    loading={previewLoadingId === item.id}
                    onClick={() => void handlePreview(item)}
                    className="btn-preview-file"
                    title="Xem trước nội dung"
                  >
                    Xem
                  </Button>

                  <Button
                    size="small"
                    icon={
                      downloadingId === item.id ? (
                        <LoadingOutlined />
                      ) : (
                        <DownloadOutlined />
                      )
                    }
                    loading={downloadingId === item.id}
                    onClick={() => void download(item)}
                    className="btn-download-file"
                    title="Tải tệp về máy"
                  >
                    Tải về
                  </Button>

                  {canUpload && (
                    <Popconfirm
                      title="Xóa tệp đính kèm này?"
                      description="Tệp sẽ được gỡ khỏi ca khám của bệnh nhân."
                      okText="Xóa"
                      cancelText="Hủy"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => void handleDelete(item)}
                    >
                      <Button
                        size="small"
                        danger
                        type="text"
                        icon={deletingId === item.id ? <LoadingOutlined /> : <DeleteOutlined />}
                        loading={deletingId === item.id}
                        className="btn-delete-file"
                        title="Xóa tệp khỏi ca khám"
                      />
                    </Popconfirm>
                  )}
                </div>
              </div>
            ))
          ) : !loading ? (
            <div className="clinical-files-empty">
              <FolderOpenOutlined className="empty-icon" />
              <strong className="empty-title">Chưa có tài liệu đính kèm</strong>
              <span className="empty-desc">
                Kéo thả file vào khung trên để lưu kết quả siêu âm, xét nghiệm vào bệnh án ca khám này.
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── MODAL XEM TRƯỚC TÀI LIỆU KẾT QUẢ ─── */}
      <Modal
        open={Boolean(previewItem && previewUrl)}
        onCancel={handleClosePreview}
        width={previewItem?.mediaType.startsWith('image/') ? 860 : 1000}
        centered
        destroyOnClose
        title={
          <div className="preview-modal-header">
            <span className="preview-modal-icon">
              {previewItem?.mediaType === 'application/pdf' ? (
                <FilePdfOutlined style={{ color: '#dc2626' }} />
              ) : isWordDoc(previewItem) ? (
                <FileWordOutlined style={{ color: '#0284c7' }} />
              ) : (
                <FileImageOutlined style={{ color: '#2563eb' }} />
              )}
            </span>
            <div className="preview-modal-meta">
              <strong className="preview-modal-filename" title={previewItem?.fileName}>
                {previewItem?.fileName}
              </strong>
              <span className="preview-modal-sub">
                {previewItem && fileSize(previewItem.sizeBytes)} · Đã lưu lúc{' '}
                {previewItem && fileDate(previewItem.createdAt)}
              </span>
            </div>
          </div>
        }
        footer={[
          <Button key="close" onClick={handleClosePreview}>
            Đóng
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            style={{ background: '#0B5CAD', fontWeight: 600 }}
            onClick={() => previewItem && void download(previewItem)}
          >
            Tải tệp về máy
          </Button>,
        ]}
      >
        <div className="preview-modal-body">
          {previewItem?.mediaType.startsWith('image/') ? (
            <div className="preview-image-wrap">
              <img
                src={previewUrl!}
                alt={previewItem.fileName}
                className="preview-image-content"
              />
            </div>
          ) : previewItem?.mediaType === 'application/pdf' ? (
            <div className="preview-pdf-wrap">
              <iframe
                src={previewUrl!}
                className="preview-pdf-iframe"
                title={previewItem.fileName}
              />
            </div>
          ) : (
            <div className="preview-doc-wrap">
              <FileWordOutlined style={{ fontSize: 64, color: '#0284c7', marginBottom: 14 }} />
              <h3>Tài liệu văn bản Microsoft Word ({previewItem?.fileName})</h3>
              <p>
                Trình duyệt không hỗ trợ đọc trực tiếp tệp Word nội bộ. Vui lòng nhấn{' '}
                <strong>"Tải tệp về máy"</strong> bên dưới để mở bằng Microsoft Word hoặc chuyển đổi sang định dạng PDF để xem trực tiếp tại đây.
              </p>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                style={{ background: '#0B5CAD', marginTop: 12 }}
                onClick={() => previewItem && void download(previewItem)}
              >
                Tải tệp Word về máy
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
