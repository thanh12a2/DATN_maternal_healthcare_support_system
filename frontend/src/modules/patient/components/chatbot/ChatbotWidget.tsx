import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatbotMessage } from '../../../../services/chatbot';
import { sendChatMessage } from '../../../../services/chatbot';
import '../../../../styles/chatbot-widget.css';

interface ChatbotWidgetProps {
  open: boolean;
  onClose: () => void;
}

let msgIdCounter = 0;
function newId() { return `msg-${++msgIdCounter}`; }

const GREETING: ChatbotMessage = {
  id: 'greeting',
  role: 'assistant',
  text: 'Xin chào! Tôi là trợ lý ảo chăm sóc sức khỏe thai kỳ. Bạn có thể hỏi tôi về dinh dưỡng, lịch khám, các triệu chứng thai kỳ hoặc bất kỳ điều gì liên quan đến sức khỏe của bạn.',
  timestamp: new Date(),
};

export function ChatbotWidget({ open, onClose }: ChatbotWidgetProps) {
  const [messages, setMessages] = useState<ChatbotMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatbotMessage = { id: newId(), role: 'user', text: trimmed, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const response = await sendChatMessage(trimmed);
      const botMsg: ChatbotMessage = {
        id: newId(),
        role: 'assistant',
        text: response.insufficient_evidence
          ? 'Không tìm thấy thông tin phù hợp trong cơ sở dữ liệu của chúng tôi. Bạn có thể thử đặt câu hỏi theo cách khác hoặc liên hệ trực tiếp với phòng khám.'
          : response.answer,
        insufficient: response.insufficient_evidence,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([GREETING]);
    setError(null);
    setInput('');
  };

  if (!open) return null;

  console.log('[ChatbotWidget] Rendering popup, open is true');

  return (
    <div
      className="chatbot-widget"
      role="dialog"
      aria-label="Trợ lý ảo chăm sóc sức khỏe"
      aria-modal="true"
      ref={widgetRef}
    >
      {/* Header */}
      <div className="chatbot-widget-header">
        <div className="chatbot-widget-header-info">
          <div className="chatbot-widget-avatar" aria-hidden="true" style={{ overflow: 'hidden' }}>
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
            <strong>Trợ lý ảo</strong>
            <span className="chatbot-widget-status">
              <i className="chatbot-status-dot" aria-hidden="true" />
              Sẵn sàng hỗ trợ
            </span>
          </div>
        </div>
        <div className="chatbot-widget-header-actions">
          <button
            type="button"
            className="chatbot-widget-icon-btn"
            onClick={handleClear}
            title="Cuộc trò chuyện mới"
            aria-label="Cuộc trò chuyện mới"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
          <button
            type="button"
            className="chatbot-widget-icon-btn chatbot-widget-close"
            onClick={onClose}
            title="Đóng"
            aria-label="Đóng trợ lý ảo"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chatbot-widget-messages" role="log" aria-live="polite" aria-label="Tin nhắn">
        {messages.map(msg => (
          <div key={msg.id} className={`chatbot-msg chatbot-msg--${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="chatbot-msg-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2Z"/>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>
                </svg>
              </div>
            )}
            <div className={`chatbot-msg-bubble ${msg.insufficient ? 'chatbot-msg-bubble--warn' : ''}`}>
              {msg.insufficient && (
                <span className="chatbot-msg-warn-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </span>
              )}
              <p>{msg.text}</p>
              <time className="chatbot-msg-time">
                {msg.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="chatbot-msg chatbot-msg--assistant" aria-label="Đang xử lý">
            <div className="chatbot-msg-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2Z"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>
              </svg>
            </div>
            <div className="chatbot-msg-bubble chatbot-msg-bubble--loading" aria-hidden="true">
              <span /><span /><span />
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="chatbot-error" role="alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="chatbot-widget-input-area">
        <textarea
          ref={inputRef}
          className="chatbot-widget-input"
          placeholder="Nhập câu hỏi của bạn... (Enter để gửi)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading}
          aria-label="Nhập câu hỏi"
          maxLength={1000}
        />
        <button
          type="button"
          className="chatbot-widget-send"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          aria-label="Gửi câu hỏi"
        >
          {loading
            ? <svg className="chatbot-send-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          }
        </button>
      </div>
      <p className="chatbot-widget-disclaimer">Trợ lý ảo có thể mắc lỗi. Hãy kiểm tra với bác sĩ cho các quyết định y tế.</p>
    </div>
  );
}
