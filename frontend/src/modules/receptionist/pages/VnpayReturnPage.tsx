import { useEffect, useRef, useState } from 'react';
import { Button, Result, Spin } from 'antd';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate } from '../../../app/navigation';
import {
  COMPLETED_VNPAY_RETURN_KEY,
  PENDING_VNPAY_RETURN_KEY,
  processVnpayBrowserReturn,
  readVnpayContext,
  safeReceptionistReturnPath,
} from '../../../services/vnpayReturn';

export function VnpayReturnPage() {
  const [message, setMessage] = useState('Đang quay lại bàn tiếp đón…');
  const auth = useAuthSession();
  const started = useRef(false);

  useEffect(() => {
    // Wait for AuthSessionProvider to restore/refresh the session from this
    // full-page return before navigating back to the receptionist workspace.
    if (auth.status === 'loading' || started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const txnRef = params.get('vnp_TxnRef');
    const pending = readVnpayContext(PENDING_VNPAY_RETURN_KEY);
    const target =
      pending && txnRef === pending.txnRef
        ? safeReceptionistReturnPath(pending.returnPath)
        : null;

    if (!pending || !target) {
      setMessage(
        'Không tìm thấy trang thanh toán ban đầu trên trình duyệt này.',
      );
      return;
    }
    if (auth.status === 'anonymous') {
      navigate('/dang-nhap', { replace: true });
      return;
    }

    try {
      window.sessionStorage.setItem(
        COMPLETED_VNPAY_RETURN_KEY,
        JSON.stringify({
          ...pending,
          responseCode: params.get('vnp_ResponseCode') ?? undefined,
        }),
      );
      window.sessionStorage.removeItem(PENDING_VNPAY_RETURN_KEY);
      // Also send VNPay's signed browser result to Billing. A canceled payment
      // may not produce a separate server-to-server IPN, leaving its attempt
      // pending and blocking another attempt for the invoice.
      void processVnpayBrowserReturn(window.location.search)
        .catch(() => undefined)
        .finally(() => navigate(target, { replace: true }));
    } catch {
      setMessage('Không thể khôi phục trang thanh toán ban đầu.');
    }
  }, [auth.status]);

  if (message === 'Đang quay lại bàn tiếp đón…') {
    return <Result icon={<Spin size="large" />} title={message} />;
  }

  return (
    <Result
      status="warning"
      title="Không thể khôi phục phiên thanh toán"
      subTitle={message}
      extra={
        <Button
          type="primary"
          onClick={() =>
            navigate('/workspace/receptionist/overview', { replace: true })
          }
        >
          Về bàn tiếp đón
        </Button>
      }
    />
  );
}
