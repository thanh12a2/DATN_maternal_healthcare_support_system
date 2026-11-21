import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatbotMessage, ChatSafety } from '../../../../services/chatbot';
import { createConversation, deleteConversation, getConversation, sendChatMessage,
  sendConversationMessage, toChatMessage, prepareBookingHandoff } from '../../../../services/chatbot';
import { useAuthSession } from '../../../../app/AuthSessionProvider';
import { ApiError } from '../../../../services/api';
import '../../../../styles/chatbot-widget.css';
import { BookingConversationResult } from './BookingConversationResult';
import { BookingReadPanel } from './BookingReadPanel';
import { PatientPreferences, PersonalizationNotice } from './PatientPreferences';

interface ChatbotWidgetProps {
  open: boolean;
  onClose: () => void;
}

let msgIdCounter = 0;
function newId() {
  return `msg-${++msgIdCounter}`;
}

const GREETING: ChatbotMessage = {
  id: 'greeting',
  role: 'assistant',
  text: 'Xin chào! Tôi hỗ trợ thông tin sức khỏe thai kỳ dựa trên tài liệu tham khảo. Tôi không chẩn đoán, kê đơn hoặc xác nhận lịch khám qua chat. Nếu có dấu hiệu cấp cứu, hãy gọi 115 hoặc đến Cấp cứu ngay.',
  timestamp: new Date(),
};

const SAFETY_TITLES = {
  emergency: 'Cảnh báo cấp cứu', urgent: 'Cần được nhân viên y tế đánh giá ngay',
  clarify: 'Cần làm rõ triệu chứng', restricted: 'Giới hạn tư vấn',
  handoff: 'Cần nhân viên y tế hỗ trợ',
};

function SafetyNotice({ safety }: { safety: ChatSafety | null }) {
  if (!safety || safety.decision === 'allow') return null;
  const emergency = safety.decision === 'emergency';
  const urgent = safety.decision === 'urgent';
  const phone = safety.emergencyPhone;
  return <div className={`chatbot-safety chatbot-safety--${safety.decision}`}
    role={emergency || urgent ? 'alert' : 'status'}>
    <strong>{SAFETY_TITLES[safety.decision]}</strong>
    {emergency && <p>Không chờ chat hoặc đặt lịch thường. Hãy đến Cấp cứu ngay.</p>}
    {urgent && <p>Liên hệ cơ sở y tế ngay, không chờ lịch khám thường.</p>}
    {emergency && phone && /^\d{3,15}$/.test(phone) && <a href={`tel:${phone}`}>Gọi {phone} ngay</a>}
  </div>;
}

