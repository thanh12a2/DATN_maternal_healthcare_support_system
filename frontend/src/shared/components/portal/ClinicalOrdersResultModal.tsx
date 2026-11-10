import React, { useEffect, useState } from 'react';
import { Modal, Tag, Spin, Empty, Button, message, Card } from 'antd';
import {
  ExperimentOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileWordOutlined,
  DownloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { getEncounter } from '../../../services/clinical';

export interface ClinicalOrdersResultModalProps {
  open: boolean;
  onClose: () => void;
  encounterId?: string;
  appointmentCode?: string;
  patientName?: string;
}

export const ClinicalOrdersResultModal: React.FC<ClinicalOrdersResultModalProps> = ({
  open,
  onClose,
  encounterId,
  appointmentCode,
  patientName,
}) => {
  const { request, stream } = useAuthSession();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);

  // Preview file state
  const [previewFile, setPreviewFile] = useState<{
    fileName: string;
    mediaType: string;
    url: string;
    orderTitle?: string;
  } | null>(null);

  useEffect(() => {
    if (!open || !encounterId) {
      setOrders([]);
      return;
    }

    let active = true;
    setLoading(true);

    getEncounter(request, encounterId)
      .then((res: any) => {
        if (!active) return;
        const data = res?.data || res;
        const list = Array.isArray(data?.orders) ? data.orders : [];
        setOrders(list);
      })
      .catch((err) => {
        if (!active) return;
        console.warn('Lỗi khi tải danh sách chỉ định CLS:', err);
        message.error('Không thể tải danh sách kết quả cận lâm sàng.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, encounterId, request]);

  // Xử lý xem trước file
  const handlePreviewFile = async (order: any) => {
    const sr = order.structuredResult;
    if (!sr?.fileUrl) {
      message.info('Chỉ định này chưa có tệp kết quả trực tuyến.');
      return;
    }

    try {
      const res = await stream(sr.fileUrl);
      if (!res.ok) throw new Error('Không thể tải tệp từ máy chủ.');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      setPreviewFile({
        fileName: sr.fileName || 'ket_qua_can_lam_sang.pdf',
        mediaType: sr.mediaType || blob.type || 'application/pdf',
        url: objectUrl,
        orderTitle: order.catalogServiceName || order.serviceName || 'Chỉ định cận lâm sàng',
      });
    } catch (err: any) {
      console.error('Lỗi khi mở file kết quả:', err);
      message.error('Không thể mở tệp kết quả cận lâm sàng.');
    }
  };

  const handleClosePreview = () => {
    if (previewFile?.url) {
      URL.revokeObjectURL(previewFile.url);
    }
    setPreviewFile(null);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName = '', mediaType = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf' || mediaType.includes('pdf')) {
      return <FilePdfOutlined style={{ color: '#ef4444', fontSize: 24 }} />;
    }
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || mediaType.includes('image')) {
      return <FileImageOutlined style={{ color: '#0284c7', fontSize: 24 }} />;
    }
    return <FileWordOutlined style={{ color: '#2563eb', fontSize: 24 }} />;
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={[
          <Button key="close" type="primary" onClick={onClose} style={{ borderRadius: 6, fontWeight: 600 }}>
            Đóng
          </Button>,
        ]}
        width={850}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: '#f0fdfa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0d9488',
                fontSize: 20,
              }}
            >
              <ExperimentOutlined />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Kết Quả Khám Chỉ Định Cận Lâm Sàng
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 400 }}>
                {appointmentCode ? `Mã lịch hẹn: ${appointmentCode}` : ''}
                {patientName ? ` • Bệnh nhân: ${patientName}` : ''}
              </div>
            </div>
          </div>
        }
      >
        <div style={{ minHeight: 200, padding: '12px 0' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <Spin tip="Đang tải kết quả cận lâm sàng..." />
            </div>
          ) : orders.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Lịch khám này không có chỉ định cận lâm sàng nào được ra y lệnh."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {orders.map((ord, idx) => {
                const sr = ord.structuredResult;
                const hasFile = Boolean(sr?.fileName || sr?.fileUrl);
                const hasNotes = Boolean(ord.resultNotes || sr?.notes);
                const isVerified = ord.status === 'VERIFIED' || ord.status === 'RESULT_AVAILABLE' || hasFile;

                return (
                  <Card
                    key={ord.id || idx}
                    size="small"
                    style={{
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                    bodyStyle={{ padding: '14px 16px' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '1px 7px',
                              borderRadius: 4,
                              background: '#f1f5f9',
                              color: '#475569',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            #{String(idx + 1).padStart(2, '0')}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                            {ord.catalogServiceName || ord.serviceName || ord.testName || 'Dịch vụ cận lâm sàng'}
                          </span>
                          <Tag color="cyan" style={{ borderRadius: 4, fontSize: 11 }}>
                            {ord.category || ord.stageCode || 'Cận lâm sàng'}
                          </Tag>
                        </div>

                        {ord.clinicalNotes && (
                          <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginBottom: 6 }}>
                            Yêu cầu/Lưu ý: {ord.clinicalNotes}
                          </div>
                        )}
                      </div>

                      <div>
                        {isVerified ? (
                          <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 4, fontWeight: 600, padding: '2px 8px' }}>
                            Đã có kết quả
                          </Tag>
                        ) : (
                          <Tag icon={<ClockCircleOutlined />} color="warning" style={{ borderRadius: 4, fontWeight: 500, padding: '2px 8px' }}>
                            Chờ kết quả
                          </Tag>
                        )}
                      </div>
                    </div>

                    {/* Khối hiển thị file kết quả */}
                    {hasFile ? (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '10px 14px',
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                          {getFileIcon(sr.fileName, sr.mediaType)}
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: 13.5,
                                color: '#0f172a',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={sr.fileName}
                            >
                              {sr.fileName}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#64748b' }}>
                              {formatFileSize(sr.sizeBytes)} {sr.uploadedAt ? `• Tải lên: ${new Date(sr.uploadedAt).toLocaleString('vi-VN')}` : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <Button
                            type="primary"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handlePreviewFile(ord)}
                            style={{
                              background: '#0B5CAD',
                              borderColor: '#0B5CAD',
                              borderRadius: 6,
                              fontWeight: 600,
                            }}
                          >
                            Xem kết quả
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '8px 12px',
                          background: '#fffbeb',
                          borderRadius: 6,
                          fontSize: 12,
                          color: '#b45309',
                        }}
                      >
                        Chưa có file kết quả tải lên. Bác sĩ hoặc phòng cận lâm sàng sẽ cập nhật kết quả tại đây.
                      </div>
                    )}

                    {/* Ghi chú kết quả */}
                    {hasNotes && (
                      <div style={{ marginTop: 8, fontSize: 12.5, color: '#334155', background: '#f0fdf4', padding: '6px 10px', borderRadius: 6 }}>
                        <strong>Đánh giá / Kết luận: </strong>
                        {ord.resultNotes || sr?.notes}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal xem trước file cận lâm sàng (PDF / Ảnh) */}
      <Modal
        open={!!previewFile}
        onCancel={handleClosePreview}
        footer={[
          <Button
            key="download"
            icon={<DownloadOutlined />}
            href={previewFile?.url}
            download={previewFile?.fileName}
            style={{ borderRadius: 6 }}
          >
            Tải về máy
          </Button>,
          <Button key="close" type="primary" onClick={handleClosePreview} style={{ borderRadius: 6 }}>
            Đóng
          </Button>,
        ]}
        width={920}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FilePdfOutlined style={{ color: '#0284c7', fontSize: 18 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                {previewFile?.orderTitle || 'Kết quả cận lâm sàng'}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{previewFile?.fileName}</div>
            </div>
          </div>
        }
      >
        <div style={{ minHeight: 520, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {previewFile ? (
            previewFile.mediaType.includes('pdf') || previewFile.fileName.endsWith('.pdf') ? (
              <iframe
                src={previewFile.url}
                title={previewFile.fileName}
                style={{ width: '100%', height: '70vh', border: 'none', borderRadius: 8 }}
              />
            ) : previewFile.mediaType.includes('image') ||
              ['jpg', 'jpeg', 'png', 'webp'].some((ext) => previewFile.fileName.endsWith(`.${ext}`)) ? (
              <img
                src={previewFile.url}
                alt={previewFile.fileName}
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <FileWordOutlined style={{ fontSize: 48, color: '#2563eb', marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{previewFile.fileName}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 16 }}>
                  Định dạng tệp này không hỗ trợ xem trực tiếp trong trình duyệt. Vui lòng tải về máy để xem.
                </div>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  href={previewFile.url}
                  download={previewFile.fileName}
                >
                  Tải tệp về máy
                </Button>
              </div>
            )
          ) : null}
        </div>
      </Modal>
    </>
  );
};
