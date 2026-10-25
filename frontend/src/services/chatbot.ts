const CHATBOT_BASE_URL = import.meta.env.VITE_CHATBOT_BASE_URL ?? 'http://localhost:8000';
const CHATBOT_TIMEOUT_MS = 60_000;

export interface ChatbotResponse {
  answer: string;
  latency?: { total_seconds: number };
  method?: string;
  insufficient_evidence?: boolean;
}

export interface ChatbotMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  insufficient?: boolean;
  timestamp: Date;
}

export async function sendChatMessage(message: string): Promise<ChatbotResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHATBOT_TIMEOUT_MS);

  try {
    const response = await fetch(`${CHATBOT_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 503) {
        throw new Error('Máy chủ trợ lý ảo hiện không khả dụng (503). Vui lòng thử lại sau.');
      }
      throw new Error(`Lỗi máy chủ: ${response.status}`);
    }

    return await response.json() as ChatbotResponse;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Yêu cầu đã hết thời gian chờ (60 giây). Vui lòng thử lại.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkChatbotHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${CHATBOT_BASE_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}
