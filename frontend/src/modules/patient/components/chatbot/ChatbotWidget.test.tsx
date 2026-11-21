import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatbotLauncher } from './ChatbotLauncher';
import { ApiError } from '../../../../services/api';

const mocked = vi.hoisted(() => ({ request: vi.fn(), user: { userId: 'patient-a', role: 'PATIENT' } as { userId: string; role: string } | null }));
vi.mock('../../../../app/AuthSessionProvider', () => ({
  useAuthSession: () => ({ request: mocked.request, user: mocked.user }),
}));

const citation = { index: 1, chunkId: 'guide::1', document: 'guide.md', section: 'Thai kỳ', excerpt: 'Đoạn gốc' };
const history = [
  { id: 'u1', role: 'user', text: 'Câu hỏi đã lưu', createdAt: new Date().toISOString() },
  { id: 'a1', role: 'assistant', text: 'Câu trả lời [1]', createdAt: new Date().toISOString(), citations: [citation] },
];
const emergencySafety = { decision: 'emergency', ruleVersion: 'maternal-safety-1.0.0',
  ruleIds: ['RF-BREATHING'], requiresHuman: true, emergencyPhone: '115' };
const emergencyMessage = { ...history[1], text: 'Hãy gọi 115 hoặc đến Cấp cứu ngay.',
  citations: [], insufficientEvidence: true, safety: emergencySafety };
function open() { fireEvent.click(screen.getByRole('button', { name: 'Trợ lý ảo hỏi đáp nhanh' })); }

