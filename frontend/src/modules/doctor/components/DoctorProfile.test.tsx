import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DoctorProfileSchedule } from './DoctorProfileSchedule';

const doctor = {
  id: 'doctor-id',
  status: 'ACTIVE',
  consultationRank: 'SPECIALIST_I',
  version: 3,
  licenseNumber: 'CCHN-123',
  roomName: 'Phòng 1',
  updatedAt: '2026-01-01T00:00:00Z',
  profile: {
    fullName: 'Nguyễn Minh Anh',
    professionalTitle: 'Bác sĩ',
    biography: 'Giới thiệu',
    practiceStartYear: 2010,
    languages: ['vi'],
    photoUrl: 'https://cdn.antam.local/doctor.jpg',
  },
  specialties: [{ name: 'Sản khoa', isPrimary: true }],
};

describe('doctor profile', () => {
  it('displays the real profile details and avatar with a fallback for a broken image', async () => {
    const request = vi.fn().mockResolvedValue({ data: doctor });
    render(<DoctorProfileSchedule section="profile" request={request} />);
    const avatar = await screen.findByRole('img', {
      name: 'Ảnh đại diện của Nguyễn Minh Anh',
    });
    expect(avatar).toHaveAttribute('src', doctor.profile.photoUrl);
    expect(screen.getByText('CCHN-123')).toBeInTheDocument();
    expect(screen.getByText('2010')).toBeInTheDocument();
    expect(screen.getByText('Phòng 1')).toBeInTheDocument();
    fireEvent.error(avatar);
    await waitFor(() => expect(
      screen.queryByRole('img', { name: 'Ảnh đại diện của Nguyễn Minh Anh' }),
    ).not.toBeInTheDocument());
  });

  it('saves editable fields and removes a managed photo separately', async () => {
    const request = vi
      .fn()
      .mockImplementation((_path: string, init?: RequestInit) =>
        Promise.resolve({
          data:
            init?.method === 'PATCH'
              ? {
                  ...doctor,
                  version: 4,
                  profile: {
                    ...doctor.profile,
                    photoUrl: doctor.profile.photoUrl,
                    languages: ['vi', 'en'],
                  },
                }
              : doctor,
        }),
      );
    render(<DoctorProfileSchedule section="profile" request={request} />);
    fireEvent.click(
      await screen.findByRole('button', { name: /Đổi ảnh đại diện/ }),
    );
    fireEvent.click(screen.getByText('Xóa ảnh').closest('button')!);
    fireEvent.change(screen.getByLabelText('Ngôn ngữ sử dụng'), {
      target: { value: 'vi, en' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/api/doctors/doctor-id',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'If-Match': '3' },
          body: JSON.stringify({
            biography: 'Giới thiệu',
            languages: ['vi', 'en'],
          }),
        }),
      ),
    );
    await waitFor(() => expect(request).toHaveBeenCalledWith(
      '/api/doctors/doctor-id/photo', { method: 'DELETE' },
    ));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Đã lưu thông tin hồ sơ',
    );
  });
});
