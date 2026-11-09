import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Space, Tag, Typography, Spin, Result } from 'antd';
import {
  PrinterOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  FullscreenOutlined,
  CheckCircleFilled,
  ReloadOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export interface MedicalReportModalProps {
  open: boolean;
  onClose: () => void;
  documentId?: string | null;
  encounterId?: string | null;
  appointmentCode?: string;
  patientName?: string;
  fileName?: string;
}

export const MedicalReportModal: React.FC<MedicalReportModalProps> = ({
  open,
  onClose,
  documentId,
  appointmentCode,
  patientName,
  fileName,
}) => {
  const [loading, setLoading] = useState(false);
  const [blobPdfUrl, setBlobPdfUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeBlobRef = useRef<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
  const pdfUrl = documentId ? `${API_BASE_URL}/api/documents/${documentId}/content?format=pdf` : '';
  const downloadUrl = documentId ? `${API_BASE_URL}/api/documents/${documentId}/content?download=true` : '';

  const loadPdfContent = async () => {
    if (!documentId || !open) return;
    setLoading(true);
    setLoadError(null);

    // Revoke previous blob if exists
    if (activeBlobRef.current) {
      URL.revokeObjectURL(activeBlobRef.current);
      activeBlobRef.current = null;
    }
    setBlobPdfUrl(null);

    try {
      const response = await fetch(pdfUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error(`Máy chủ trả về trạng thái ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/pdf')) {
        throw new Error('Nội dung trả về không đúng định dạng PDF y khoa.');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      activeBlobRef.current = objectUrl;
      setBlobPdfUrl(objectUrl);
    } catch (err: any) {
      console.warn('Lỗi khi tải nội dung file PDF:', err);
      setLoadError(err?.message || 'Không thể tải nội dung file PDF. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && documentId) {
      loadPdfContent();
    } else {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
        activeBlobRef.current = null;
      }
      setBlobPdfUrl(null);
      setLoadError(null);
    }

    return () => {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
        activeBlobRef.current = null;
      }
    };
  }, [open, documentId, pdfUrl]);

  const handlePrint = () => {
    const targetUrl = blobPdfUrl || pdfUrl;
    if (targetUrl) {
      const win = window.open(targetUrl, '_blank');
      if (win) {
        win.onload = () => {
          try {
            win.print();
          } catch (e) {}
        };
      }
    }
  };

  const handleOpenNewTab = () => {
    const targetUrl = blobPdfUrl || pdfUrl;
    if (targetUrl) {
      window.open(targetUrl, '_blank');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1000}
      style={{ top: 20 }}
      styles={{
        body: { padding: '12px 16px', background: '#f8fafc' },
        header: { padding: '16px 20px', borderBottom: '1px solid #e2e8f0' },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              <FilePdfOutlined />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                Phiếu Kết Quả Khám Bệnh (Bản In Chuẩn Y Khoa A4)
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
                {patientName ? <span>Bệnh nhân: <strong style={{ color: '#0284c7' }}>{patientName}</strong></span> : null}
                {appointmentCode ? <span style={{ marginLeft: 12 }}>Mã lịch: <strong style={{ fontFamily: 'monospace' }}>{appointmentCode}</strong></span> : null}
              </div>
            </div>
          </div>

          <Space size={8}>
            <Tag color="success" icon={<CheckCircleFilled />} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6 }}>
              PDF Bản thật lưu hệ thống
            </Tag>
            <Tag color="blue" style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6 }}>
              A4 Portrait
            </Tag>
          </Space>
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px' }}>
          <div style={{ fontSize: 12.5, color: '#64748b' }}>
            {fileName ? <Text ellipsis style={{ maxWidth: 350 }}>Tên file: <code>{fileName}</code></Text> : 'Định dạng chuẩn A4 có chữ ký và dấu mộc'}
          </div>
          <Space size={10}>
            <Button icon={<FullscreenOutlined />} onClick={handleOpenNewTab} disabled={!blobPdfUrl && !pdfUrl}>
              Mở tab mới
            </Button>
            <Button
              icon={<DownloadOutlined />}
              href={blobPdfUrl || downloadUrl}
              download={fileName || 'phieu_kham_benh.pdf'}
              disabled={!blobPdfUrl && !downloadUrl}
            >
              Tải file PDF
            </Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
              disabled={!blobPdfUrl && !pdfUrl}
              style={{ background: '#0B5CAD', borderColor: '#0B5CAD', fontWeight: 600 }}
            >
              In Phiếu Khám (A4)
            </Button>
            <Button onClick={onClose}>Đóng</Button>
          </Space>
        </div>
      }
    >
      {!documentId ? (
        <div
          style={{
            height: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
          }}
        >
          <FilePdfOutlined style={{ fontSize: 48, color: '#94a3b8', marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>Đang tạo hoặc không tìm thấy tài liệu PDF</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Vui lòng kiểm tra lại trạng thái ca khám.</div>
        </div>
      ) : loading ? (
        <div
          style={{
            width: '100%',
            height: '75vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ffffff',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
          }}
        >
          <Spin size="large" />
          <div style={{ marginTop: 16, fontSize: 14, color: '#475569', fontWeight: 600 }}>
            Đang tải dữ liệu phiếu kết quả khám bệnh...
          </div>
        </div>
      ) : loadError ? (
        <div
          style={{
            width: '100%',
            height: '75vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ffffff',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            padding: 24,
          }}
        >
          <Result
            status="warning"
            title="Chưa thể hiển thị phiếu kết quả khám bệnh"
            subTitle={loadError}
            extra={
              <Button type="primary" icon={<ReloadOutlined />} onClick={loadPdfContent}>
                Thử tải lại
              </Button>
            }
          />
        </div>
      ) : blobPdfUrl ? (
        <div
          style={{
            width: '100%',
            height: '75vh',
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid #cbd5e1',
            background: '#525659',
            display: 'flex',
            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          <iframe
            src={blobPdfUrl}
            title="Phiếu kết quả khám bệnh PDF"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      ) : null}
    </Modal>
  );
};