beforeEach(() => {
  sessionStorage.clear();
  mocked.user = { userId: 'patient-a', role: 'PATIENT' };
  mocked.request.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Conversation widget', () => {
  it('keeps suggested questions as editable drafts and does not send during IME composition', async () => {
    render(<ChatbotLauncher />); open();
    await waitFor(() => expect(screen.getByLabelText('Nhập câu hỏi')).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Tôi muốn đặt khám' }));
    const input = screen.getByLabelText('Nhập câu hỏi');
    expect(input).toHaveValue('Tôi muốn đặt khám');
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(mocked.request).not.toHaveBeenCalled();
    expect(input).toHaveValue('Tôi muốn đặt khám');
  });
  it.each([
    [new TypeError('Failed to fetch'), 'Không kết nối được với trợ lý. Kiểm tra kết nối mạng rồi gửi lại câu hỏi.'],
    [new ApiError('internal upstream details', 503), 'Trợ lý tạm thời chưa phản hồi. Vui lòng thử lại sau; bạn vẫn có thể đặt khám tại trang Đặt lịch khám.'],
  ])('preserves the draft with an understandable connection failure', async (error, message) => {
    mocked.request.mockRejectedValue(error);
    render(<ChatbotLauncher />); open();
    await waitFor(() => expect(screen.getByLabelText('Nhập câu hỏi')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi'), { target: { value: 'Tôi muốn đặt khám' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByLabelText('Nhập câu hỏi')).toHaveValue('Tôi muốn đặt khám');
    expect(screen.queryByText('internal upstream details')).not.toBeInTheDocument();
  });
  it('does not revive a previous availability snapshot after canceling a new question', async () => {
    const allow = { decision: 'allow', requiresHuman: false, ruleVersion: 'maternal-safety-1.0.1', ruleIds: [] };
    const saved = { ...history[1], text: 'Kết quả tra cứu', citations: [], safety: allow, booking: {
      version: 'booking-graph-1.0.0', active: true, phase: 'ready', trace: [], toolCalls: 3,
      availability: { checkedAt: new Date().toISOString(), items: [], estimate: {
        basePrice: { amountMinor: 300000 }, doctorRankSurcharge: null, estimatedTotal: { amountMinor: 300000, currency: 'VND' },
      } },
    } };
    let turns = 0;
    mocked.request.mockImplementation(async (path, init) => {
      if (path.endsWith('/messages')) {
        if (++turns === 1) return { answer: saved.text, messages: [history[0], saved], safety: allow };
        return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
      }
      if (init?.method === 'POST') return { conversationId: 'c1', messages: [] };
      return { conversationId: 'c1', messages: [history[0], saved], state: { safety: allow } };
    });
    render(<ChatbotLauncher />); open();
    await waitFor(() => expect(screen.getByLabelText('Nhập câu hỏi')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi'), { target: { value: 'Tra lịch' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));
    await screen.findByLabelText('Kết quả lịch qua hội thoại');
    await waitFor(() => expect(screen.getByLabelText('Nhập câu hỏi')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi'), { target: { value: 'Hỏi tiếp' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));
    await screen.findByText('Dừng chờ phản hồi');
    fireEvent.click(screen.getByText('Dừng chờ phản hồi'));
    await waitFor(() => expect(screen.getByLabelText('Nhập câu hỏi')).toBeEnabled());
    expect(screen.queryByLabelText('Kết quả lịch qua hội thoại')).not.toBeInTheDocument();
    expect(screen.getByText(/Dữ liệu lần tra trước/)).toBeVisible();
  });
  it('restores server history and displays traceable source details', async () => {
    sessionStorage.setItem('an-tam-chat:patient-a', 'conversation-a');
    mocked.request.mockResolvedValue({ conversationId: 'conversation-a', messages: history });
    render(<ChatbotLauncher />); open();
    expect(await screen.findByText('Câu hỏi đã lưu')).toBeVisible();
    fireEvent.click(screen.getByText('Nguồn tham khảo (1)'));
    expect(screen.getByText('[1] guide.md')).toBeVisible();
    expect(screen.getByText('Mã đoạn: guide::1')).toBeVisible();
    expect(mocked.request).toHaveBeenCalledWith('/api/assistant/conversations/conversation-a', expect.anything());
  });

  it('creates a session and sends only message plus request ID', async () => {
    mocked.request.mockImplementation(async (path, init) => {
      if (path.endsWith('/messages')) return { answer: 'Câu trả lời [1]' };
      if (init?.method === 'POST') return { conversationId: 'new-id', messages: [] };
      return { conversationId: 'new-id', messages: history };
    });
    render(<ChatbotLauncher />); open();
    await waitFor(() => expect(screen.getByLabelText('Nhập câu hỏi')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi'), { target: { value: 'Câu hỏi mới' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));
    expect(await screen.findByText('Câu trả lời [1]')).toBeVisible();
    const [, init] = mocked.request.mock.calls.find(([path]) => path.endsWith('/messages'))!;
    expect(Object.keys(JSON.parse(init.body)).sort()).toEqual(['message', 'requestId']);
    expect(sessionStorage.getItem('an-tam-chat:patient-a')).toBe('new-id');
  });

  it('deletes the old server session before resetting the conversation', async () => {
    sessionStorage.setItem('an-tam-chat:patient-a', 'conversation-a');
    mocked.request.mockImplementation(async (_path, init) => init?.method === 'DELETE' ? undefined : { messages: history });
    render(<ChatbotLauncher />); open();
    await screen.findByText('Câu hỏi đã lưu');
    fireEvent.click(screen.getByLabelText('Cuộc trò chuyện mới'));
    await waitFor(() => expect(screen.queryByText('Câu hỏi đã lưu')).not.toBeInTheDocument());
    expect(mocked.request).toHaveBeenCalledWith('/api/assistant/conversations/conversation-a', { method: 'DELETE' });
    expect(sessionStorage.getItem('an-tam-chat:patient-a')).toBeNull();
  });

  it('does not display patient A history after switching to patient B', async () => {
    sessionStorage.setItem('an-tam-chat:patient-a', 'conversation-a');
    mocked.request.mockResolvedValue({ messages: history });
    const view = render(<ChatbotLauncher />); open();
    await screen.findByText('Câu hỏi đã lưu');
    mocked.user = { userId: 'patient-b', role: 'PATIENT' };
    view.rerender(<ChatbotLauncher />);
    await waitFor(() => expect(screen.queryByText('Câu hỏi đã lưu')).not.toBeInTheDocument());
    expect(mocked.request).toHaveBeenCalledTimes(1);
  });

  it('retries restoration rather than overwriting a temporarily unavailable session', async () => {
    sessionStorage.setItem('an-tam-chat:patient-a', 'conversation-a');
    mocked.request.mockRejectedValueOnce(new ApiError('unavailable', 503))
      .mockResolvedValueOnce({ messages: history });
    render(<ChatbotLauncher />); open();
    fireEvent.click(await screen.findByText('Tải lại hội thoại'));
    expect(await screen.findByText('Câu hỏi đã lưu')).toBeVisible();
    expect(mocked.request.mock.calls.every(([, init]) => !init.method)).toBe(true);
  });

  it('shows the server refusal verbatim and no source for insufficient evidence', async () => {
    sessionStorage.setItem('an-tam-chat:patient-a', 'conversation-a');
    mocked.request.mockResolvedValue({ messages: [{ ...history[1], citations: [], text: 'Không đủ bằng chứng trong tài liệu.', insufficientEvidence: true }] });
    render(<ChatbotLauncher />); open();
    expect(await screen.findByText('Không đủ bằng chứng trong tài liệu.')).toBeVisible();
    expect(screen.queryByText(/Nguồn tham khảo/)).not.toBeInTheDocument();
    expect(screen.getByText(/Thông tin chỉ mang tính tham khảo/)).toBeVisible();
  });

  it('allows resetting a session already removed or expired on the server', async () => {
    sessionStorage.setItem('an-tam-chat:patient-a', 'conversation-a');
    mocked.request.mockResolvedValueOnce({ messages: history })
      .mockRejectedValueOnce(new ApiError('missing', 404));
    render(<ChatbotLauncher />); open();
    await screen.findByText('Câu hỏi đã lưu');
    fireEvent.click(screen.getByLabelText('Cuộc trò chuyện mới'));
    await waitFor(() => expect(screen.queryByText('Câu hỏi đã lưu')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Nhập câu hỏi')).toBeEnabled();
    expect(sessionStorage.getItem('an-tam-chat:patient-a')).toBeNull();
  });

  it('restores the emergency warning and call link from server state', async () => {
    sessionStorage.setItem('an-tam-chat:patient-a', 'conversation-a');
    mocked.request.mockResolvedValue({ messages: [emergencyMessage], state: { safety: emergencySafety } });
    render(<ChatbotLauncher />); open();
    expect(await screen.findByText('Cảnh báo cấp cứu')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Gọi 115 ngay' })).toHaveAttribute('href', 'tel:115');
    expect(screen.getByText('Hãy gọi 115 hoặc đến Cấp cứu ngay.')).toBeVisible();
  });

  it('keeps an acknowledged emergency response visible when history refresh fails', async () => {
    mocked.request.mockImplementation(async (path, init) => {
      if (path.endsWith('/messages')) return { answer: emergencyMessage.text,
        messages: [emergencyMessage], safety: emergencySafety };
      if (init?.method === 'POST') return { conversationId: 'new-id', messages: [] };
      throw new ApiError('Unavailable', 503);
    });
    render(<ChatbotLauncher />); open();
    await waitFor(() => expect(screen.getByLabelText('Nhập câu hỏi')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi'), { target: { value: 'Tôi khó thở' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));
    expect(await screen.findByText('Cảnh báo cấp cứu')).toBeVisible();
    expect(screen.getByText(emergencyMessage.text)).toBeVisible();
    expect(await screen.findByText(/Đã nhận phản hồi nhưng chưa tải lại được lịch sử/)).toBeVisible();
  });

  it('shows an urgent referral without labelling it an emergency', async () => {
    sessionStorage.setItem('an-tam-chat:patient-a', 'conversation-a');
    const safety = { ...emergencySafety, decision: 'urgent', emergencyPhone: null };
    mocked.request.mockResolvedValue({ messages: [], state: { safety } });
    render(<ChatbotLauncher />); open();
    expect(await screen.findByText('Cần được nhân viên y tế đánh giá ngay')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Gọi 115 ngay' })).not.toBeInTheDocument();
  });

  it('clears the chat alert only after deleting the old session', async () => {
    sessionStorage.setItem('an-tam-chat:patient-a', 'conversation-a');
    mocked.request.mockResolvedValueOnce({ messages: [emergencyMessage], state: { safety: emergencySafety } })
      .mockResolvedValueOnce(undefined);
    render(<ChatbotLauncher />); open();
    await screen.findByText('Cảnh báo cấp cứu');
    fireEvent.click(screen.getByLabelText('Cuộc trò chuyện mới'));
    await waitFor(() => expect(screen.queryByText('Cảnh báo cấp cứu')).not.toBeInTheDocument());
    expect(mocked.request).toHaveBeenLastCalledWith('/api/assistant/conversations/conversation-a', { method: 'DELETE' });
  });

  it('keeps a guest emergency visible and stops further stateless questions in that chat', async () => {
    mocked.user = null;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      answer: emergencyMessage.text, safety: emergencySafety, citations: [], insufficientEvidence: true,
    }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatbotLauncher />); open();
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi'), { target: { value: 'Tôi khó thở' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));
    expect(await screen.findByText('Cảnh báo cấp cứu')).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText('Nhập câu hỏi')).toBeDisabled());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Gọi 115 ngay' })).toHaveAttribute('href', 'tel:115');
  });

  it('lets a patient stop waiting so they can report an emergency immediately', async () => {
    mocked.request.mockImplementation(async (path, init) => {
      if (init?.method === 'POST' && !path.endsWith('/messages')) return { conversationId: 'new-id', messages: [] };
      if (path.endsWith('/messages')) return new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
      return { messages: [] };
    });
    render(<ChatbotLauncher />); open();
    await waitFor(() => expect(screen.getByLabelText('Nhập câu hỏi')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Nhập câu hỏi'), { target: { value: 'Câu hỏi đang chờ model' } });
    fireEvent.click(screen.getByLabelText('Gửi câu hỏi'));
    await waitFor(() => expect(mocked.request.mock.calls.some(([path]) => path.endsWith('/messages'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Dừng chờ phản hồi' }));
    await waitFor(() => expect(screen.getByLabelText('Nhập câu hỏi')).toBeEnabled());
    expect(screen.getByText(/Đã dừng chờ phản hồi/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Cấp cứu: 115' })).toHaveAttribute('href', 'tel:115');
  });

  it('restores catalog cards with the real service path and separate provenance', async () => {
    sessionStorage.setItem('an-tam-chat:patient-a', 'conversation-a');
    const candidate = { resourceType: 'MedicalService', id: '421179bf-19d1-436d-948f-65a61f7c35d7',
      code: 'PRENATAL_ROUTINE', name: 'Khám thai định kỳ chuẩn y khoa', slug: 'kham-thai-dinh-ky-chuan-y-khoa',
      specialty: { id: 'cb62b6a3-f1eb-407b-95f1-29f3f0b14de8', code: 'OBSTETRICS', name: 'Sản khoa' },
      source: { verifiedAt: new Date().toISOString() } };
    mocked.request.mockResolvedValue({ messages: [{ ...history[1], text: 'Danh mục hiện hành', citations: [],
      catalog: { outcome: 'matches', clinicalEvidence: false, candidates: [candidate] } }] });
    render(<ChatbotLauncher />); open();
    expect(await screen.findByText('Khám thai định kỳ chuẩn y khoa')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Xem thông tin dịch vụ' })).toHaveAttribute('href', '/dich-vu/kham-thai-dinh-ky-chuan-y-khoa');
    expect(screen.getByText('Chuyên khoa: Sản khoa')).toBeVisible();
    expect(screen.queryByText(/Nguồn tham khảo \(/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Nguồn danh mục bệnh viện'));
    expect(screen.getByText('Mã: PRENATAL_ROUTINE')).toBeVisible();
  });

  it('marks packages needing staff confirmation and does not add a booking action', async () => {
    sessionStorage.setItem('an-tam-chat:patient-a', 'conversation-a');
    mocked.request.mockResolvedValue({ messages: [{ ...history[1], text: 'Thông tin gói', citations: [], catalog: {
      outcome: 'matches', clinicalEvidence: false, candidates: [{ resourceType: 'MedicalService', id: '042f3fc8-83c0-4f5f-851d-961903caf633',
        code: 'PACKAGE_BIRTH_STANDARD', name: 'Gói sinh con thường trọn gói Hạnh Phúc',
        slug: 'goi-sinh-con-thuong-tron-goi-hanh-phuc', requiresStaffConfirmation: true,
        source: { verifiedAt: new Date().toISOString() } }],
    } }] });
    render(<ChatbotLauncher />); open();
    expect(await screen.findByText('Thông tin gói cần bộ phận dịch vụ xác nhận.')).toBeVisible();
    expect(screen.queryByRole('link', { name: /đặt khám|đặt lịch/i })).not.toBeInTheDocument();
  });
});
