import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { PortalLandingPage } from './PortalLandingPage';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  navigate: vi.fn(),
  auth: {
    status: 'anonymous',
    user: null as null | { userId: string; role: string; email: string },
    signOut: vi.fn(),
  },
}));
vi.mock('../../../services/api', () => ({ apiRequest: mocks.api }));
vi.mock('../../../app/AuthSessionProvider', () => ({
  useAuthSession: () => mocks.auth,
}));
vi.mock('../../../app/navigation', () => ({
  navigate: mocks.navigate,
  AppLink: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock('../../../shared/components/notifications/NotificationBell', () => ({
  NotificationBell: () => <button>Thông báo</button>,
}));
vi.mock('../components/chatbot/ChatbotLauncher', () => ({
  ChatbotLauncher: () => <button>Chatbot</button>,
}));
vi.mock('../components/landing/PatientSummary', () => ({
  PatientSummary: () => <section>Thông tin bệnh nhân</section>,
}));

async function mountDocument() {
  const frame = (await screen.findByTitle(
    'Cổng bệnh nhân Tâm An',
  )) as HTMLIFrameElement;
  // jsdom does not load srcDoc; write the generated document and deliver the browser's load event.
  const doc = frame.contentDocument!;
  await act(async () => {
    doc.open();
    doc.write(frame.srcdoc);
    doc.close();
    fireEvent.load(frame);
  });
  return { frame, doc };
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.auth.status = 'anonymous';
  mocks.auth.user = null;
  mocks.api.mockImplementation(async (path: string) =>
    path.includes('specialties')
      ? { data: [{ slug: 'san-khoa', name: 'Sản khoa' }] }
      : { data: [] },
  );
});

describe('patient landing integration', () => {
  it('mounts account controls and sends guest booking to the existing login flow', async () => {
    render(<PortalLandingPage />);
    const { doc } = await mountDocument();
    expect(
      within(doc.body).getByRole('link', { name: 'Đăng nhập' }),
    ).toBeInTheDocument();
    const navigation = within(doc.body).getByRole('navigation', {
      name: 'Danh mục cổng bệnh nhân',
    });
    for (const [name, href] of [
      ['Trang chủ', '/'],
      ['Đội ngũ Bác sĩ', '/bac-si'],
      ['Cẩm nang thai kỳ', '/cam-nang-thai-ky'],
      ['Bảng giá dịch vụ', '/dich-vu'],
    ]) {
      const link = within(navigation).getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      if (href !== '/') {
        fireEvent.click(link);
        expect(mocks.navigate).toHaveBeenCalledWith(href);
      }
    }
    expect(
      within(navigation).queryByRole('link', { name: 'Lịch hẹn của tôi' }),
    ).toBeNull();
    const specialties = navigation.querySelector('details')!;
    specialties.open = true;
    fireEvent.click(
      within(specialties).getByRole('link', { name: 'Sản khoa' }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith('/chuyen-khoa/san-khoa');
    expect(specialties.open).toBe(false);
    specialties.open = true;
    fireEvent.keyDown(specialties, { key: 'Escape' });
    expect(specialties.open).toBe(false);
    fireEvent.click(doc.querySelector('body > nav > .bk')!);
    expect(mocks.navigate).toHaveBeenCalledWith(
      '/dang-nhap?returnUrl=/dat-lich',
    );
    fireEvent.click(doc.querySelector('#vas')!);
    expect(mocks.navigate).toHaveBeenCalledWith(
      '/dang-nhap?returnUrl=/dat-lich',
    );
    fireEvent.click(doc.querySelector('#ag a')!);
    expect(mocks.navigate).toHaveBeenCalledWith('/chuyen-khoa/san-khoa');
    expect(screen.getByRole('button', { name: 'Chatbot' })).toBeInTheDocument();
  });

  it('updates auth controls without recreating the animation document', async () => {
    const view = render(<PortalLandingPage />);
    const { doc, frame } = await mountDocument();
    const original = frame.srcdoc;
    mocks.auth.status = 'authenticated';
    mocks.auth.user = {
      userId: 'p1',
      role: 'PATIENT',
      email: 'patient@example.com',
    };
    view.rerender(<PortalLandingPage />);
    expect(frame.contentDocument).toBe(doc);
    expect(frame.srcdoc).toBe(original);
    const navigation = within(doc.body).getByRole('navigation', {
      name: 'Danh mục cổng bệnh nhân',
    });
    const appointments = within(navigation).getByRole('link', {
      name: 'Lịch hẹn của tôi',
    });
    expect(appointments).toHaveAttribute('href', '/lich-hen');
    fireEvent.click(appointments);
    expect(mocks.navigate).toHaveBeenCalledWith('/lich-hen');
    expect(
      within(doc.body).getByRole('button', { name: 'Thông báo' }),
    ).toBeInTheDocument();
    fireEvent.click(doc.querySelector('#vas')!);
    expect(mocks.navigate).toHaveBeenCalledWith('/dat-lich');
    fireEvent.click(
      within(doc.body).getByRole('button', { name: 'Đăng xuất' }),
    );
    expect(mocks.auth.signOut).toHaveBeenCalledOnce();
  });

  it('keeps the homepage available when public APIs fail and allows a retry', async () => {
    mocks.api.mockRejectedValue(new Error('Offline'));
    render(<PortalLandingPage />);
    const { doc } = await mountDocument();
    expect(doc.querySelector('#retry-public')).not.toBeNull();
    expect(doc.querySelector('#hero')).not.toBeNull();
    mocks.api.mockResolvedValue({ data: [] });
    const before = mocks.api.mock.calls.length;
    fireEvent.click(doc.querySelector('#retry-public')!);
    await waitFor(() =>
      expect(mocks.api.mock.calls.length).toBeGreaterThan(before),
    );
  });

  it('cancels public requests when leaving the homepage', () => {
    mocks.api.mockImplementation(() => new Promise(() => {}));
    const view = render(<PortalLandingPage />);
    const signal = mocks.api.mock.calls[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
});
