import React, { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Modal, Spin, Tag, message } from 'antd';
import {
  CheckCircleOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  MedicineBoxOutlined,
  PrinterOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { getEncounter } from '../../../services/clinical';

type PreviewFile = {
  fileName: string;
  mediaType: string;
  url: string;
  title: string;
};

export interface PatientAppointmentResultsModalProps {
  open: boolean;
  onClose: () => void;
  appointment?: any | null;
  encounterId?: string;
  appointmentCode?: string;
  patientName?: string;
  reportDocumentId?: string | null;
  reportLoading?: boolean;
}

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN');
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN');
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileIcon = (fileName = '', mediaType = '') => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (extension === 'pdf' || mediaType.includes('pdf')) {
    return <FilePdfOutlined style={{ color: '#dc2626', fontSize: 22 }} />;
  }
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension) || mediaType.includes('image')) {
    return <FileImageOutlined style={{ color: '#0284c7', fontSize: 22 }} />;
  }
  return <FileWordOutlined style={{ color: '#2563eb', fontSize: 22 }} />;
};

export const PatientAppointmentResultsModal: React.FC<PatientAppointmentResultsModalProps> = ({
  open,
  onClose,
  appointment,
  encounterId,
  appointmentCode,
  patientName,
  reportDocumentId,
  reportLoading = false,
}) => {
  const { request, stream } = useAuthSession();
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

  useEffect(() => {
    if (!open || !encounterId) {
      setOrders([]);
      return;
    }

    let active = true;
    setLoadingOrders(true);
    getEncounter(request, encounterId)
      .then((response: any) => {
        if (!active) return;
        const data = response?.data || response;
        setOrders(Array.isArray(data?.orders) ? data.orders : []);
      })
      .catch(() => {
        if (active) message.error('Không thể tải kết quả khám và chỉ định.');
      })
      .finally(() => {
        if (active) setLoadingOrders(false);
      });

    return () => {
      active = false;
    };
  }, [open, encounterId, request]);

  useEffect(() => {
    if (!open) setPreviewFile(null);
  }, [open]);

  const completedOrderCount = useMemo(
    () => orders.filter((order) => order.structuredResult?.fileUrl || order.structuredResult?.fileName || order.status === 'VERIFIED').length,
    [orders],
  );

  const handlePreview = async (order: any) => {
    const result = order.structuredResult;
    if (!result?.fileUrl) {
      message.info('Chỉ định này chưa có tệp kết quả trực tuyến.');
      return;
    }

    try {
      const response = await stream(result.fileUrl);
      if (!response.ok) throw new Error('Không thể tải tệp kết quả.');
      const blob = await response.blob();
      setPreviewFile({
        fileName: result.fileName || 'ket_qua_can_lam_sang',
        mediaType: result.mediaType || blob.type || 'application/pdf',
        url: URL.createObjectURL(blob),
        title: order.catalogServiceName || order.serviceName || 'Kết quả chỉ định',
      });
    } catch {
      message.error('Không thể mở tệp kết quả cận lâm sàng.');
    }
  };

  const closePreview = () => {
    if (previewFile?.url) URL.revokeObjectURL(previewFile.url);
    setPreviewFile(null);
  };

  const pdfUrl = reportDocumentId ? `${apiBaseUrl}/api/documents/${reportDocumentId}/content?format=pdf` : '';
  const appointmentDate = formatDate(appointment?.completedAt || appointment?.startAt);
  const doctorName = appointment?.assignedDoctorName || 'Bác sĩ phụ trách';
  const serviceName = appointment?.pricing?.serviceName || 'Lịch khám sản phụ khoa';

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width={1060}
        style={{ top: 24 }}
        styles={{ body: { padding: 0, background: '#f8fafc' } }}
        footer={
          <div className="pap-results-modal-footer">
            <span>Toàn bộ kết quả của một lần khám được tổng hợp tại đây.</span>
            <Button type="primary" onClick={onClose}>Đóng</Button>
          </div>
        }
        title={
          <div className="pap-results-modal-title">
            <div className="pap-results-modal-title-icon"><MedicineBoxOutlined /></div>
            <div>
              <div className="pap-results-modal-heading">Kết quả khám của tôi</div>
              <div className="pap-results-modal-subtitle">
                {patientName || 'Bệnh nhân'}{appointmentCode ? ` • Mã lịch: ${appointmentCode}` : ''}
              </div>
            </div>
          </div>
        }
      >
        <div className="pap-results-modal-content">
          <div className="pap-results-visit-summary">
            <div>
              <span className="pap-results-summary-label">Lần khám</span>
              <strong>{serviceName}</strong>
            </div>
            <div>
              <span className="pap-results-summary-label">Thời gian</span>
              <strong>{appointmentDate || 'Đã cập nhật trên hồ sơ'}</strong>
            </div>
            <div>
              <span className="pap-results-summary-label">Bác sĩ</span>
              <strong>{doctorName}</strong>
            </div>
          </div>

          <section className="pap-results-section">
            <div className="pap-results-section-heading">
              <div className="pap-results-section-icon pap-results-section-icon--green"><FileTextOutlined /></div>
              <div>
                <h3>Kết quả khám bệnh</h3>
                <p>Phiếu kết quả khám tổng hợp, chẩn đoán và thông tin lâm sàng.</p>
              </div>
              {reportDocumentId && <Tag color="success" icon={<CheckCircleOutlined />}>Đã có phiếu</Tag>}
            </div>

            {reportLoading ? (
              <div className="pap-results-loading"><Spin /> <span>Đang chuẩn bị phiếu kết quả khám...</span></div>
            ) : reportDocumentId ? (
              <div className="pap-results-pdf-box">
                <iframe src={pdfUrl} title="Phiếu kết quả khám bệnh" />
                <div className="pap-results-pdf-actions">
                  <span><FilePdfOutlined /> Phiếu kết quả khám bệnh PDF</span>
                  <div>
                    <Button icon={<PrinterOutlined />} onClick={() => window.open(pdfUrl, '_blank')}>Mở bản in</Button>
                    <Button icon={<DownloadOutlined />} href={pdfUrl} download="phieu-ket-qua-kham.pdf">Tải PDF</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pap-results-empty-inline">
                <FileTextOutlined />
                <span>Phiếu kết quả khám chưa được phát hành hoặc lần khám chưa hoàn tất.</span>
              </div>
            )}
          </section>

          <section className="pap-results-section">
            <div className="pap-results-section-heading">
              <div className="pap-results-section-icon pap-results-section-icon--blue"><ExperimentOutlined /></div>
              <div>
                <h3>Kết quả chỉ định cận lâm sàng</h3>
                <p>Tất cả siêu âm, xét nghiệm và tệp kết quả thuộc lần khám này.</p>
              </div>
              {orders.length > 0 && <Tag color="blue">{completedOrderCount}/{orders.length} đã có kết quả</Tag>}
            </div>

            {loadingOrders ? (
              <div className="pap-results-loading"><Spin /> <span>Đang tải kết quả chỉ định...</span></div>
            ) : orders.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Lần khám này chưa có chỉ định cận lâm sàng." />
            ) : (
              <div className="pap-results-orders-list">
                {orders.map((order, index) => {
                  const result = order.structuredResult;
                  const hasFile = Boolean(result?.fileName || result?.fileUrl);
                  const hasResult = hasFile || order.status === 'VERIFIED' || order.status === 'RESULT_AVAILABLE';
                  return (
                    <div className="pap-results-order" key={order.id || index}>
                      <div className="pap-results-order-number">{String(index + 1).padStart(2, '0')}</div>
                      <div className="pap-results-order-main">
                        <strong>{order.catalogServiceName || order.serviceName || 'Dịch vụ cận lâm sàng'}</strong>
                        <span>{order.category || order.stageCode || 'Cận lâm sàng'}{order.resultNotes ? ` • ${order.resultNotes}` : ''}</span>
                        {hasFile && <small>{result.fileName}{result.uploadedAt ? ` • ${formatDateTime(result.uploadedAt)}` : ''}{result.sizeBytes ? ` • ${formatFileSize(result.sizeBytes)}` : ''}</small>}
                      </div>
                      <div className="pap-results-order-status">
                        <Tag icon={hasResult ? <CheckCircleOutlined /> : <ClockCircleOutlined />} color={hasResult ? 'success' : 'warning'}>
                          {hasResult ? 'Đã có kết quả' : 'Chờ kết quả'}
                        </Tag>
                        {hasFile && <Button size="small" type="primary" icon={<EyeOutlined />} onClick={() => handlePreview(order)}>Xem tệp</Button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </Modal>

      <Modal
        open={Boolean(previewFile)}
        onCancel={closePreview}
        width={920}
        title={previewFile ? <span><FilePdfOutlined /> {previewFile.title}</span> : 'Xem kết quả'}
        footer={[
          <Button key="download" icon={<DownloadOutlined />} href={previewFile?.url} download={previewFile?.fileName}>Tải tệp</Button>,
          <Button key="close" type="primary" onClick={closePreview}>Đóng</Button>,
        ]}
      >
        {previewFile && (
          <div className="pap-results-preview">
            {previewFile.mediaType.includes('pdf') || previewFile.fileName.toLowerCase().endsWith('.pdf') ? (
              <iframe src={previewFile.url} title={previewFile.fileName} />
            ) : previewFile.mediaType.includes('image') ? (
              <img src={previewFile.url} alt={previewFile.fileName} />
            ) : (
              <div className="pap-results-preview-other"><FileWordOutlined /><strong>{previewFile.fileName}</strong></div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

