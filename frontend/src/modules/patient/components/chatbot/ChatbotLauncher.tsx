import { useCallback, useState } from 'react';
import { ChatbotWidget } from './ChatbotWidget';
import '../../../../styles/portal-landing.css';

function ChatBubbleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: 26, height: 26 }}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function ChatbotLauncher() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      {!open && (
        <button
          id="patient-chatbot-launcher-btn"
          type="button"
          className="patient-chatbot-circle-btn"
          aria-label="Trợ lý ảo hỏi đáp nhanh"
          aria-expanded={false}
          onClick={toggle}
        >
          <span className="chatbot-icon-wrap" aria-hidden="true">
            <ChatBubbleIcon />
          </span>
          <span className="chatbot-tooltip" role="tooltip">
            Trợ lý ảo
          </span>
        </button>
      )}
      <ChatbotWidget open={open} onClose={close} />
    </>
  );
}
