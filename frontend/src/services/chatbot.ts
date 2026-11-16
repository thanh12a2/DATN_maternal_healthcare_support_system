const CHATBOT_BASE_URL =
  import.meta.env.VITE_CHATBOT_BASE_URL ?? 'http://localhost:8000';
const CHATBOT_TIMEOUT_MS = 230_000;

export interface ChatCitation {
  index: number;
  chunkId: string;
  document: string;
  section: string;
  excerpt: string;
}

export interface ChatSafety {
  decision: 'allow' | 'emergency' | 'urgent' | 'clarify' | 'restricted' | 'handoff';
  ruleVersion: string;
  ruleIds: string[];
  requiresHuman: boolean;
  emergencyPhone?: string | null;
  references?: { title: string; url: string }[];
}

export interface ChatCatalogCandidate {
  resourceType: 'MedicalService' | 'Specialty';
  id: string;
  code: string;
  name: string;
  slug: string | null;
  status: 'ACTIVE';
  updatedAt: string;
  specialtyId?: string | null;
  specialty?: { id: string; code: string; name: string };
  bookingEnabled?: boolean;
  doctorRankSelectionPolicy?: 'NOT_REQUIRED' | 'BASIC_INCLUDED' | 'RANK_UPGRADE_ALLOWED';
  durationMinutes?: number | null;
  kind?: string;
  version?: number;
  requiresStaffConfirmation?: boolean;
  source: { sourceType: 'hospital_catalog'; sourcePath: string; sourceId: string;
    indexedAt: string; verifiedAt: string; updatedAt: string; fieldsUsed: string[];
    indexVersion: string; contentHash: string };
}

export interface ChatCatalog {
  outcome: 'matches' | 'clarify' | 'no_match' | 'unavailable';
  candidates: ChatCatalogCandidate[];
  clinicalEvidence: false;
  indexVersion: string;
  indexedAt?: string;
}

export interface StoredChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  citations?: ChatCitation[];
  insufficientEvidence?: boolean;
  safety?: ChatSafety;
  catalog?: ChatCatalog;
  booking?: ChatBooking;
  personalization?: ChatPersonalization;
}

export interface PatientPreferences { revision: number; values: { preferredSelectionMode?: 'RANK' | 'DOCTOR'; preferredPeriod?: 'any' | 'morning' | 'afternoon' | 'evening' };
  updatedAt: string | null; expiresAt: string | null; source: 'user_declared'; }
export interface ChatPersonalization {
  version: string; userDeclared: PatientPreferences; aiSummary: string;
  official?: { source: 'system_record'; checkedAt: string; profileStatus: 'COMPLETE' | 'MISSING'; profileVersion: number | null;
    lastCompleted: { status: 'COMPLETED'; endAt: string; serviceId: string } | null;
    suggestedService?: { id: string; code: string; name: string; specialtyId: string }; };
}
export function getPatientPreferences(request: ChatRequest) { return request<PatientPreferences>('/api/assistant/memory'); }
export function deletePatientPreferences(request: ChatRequest) { return request<PatientPreferences>('/api/assistant/memory', { method: 'DELETE' }); }

export interface ChatBooking {
  version: string;
  active: boolean;
  phase: string;
  service?: { id: string; code: string; name: string; specialtyId: string };
  selectionMode?: 'DOCTOR' | 'RANK';
  doctor?: { id: string; name: string };
  date?: string;
  period?: 'any' | 'morning' | 'afternoon' | 'evening';
  time?: string;
  trace: string[];
  toolCalls: number;
  preferenceSources?: { selectionMode?: 'user_declared'; period?: 'user_declared' };
  doctors?: { id: string; profile: { fullName: string }; consultationRank: string }[];
  availability?: {
    checkedAt?: string;
    items?: { doctorId: string; doctorName: string | null; roomCode: string | null; startAt: string; endAt: string }[];
    estimate?: { basePrice: { amountMinor: number }; doctorRankSurcharge: { amountMinor: number } | null;
      estimatedTotal: { amountMinor: number; currency: string } };
    moreAvailable?: boolean;
    appointments?: { checkedAt: string; items: { id: string; appointmentCode: string; status: string; startAt: string }[]; nextPageToken?: string | null };
  };
}

export interface Conversation {
  conversationId: string;
  messages: StoredChatMessage[];
  state: { phase: 'qa' | 'catalog' | 'catalog_clarify' | 'booking' | 'personalization' | ChatSafety['decision']; turnCount: number; safety?: ChatSafety };
}

export type ChatRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
const CONVERSATIONS_PATH = '/api/assistant/conversations';

export function createConversation(request: ChatRequest, signal?: AbortSignal) {
  return request<Conversation>(CONVERSATIONS_PATH, { method: 'POST', signal });
}

export function getConversation(request: ChatRequest, id: string, signal?: AbortSignal) {
  return request<Conversation>(`${CONVERSATIONS_PATH}/${encodeURIComponent(id)}`, { signal });
}

export function deleteConversation(request: ChatRequest, id: string) {
  return request<void>(`${CONVERSATIONS_PATH}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function sendConversationMessage(request: ChatRequest, id: string, message: string,
  requestId: string, signal: AbortSignal) {
  return request<ChatbotResponse>(`${CONVERSATIONS_PATH}/${encodeURIComponent(id)}/messages`, {
    method: 'POST', body: JSON.stringify({ message, requestId }), signal,
  });
}

export function prepareBookingHandoff(request: ChatRequest, id: string, messageId: string, signal: AbortSignal) {
  return request<{ url: string; readOnly: true; checkedAt: string }>(`${CONVERSATIONS_PATH}/${encodeURIComponent(id)}/handoff`, {
    method: 'POST', body: JSON.stringify({ messageId }), signal,
  });
}

export function toChatMessage(message: StoredChatMessage): ChatbotMessage {
  return { id: message.id, role: message.role, text: message.text,
    timestamp: new Date(message.createdAt), citations: message.citations,
    insufficient: message.insufficientEvidence, safety: message.safety, catalog: message.catalog, booking: message.booking, personalization: message.personalization };
}

export interface ChatbotResponse {
  answer: string;
  safety?: ChatSafety;
  catalog?: ChatCatalog;
  booking?: ChatBooking;
  personalization?: ChatPersonalization;
  conversationId?: string;
  messages?: StoredChatMessage[];
  citations?: ChatCitation[];
  insufficientEvidence?: boolean;
  state?: Conversation['state'];
  actions?: unknown[];
  disclaimer?: string;
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
  citations?: ChatCitation[];
  safety?: ChatSafety;
  catalog?: ChatCatalog;
  booking?: ChatBooking;
  personalization?: ChatPersonalization;
}

export async function sendChatMessage(
  message: string,
  signal?: AbortSignal,
): Promise<ChatbotResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHATBOT_TIMEOUT_MS);

  try {
    const response = await fetch(`${CHATBOT_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
    });

    if (!response.ok) {
      if (response.status === 503) {
        throw new Error(
          'Máy chủ trợ lý ảo hiện không khả dụng (503). Vui lòng thử lại sau.',
        );
      }
      throw new Error(`Lỗi máy chủ: ${response.status}`);
    }

    return (await response.json()) as ChatbotResponse;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        'Yêu cầu đã hết thời gian chờ. Vui lòng thử lại.',
      );
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
    const res = await fetch(`${CHATBOT_BASE_URL}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}
