import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingReadPanel } from './BookingReadPanel';
import type { ChatRequest } from '../../../../services/chatbot';
afterEach(cleanup);
describe('Booking read panel', () => {
  it('uses structured GET adapters through the conversation and shows empty slots honestly', async () => {
    const request = vi.fn(async (_path, init) => {
      const body = JSON.parse(init.body);
      if (body.name === 'list_doctors') return { items: [{ id: 'doctor-id', consultationRank: 'BASIC', profile: { fullName: 'Demo doctor' } }] };
      if (body.name === 'get_service_estimate') return { estimate: { basePrice: { amountMinor: 300000 }, doctorRankSurcharge: null, estimatedTotal: { amountMinor: 300000 } } };
      return { items: [], checkedAt: new Date().toISOString() };
    });
    render(<BookingReadPanel request={request as ChatRequest} conversationId="c1" serviceId="s1" blocked={false} />);
    fireEvent.click(screen.getByText('Tra bác sĩ và lịch'));
    await screen.findByText('Demo doctor');
    fireEvent.change(screen.getByLabelText('Ngày muốn khám'), { target: { value: '2026-11-17' } });
    fireEvent.click(screen.getByText('Tra lịch và giá tham khảo'));
    await screen.findByText(/Chưa có giờ trống phù hợp/);
    expect(request.mock.calls).toHaveLength(3);
    const query = JSON.parse(request.mock.calls[1][1].body);
    expect(query).toEqual({ name: 'query_bookable_slots', serviceId: 's1', date: '2026-11-17', selectionMode: 'RANK' });
    expect(request.mock.calls.every(([path]) => path === '/api/assistant/conversations/c1/tools')).toBe(true);
  });
  it('blocks reads during safety alerts and discards pending results', async () => {
    const request = vi.fn((_path, init) => new Promise(() => { expect(init.signal).toBeDefined(); }));
    const { rerender } = render(<BookingReadPanel request={request as ChatRequest} conversationId="c1" serviceId="s1" blocked={false} />);
    fireEvent.click(screen.getByText('Tra bác sĩ và lịch'));
    rerender(<BookingReadPanel request={request as ChatRequest} conversationId="c1" serviceId="s1" blocked />);
    await waitFor(() => expect(request.mock.calls[0][1].signal.aborted).toBe(true));
    expect(screen.getByText('Tra bác sĩ và lịch')).toBeDisabled();
  });
});
