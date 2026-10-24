import { useEffect } from 'react';
import { Modal, Typography } from 'antd';

export interface AdminFeedbackState {
  open: boolean;
  type: 'success' | 'error';
  title: string;
  description: string;
}

interface AdminFeedbackModalProps {
  feedback: AdminFeedbackState | null;
  onClose: () => void;
}

/**
 * Modal hiển thị thông báo kết quả (Thành công / Thất bại) với hiệu ứng vẽ nét (Stroke Draw Animation):
 * - Tự động đóng sau 2s (khi thành công) hoặc 2.5s (khi thất bại)
 * - Căn giữa màn hình (centered)
 * - Không có nút X hay nút Đóng
 */
export function AdminFeedbackModal({ feedback, onClose }: AdminFeedbackModalProps) {
  useEffect(() => {
    if (!feedback?.open) return;
    const duration = feedback.type === 'error' ? 2500 : 2000;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [feedback, onClose]);

  if (!feedback) return null;

  return (
    <Modal
      className={feedback.type === 'error' ? 'admin-error-modal' : 'admin-success-modal'}
      open={feedback.open}
      centered
      closable={false}
      footer={null}
      width={380}
      zIndex={2500}
      destroyOnClose
    >
      <div style={{ textAlign: 'center', padding: '10px 8px 6px' }}>
        {feedback.type === 'error' ? (
          <div className="admin-error-icon-box">
            <svg className="admin-error-svg" viewBox="0 0 52 52">
              <circle className="admin-error-circle" cx="26" cy="26" r="24" fill="none" />
              <path className="admin-error-line admin-error-line-1" fill="none" d="M17 17 L35 35" />
              <path className="admin-error-line admin-error-line-2" fill="none" d="M35 17 L17 35" />
            </svg>
          </div>
        ) : (
          <div className="admin-success-icon-box">
            <svg className="admin-success-svg" viewBox="0 0 52 52">
              <circle className="admin-success-circle" cx="26" cy="26" r="24" fill="none" />
              <path className="admin-success-check" fill="none" d="M14 27 L22 35 L38 17" />
            </svg>
          </div>
        )}
        <Typography.Title
          level={4}
          style={{
            margin: '0 0 8px',
            color: feedback.type === 'error' ? '#cf1322' : 'var(--fg)',
            fontWeight: 700,
          }}
        >
          {feedback.title}
        </Typography.Title>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.5 }}>
          {feedback.description}
        </p>
      </div>
    </Modal>
  );
}
