import { useEffect, useState } from 'react';
import { CheckCircle2, Mail, Send } from 'lucide-react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { AppLink } from '../../../app/navigation';

const pendingTokenKey = 'email-verification-token';

export function EmailVerificationPanel() {
  const { request } = useAuthSession();
  const [state, setState] = useState<{ email: string; verified: boolean } | null>(null);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () => void request<{ email: string; verified: boolean }>('/auth/email-verification')
      .then(value => { if (live) { setState(value); setLoadError(false); if (value.verified) setMessage(''); } })
      .catch(() => { if (live) setLoadError(true); });
    load();
    const onFocus = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', onFocus);
    return () => { live = false; window.removeEventListener('focus', onFocus); };
  }, [request, attempt]);
  const send = async () => {
    setBusy(true); setMessage('');
    try { const result = await request<{ verified?: boolean }>('/auth/email-verification/request', { method: 'POST' }); if (result.verified) { setAttempt(n => n + 1); setMessage(''); } else setMessage('Đã gửi liên kết xác minh. Vui lòng kiểm tra hộp thư.'); }
    catch { setMessage('Không gửi được liên kết xác minh. Vui lòng thử lại sau.'); }
    finally { setBusy(false); }
  };
  return <div className="detail-item is-full profile-email-field">
    <div className="profile-email-heading"><span className="detail-label">Địa chỉ email</span>{state?.verified && !loadError && <span className="patient-badge-verified"><CheckCircle2 size={15} aria-hidden="true" />Đã xác minh</span>}</div>
    {loadError ? <div className="profile-email-error" role="alert">Không thể tải thông tin email. <button type="button" onClick={() => setAttempt(n => n + 1)}>Thử lại</button></div> : state ? <div className="profile-email-row">
      <div className="profile-email-address"><Mail size={18} aria-hidden="true" /><strong className="detail-value">{state.email}</strong></div>
      {!state.verified && <button className="profile-email-verify" type="button" onClick={() => void send()} disabled={busy}><Send size={15} aria-hidden="true" />{busy ? 'Đang gửi…' : 'Xác minh email'}</button>}
    </div> : <span className="profile-email-hint" role="status">Đang tải thông tin email…</span>}
    {message && <p className="profile-email-hint" role="status">{message}</p>}
  </div>;
}

export function EmailVerificationPage() {
  const auth = useAuthSession();
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('token');
    if (value && /^[A-Za-z0-9_-]{43}$/.test(value)) sessionStorage.setItem(pendingTokenKey, value);
    if (value) window.history.replaceState({}, '', window.location.pathname);
    return value || sessionStorage.getItem(pendingTokenKey) || '';
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true); setMessage('');
    try { await auth.request('/auth/email-verification/confirm', { method: 'POST', body: JSON.stringify({ token }) }); sessionStorage.removeItem(pendingTokenKey); setMessage('Email của bạn đã được xác minh.'); }
    catch { setMessage('Không thể xác minh. Liên kết có thể đã hết hạn hoặc không thuộc tài khoản này.'); }
    finally { setBusy(false); }
  };
  return <main className="app-loading"><h1>Xác minh email</h1>{auth.status === 'loading' ? <p>Đang kiểm tra phiên đăng nhập…</p> : auth.status === 'anonymous' ? <p>Vui lòng <AppLink href="/dang-nhap?redirect=%2Fxac-minh-email">đăng nhập</AppLink> bằng tài khoản bệnh nhân. Sau khi đăng nhập, bạn sẽ quay lại trang xác minh.</p> : !token ? <p>Không tìm thấy liên kết xác minh. Bạn có thể gửi lại từ hồ sơ bệnh nhân.</p> : <button type="button" disabled={busy || Boolean(message && message.startsWith('Email của'))} onClick={() => void confirm()}>{busy ? 'Đang xác minh…' : 'Xác minh địa chỉ email'}</button>}{message && <p role="status">{message}</p>}<p><AppLink href="/ho-so">Về hồ sơ bệnh nhân</AppLink></p></main>;
}
