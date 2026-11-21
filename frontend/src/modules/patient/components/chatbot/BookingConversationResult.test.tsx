import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingConversationResult } from './BookingConversationResult';
import type { ChatBooking } from '../../../../services/chatbot';
afterEach(cleanup);
const booking: ChatBooking = { version: 'booking-graph-1.0.0', active: true, phase: 'ready', toolCalls: 3,
  trace: ['safety', 'intent', 'selection', 'list_doctors', 'availability', 'get_service_estimate', 'query_bookable_slots'],
  service: { id: '421179bf-19d1-436d-948f-65a61f7c35d7', code: 'PRENATAL_ROUTINE', name: 'Khám thai định kỳ chuẩn y khoa', specialtyId: 'cb62b6a3-f1eb-407b-95f1-29f3f0b14de8' },
  selectionMode: 'RANK', date: '2026-11-17', period: 'morning', availability: {
    checkedAt: '2026-11-16T10:00:00Z', moreAvailable: true,
    estimate: { basePrice: { amountMinor: 300000 }, doctorRankSurcharge: null, estimatedTotal: { amountMinor: 300000, currency: 'VND' } },
    items: [{ doctorId: 'd1', doctorName: 'Bác sĩ từ API', roomCode: 'P.202', startAt: '2026-11-17T08:00:00+07:00', endAt: '2026-11-17T08:30:00+07:00' }],
  } };
describe('Booking conversation snapshot', () => {
  it('requires a fresh ready result and revalidates before continuing', async () => {
    const onContinue = vi.fn(async () => { throw new Error('Bác sĩ không còn phù hợp'); });
    const { rerender } = render(<BookingConversationResult booking={booking} fresh onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục đặt khám' }));
    await screen.findByRole('alert');
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Bạn cần chọn lại ngày\/giờ/)).toBeVisible();
    rerender(<BookingConversationResult booking={booking} fresh={false} onContinue={onContinue} />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Tiếp tục đặt khám' })).not.toBeInTheDocument());
  });
  it('shows verified fields, price, time and no booking mutation control', () => {
    render(<BookingConversationResult booking={booking} fresh />);
    expect(screen.getByText('Khám thai định kỳ chuẩn y khoa')).toBeVisible();
    expect(screen.getByText(/Bệnh viện sắp xếp/)).toBeVisible();
    expect(screen.getByText(/Giá dự kiến: 300.000/)).toBeVisible();
    expect(screen.getByText(/Bác sĩ từ API/)).toBeVisible();
    expect(screen.getByText(/Chưa giữ chỗ hoặc xác nhận lịch/)).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('restored or superseded snapshots require a fresh read', () => {
    render(<BookingConversationResult booking={booking} fresh={false} />);
    expect(screen.getByText(/Dữ liệu lần tra trước/)).toBeVisible();
    expect(screen.queryByText(/Bác sĩ từ API/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Giá dự kiến/)).not.toBeInTheDocument();
  });
});