export function ChatbotWidget({ open, onClose }: ChatbotWidgetProps) {
  const { user, request } = useAuthSession();
  const storageKey = user ? `an-tam-chat:${user.userId}` : null;
  const conversationId = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<{ message: string; requestId: string } | null>(null);
  const [restoring, setRestoring] = useState(Boolean(storageKey));
  const [restoreVersion, setRestoreVersion] = useState(0);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [activeSafety, setActiveSafety] = useState<ChatSafety | null>(null);
  const [freshReplyId, setFreshReplyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatbotMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const guestSafetyLocked = !user && (activeSafety?.decision === 'emergency' || activeSafety?.decision === 'urgent');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function restore() {
      setRestoreFailed(false);
      try {
        const id = storageKey ? sessionStorage.getItem(storageKey) : null;
        if (id) {
          const conversation = await getConversation(request, id, controller.signal);
          if (active) {
            conversationId.current = id;
            setMessages([GREETING, ...conversation.messages.map(toChatMessage)]);
            setActiveSafety(conversation.state?.safety ?? null);
          }
        }
      } catch (err) {
        if (active) {
          if (err instanceof ApiError && err.statusCode === 404) {
            if (storageKey) sessionStorage.removeItem(storageKey);
          } else {
            setRestoreFailed(true);
            setError('Chưa tải được hội thoại. Vui lòng thử tải lại.');
          }
        }
      } finally {
        if (active) setRestoring(false);
      }
    }
    restore();
    return () => {
      active = false;
      controller.abort();
      abortRef.current?.abort();
      // Only a session ID is cached. AuthSessionProvider clears it on logout/account switch.
    };
  }, [request, storageKey, restoreVersion]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (open) {
      const log = messagesEndRef.current?.parentElement;
      log?.scrollTo?.({ top: log.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, open, loading, restoring]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || restoring || restoreFailed || guestSafetyLocked) return;

    const userMsg: ChatbotMessage = {
      id: newId(),
      role: 'user',
      text: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setFreshReplyId(null);
    setInput('');
    setError(null);
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 230_000);

    try {
      let response;
      if (user) {
        if (!conversationId.current) {
          const conversation = await createConversation(request, controller.signal);
          conversationId.current = conversation.conversationId;
          if (storageKey) sessionStorage.setItem(storageKey, conversation.conversationId);
        }
        const pending = pendingRef.current?.message === trimmed ? pendingRef.current
          : { message: trimmed, requestId: crypto.randomUUID() };
        pendingRef.current = pending;
        response = await sendConversationMessage(request, conversationId.current, trimmed,
          pending.requestId, controller.signal);
        // Show an acknowledged safety warning immediately, even if history refresh fails.
        setActiveSafety(response.safety ?? null);
        if (response.messages?.length) {
          const pair = response.messages.map(toChatMessage);
          setFreshReplyId(pair.at(-1)?.id ?? null);
          setMessages((previous) => [...previous.filter((message) => message.id !== userMsg.id
            && !pair.some((saved) => saved.id === message.id)), ...pair]);
        }
        pendingRef.current = null;
        try {
          const conversation = await getConversation(request, conversationId.current, controller.signal);
          if (!controller.signal.aborted) {
            setMessages([GREETING, ...conversation.messages.map(toChatMessage)]);
            setActiveSafety(conversation.state?.safety ?? response.safety ?? null);
          }
        } catch {
          setError('Đã nhận phản hồi nhưng chưa tải lại được lịch sử. Vui lòng tải lại trang khi có kết nối.');
        }
        return;
      }
      response = await sendChatMessage(trimmed, controller.signal);
      setActiveSafety(response.safety ?? null);
      const botMsg: ChatbotMessage = {
        id: newId(),
        role: 'assistant',
        text: response.answer,
        insufficient: response.insufficientEvidence ?? response.insufficient_evidence,
        citations: response.citations,
        safety: response.safety,
        catalog: response.catalog,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      if (user && err instanceof ApiError && err.statusCode === 404) {
        conversationId.current = null;
        pendingRef.current = null;
        if (storageKey) sessionStorage.removeItem(storageKey);
        setMessages([GREETING]);
        setActiveSafety(null);
      }
      const msg =
        controller.signal.aborted
          ? 'Đã dừng chờ phản hồi. Bạn có thể gửi câu hỏi mới. Nếu có dấu hiệu cấp cứu, gọi 115 hoặc đến Cấp cứu ngay.'
          : err instanceof ApiError && err.statusCode >= 500
            ? 'Trợ lý tạm thời chưa phản hồi. Vui lòng thử lại sau; bạn vẫn có thể đặt khám tại trang Đặt lịch khám.'
            : err instanceof TypeError
              ? 'Không kết nối được với trợ lý. Kiểm tra kết nối mạng rồi gửi lại câu hỏi.'
              : err instanceof Error ? err.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
      setError(msg);
      setInput(trimmed);
      setMessages((previous) => previous.filter((message) => message.id !== userMsg.id));
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      setLoading(false);
    }
  }, [input, loading, restoring, restoreFailed, request, user, storageKey, guestSafetyLocked]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = async () => {
    if (loading || restoring) return;
    setLoading(true);
    try {
      const oldId = conversationId.current ?? (storageKey ? sessionStorage.getItem(storageKey) : null);
      if (oldId) {
        try { await deleteConversation(request, oldId); }
        catch (err) { if (!(err instanceof ApiError && err.statusCode === 404)) throw err; }
      }
      conversationId.current = null;
      pendingRef.current = null;
      if (storageKey) sessionStorage.removeItem(storageKey);
      setMessages([GREETING]);
      setActiveSafety(null);
      setFreshReplyId(null);
      setError(null);
      setInput('');
      setRestoreFailed(false);
    } catch {
      setError('Chưa xóa được phiên cũ. Vui lòng thử lại.');
    } finally { setLoading(false); }
  };

  if (!open) return null;

  return (
    <div
      className="chatbot-widget"
      role="dialog"
      aria-label="Trợ lý ảo chăm sóc sức khỏe"
      aria-modal="false"
      ref={widgetRef}
    >
      {/* Header */}
      <div className="chatbot-widget-header">
        <div className="chatbot-widget-header-info">
          <div
            className="chatbot-widget-avatar"
            aria-hidden="true"
            style={{ overflow: 'hidden' }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                display: 'block',
                backgroundImage: 'url(/mascots/crt-directions.webp)',
                backgroundSize: '300% 300%',
                backgroundPosition: '50% 50%',
                backgroundRepeat: 'no-repeat',
              }}
            />
          </div>
          <div>
            <strong>Trợ lý Tâm An</strong>
            <span className="chatbot-widget-status">
              <i className="chatbot-status-dot" aria-hidden="true" />
              {activeSafety?.decision === 'emergency' ? 'Ưu tiên cấp cứu' : 'Thông tin tham khảo'}
            </span>
          </div>
        </div>
        <div className="chatbot-widget-header-actions">
          <button
            type="button"
            className="chatbot-widget-icon-btn"
            onClick={handleClear}
            disabled={loading || restoring}
            title="Cuộc trò chuyện mới"
            aria-label="Cuộc trò chuyện mới"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button
            type="button"
            className="chatbot-widget-icon-btn chatbot-widget-close"
            onClick={onClose}
            title="Đóng"
            aria-label="Đóng trợ lý ảo"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <SafetyNotice safety={activeSafety} />

      {/* Messages */}
      <div
        className="chatbot-widget-messages"
        role="log"
        aria-live="polite"
        aria-label="Tin nhắn"
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`chatbot-msg chatbot-msg--${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="chatbot-msg-avatar" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2Z" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
                </svg>
              </div>
            )}
            <div
              className={`chatbot-msg-bubble ${msg.insufficient ? 'chatbot-msg-bubble--warn' : ''} ${msg.safety?.decision === 'emergency' ? 'chatbot-msg-bubble--emergency' : ''}`}
            >
              {msg.insufficient && (
                <span className="chatbot-msg-warn-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
              )}
              <p className="chatbot-answer">{msg.text}</p>
              {msg.personalization && <PersonalizationNotice value={msg.personalization} />}
              {msg.booking && <BookingConversationResult booking={msg.booking}
                onContinue={user && conversationId.current ? (signal) => prepareBookingHandoff(request, conversationId.current!, msg.id, signal) : undefined}
                fresh={freshReplyId === msg.id && msg.id === messages.at(-1)?.id && !loading && activeSafety?.decision === 'allow'} />}
              {!!msg.catalog?.candidates.length && <div className="chatbot-catalog" aria-label="Gợi ý từ danh mục bệnh viện">
                {msg.catalog.candidates.map((item) => <article key={`${item.resourceType}:${item.id}`} data-catalog-id={item.id}>
                  <strong>{item.name}</strong>
                  <p>{item.resourceType === 'MedicalService' ? `Chuyên khoa: ${item.specialty?.name ?? ''}` : 'Chuyên khoa trong danh mục bệnh viện'}</p>
                  {item.requiresStaffConfirmation && <p className="chatbot-catalog-confirm">Thông tin gói cần bộ phận dịch vụ xác nhận.</p>}
                  {item.slug && <a href={`${item.resourceType === 'MedicalService' ? '/dich-vu/' : '/chuyen-khoa/'}${encodeURIComponent(item.slug)}`}>Xem thông tin {item.resourceType === 'MedicalService' ? 'dịch vụ' : 'chuyên khoa'}</a>}
                  {item.resourceType === 'MedicalService' && user && conversationId.current &&
                    <BookingReadPanel key={`${conversationId.current}:${item.id}`} request={request}
                      conversationId={conversationId.current} serviceId={item.id}
                      blocked={loading || restoring || restoreFailed || (!!activeSafety && activeSafety.decision !== 'allow')} />}
                  <details className="chatbot-citations"><summary>Nguồn danh mục bệnh viện</summary>
                    <p>Mã: {item.code}</p>
                    <p>Đối chiếu lúc: {new Date(item.source.verifiedAt).toLocaleString('vi-VN')}</p>
                    <p>Thông tin danh mục phục vụ định hướng, không phải bằng chứng chẩn đoán hay xác nhận lịch khám.</p>
                  </details>
                </article>)}
              </div>}
              {!!msg.safety?.references?.length && msg.safety.decision !== 'allow' && (
                <details className="chatbot-citations">
                  <summary>Nguồn khuyến cáo an toàn</summary>
                  {msg.safety.references.map((source) => <div key={source.url}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
                  </div>)}
                </details>
              )}
              {!!msg.citations?.length && (
                <details className="chatbot-citations">
                  <summary>Nguồn tham khảo ({msg.citations.length})</summary>
                  {msg.citations.map((citation) => (
                    <div key={citation.chunkId} className="chatbot-citation-entry">
                      <strong>[{citation.index}] {citation.document}</strong>
                      {citation.section && <p className="chatbot-citation-section">{citation.section}</p>}
                      <details className="chatbot-citation-excerpt"><summary>Đọc đoạn tài liệu gốc [{citation.index}]</summary><p>{citation.excerpt}</p></details>
                      <small>Mã đoạn: {citation.chunkId}</small>
                    </div>
                  ))}
                </details>
              )}
              <time className="chatbot-msg-time">
                {msg.timestamp.toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
          </div>
        ))}

        {messages.length === 1 && !restoring && !restoreFailed && <div className="chatbot-starters" aria-label="Gợi ý bắt đầu">
          <span>Bạn cần hỗ trợ gì hôm nay?</span>
          {['Tôi muốn đặt khám', 'Tôi muốn khám lại như lần trước', 'Dinh dưỡng trong thai kỳ cần lưu ý gì?'].map((text) =>
            <button key={text} type="button" onClick={() => { setInput(text); inputRef.current?.focus(); }}>{text}</button>)}
        </div>}

        {/* Loading indicator */}
        {(loading || restoring) && (
          <div
            className="chatbot-msg chatbot-msg--assistant"
            aria-label="Đang xử lý"
          >
            <div className="chatbot-msg-avatar" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2Z" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
              </svg>
            </div>
            <div
              className="chatbot-msg-bubble chatbot-msg-bubble--loading"
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
              <p>{restoring ? 'Đang tải hội thoại…' : 'Đang tìm thông tin…'}</p>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="chatbot-error" role="alert">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
            {restoreFailed && <button type="button" onClick={() => {
              setRestoring(true); setError(null); setRestoreVersion((version) => version + 1);
            }}>Tải lại hội thoại</button>}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="chatbot-widget-input-area">
        <textarea
          ref={inputRef}
          className="chatbot-widget-input"
          placeholder="Nhập câu hỏi hoặc nhu cầu đặt khám…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading || restoring || restoreFailed || guestSafetyLocked}
          aria-label="Nhập câu hỏi"
          maxLength={1000}
        />
        <button
          type="button"
          className="chatbot-widget-send"
          onClick={handleSend}
          disabled={loading || restoring || restoreFailed || guestSafetyLocked || !input.trim()}
          aria-label="Gửi câu hỏi"
        >
          {loading ? (
            <svg
              className="chatbot-send-spinner"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-6.22-8.56" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          )}
        </button>
      </div>
      <div className="chatbot-composer-hint">Enter để gửi · Shift + Enter để xuống dòng</div>
      {user && !['emergency', 'urgent'].includes(activeSafety?.decision ?? '') && <PatientPreferences key={user.userId} request={request} onChanged={()=>setFreshReplyId(null)} />}
      {loading && abortRef.current && <button type="button" className="chatbot-stop-waiting"
        onClick={() => abortRef.current?.abort()}>Dừng chờ phản hồi</button>}
      <p className="chatbot-widget-disclaimer">
        Thông tin chỉ mang tính tham khảo, vui lòng gặp bác sĩ để được tư vấn chính xác.
        {!user && ' Đăng nhập để lưu phiên hội thoại; khách hỏi đáp từng câu độc lập.'}
        {' '}<a href="tel:115">Cấp cứu: 115</a>
      </p>
    </div>
  );
}
