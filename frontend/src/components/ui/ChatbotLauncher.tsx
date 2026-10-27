import { useCallback, useState } from 'react';
import { ChatbotWidget } from './ChatbotWidget';
import '../../styles/patient-home.css';

export function ChatbotLauncher() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);
  const canRenderMascot = typeof window.matchMedia === 'function';

  if (!canRenderMascot) return null;

  return (
    <>
      {!open && (
        <button
          id="patient-chatbot-launcher-btn"
          type="button"
          className="patient-chatbot-launcher"
          aria-label="Trợ lý ảo chăm sóc sức khỏe"
          aria-expanded={false}
          onClick={toggle}
        >
          <span className="patient-chatbot-mascot" aria-hidden="true" style={{ pointerEvents: 'none' }}>
            <span
              style={{
                width: 54,
                height: 54,
                display: 'block',
                backgroundImage: 'url(/mascots/crt-directions.webp)',
                backgroundSize: '300% 300%',
                backgroundPosition: '50% 50%',
                backgroundRepeat: 'no-repeat',
              }}
            />
          </span>
          <span className="patient-chatbot-copy" style={{ pointerEvents: 'none' }}>
            <strong>Trợ lý ảo</strong>
            <small>Hỏi đáp nhanh</small>
          </span>
        </button>
      )}
      <ChatbotWidget open={open} onClose={close} />
    </>
  );
}
