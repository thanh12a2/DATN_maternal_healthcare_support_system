import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AppointmentTicketModal } from './AppointmentTicketModal';
import type { Appointment } from '../../../services/appointment';

describe('AppointmentTicketModal', () => {
  const mockAppointment: Appointment = {
    id: 'apt-123',
    appointmentCode: 'APTMVYV20U72B0C81',
    startAt: '2026-11-03T08:00:00Z',
    endAt: '2026-11-03T08:30:00Z',
    status: 'BOOKED',
    pricing: {
      serviceName: 'Khám phụ khoa tổng quát & Soi cổ tử cung kỹ thuật số',
      estimatedTotalMinor: 300000,
    },
    roomName: 'Phòng khám Sản Phụ khoa 202',
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AppointmentTicketModal
        isOpen={false}
        onClose={vi.fn()}
        appointment={mockAppointment}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders ticket details correctly when isOpen is true', () => {
    render(
      <AppointmentTicketModal
        isOpen={true}
        onClose={vi.fn()}
        appointment={mockAppointment}
        fallbackPatientName="Quang Nam"
        fallbackPhoneNumber="+84375158622"
        fallbackNationalId="001196000106"
        fallbackDoctorName="BS. Nguyễn Văn A"
        fallbackSpecialtyName="Phụ khoa"
      />,
    );

    // Banner mã tiếp đón
    expect(screen.getByText('MÃ PHIẾU HẸN TIẾP ĐÓN')).toBeDefined();
    expect(screen.getByText('APTMVYV20U72B0C81')).toBeDefined();

    // 1. Thông tin lịch hẹn y tế (bên trái)
    expect(screen.getByText('1. Thông tin lịch hẹn y tế')).toBeDefined();
    expect(
      screen.getByText('Khám phụ khoa tổng quát & Soi cổ tử cung kỹ thuật số'),
    ).toBeDefined();
    expect(screen.getByText('BS. Nguyễn Văn A')).toBeDefined();
    expect(screen.getByText('Phụ khoa')).toBeDefined();

    // 2. Thông tin người khám bệnh (bên phải)
    expect(screen.getByText('2. Thông tin người khám bệnh')).toBeDefined();
    expect(screen.getByText('Quang Nam')).toBeDefined();
    // Số điện thoại phải đổi từ +84 thành đầu 0
    expect(screen.getByText('0375158622')).toBeDefined();
    // Số CCCD hiển thị hết không bị che
    expect(screen.getByText('001196000106')).toBeDefined();

    // Chi phí tạm tính
    expect(screen.getByText(/300\.000/)).toBeDefined();

    // Nút in phiếu hẹn và đóng
    expect(screen.getByText('In phiếu hẹn')).toBeDefined();
    expect(screen.getByText('Đóng')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <AppointmentTicketModal
        isOpen={true}
        onClose={onClose}
        appointment={mockAppointment}
      />,
    );

    const closeBtn = screen.getByText('Đóng');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows and calls onGoToAppointments when provided', () => {
    const onGoToAppointments = vi.fn();
    render(
      <AppointmentTicketModal
        isOpen={true}
        onClose={vi.fn()}
        appointment={mockAppointment}
        showGoToAppointmentsBtn={true}
        onGoToAppointments={onGoToAppointments}
      />,
    );

    const navBtn = screen.getByText('Xem lịch hẹn của tôi');
    expect(navBtn).toBeDefined();
    fireEvent.click(navBtn);
    expect(onGoToAppointments).toHaveBeenCalledTimes(1);
  });
});
