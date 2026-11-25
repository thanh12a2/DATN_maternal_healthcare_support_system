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
  AppLink: ({ href, children, onClick, ...props }: React.ComponentProps<'a'>) => (
    <a {...props} href={href} onClick={(event) => {
      onClick?.(event);
      if (!event.defaultPrevented) mocks.navigate(href);
      event.preventDefault();
    }}>{children}</a>
  ),
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
  it('opens the six maternity milestones without the week slider', async () => {
    render(<PortalLandingPage />);
    const { doc } = await mountDocument();
    const journey = doc.querySelector('#ts')!;
    expect(journey.querySelector('[role="slider"]')).toBeNull();
    const milestones = journey.querySelectorAll<HTMLButtonElement>('.journey-thumbs button');
    expect(milestones).toHaveLength(6);
    fireEvent.click(journey.querySelector('.journey-caption')!);
    fireEvent.click(milestones[5]);
    expect(journey.querySelector('.journey-copy h3')).toHaveTextContent('Chuẩn bị chuyển dạ');
    fireEvent.click(journey.querySelector('.journey-back')!);
    expect(journey.querySelector('.journey-caption')).toHaveAttribute('aria-expanded', 'false');
  });

  it('mounts account controls and sends guest booking to the existing login flow', async () => {
    render(<PortalLandingPage />);
    const { doc } = await mountDocument();
    expect(
      screen.getByRole('link', { name: 'Đăng nhập' }),
    ).toBeInTheDocument();
    expect(doc.querySelector('body > nav')).toBeNull();
    const navigation = screen.getByRole('navigation', { name: 'Thanh điều hướng chính' });
    expect(within(navigation).getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('aria-current', 'page');
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
    const specialties = within(navigation).getByRole('button', { name: 'Chuyên khoa' });
    fireEvent.click(specialties);
    fireEvent.click(
      within(navigation).getByRole('menuitem', { name: 'Sản khoa' }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith('/chuyen-khoa/san-khoa');
    expect(specialties).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(specialties);
    fireEvent.keyDown(specialties, { key: 'Escape' });
    expect(specialties).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('link', { name: 'Đặt lịch khám' }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      '/dang-nhap?returnUrl=/dat-lich',
    );
    fireEvent.click(doc.querySelector('#vas')!);
    expect(mocks.navigate).toHaveBeenCalledWith(
      '/dang-nhap?returnUrl=/dat-lich',
    );
    fireEvent.click(doc.querySelector('#ag a')!);
    expect(mocks.navigate).toHaveBeenCalledWith('/chuyen-khoa/san-khoa');
    const footer = doc.querySelector<HTMLElement>('footer.ta-footer')!;
    expect(footer).toHaveTextContent('Dịch vụ & Gói thai sản');
    expect(footer).toHaveTextContent('Hỗ trợ & Khẩn cấp');
    fireEvent.click(within(footer).getByRole('link', { name: 'Cẩm nang kiến thức cho mẹ bầu' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/cam-nang-thai-ky');
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
    const navigation = screen.getByRole('navigation', { name: 'Thanh điều hướng chính' });
    const appointments = within(navigation).getByRole('link', {
      name: 'Lịch hẹn của tôi',
    });
    expect(appointments).toHaveAttribute('href', '/lich-hen');
    fireEvent.click(appointments);
    expect(mocks.navigate).toHaveBeenCalledWith('/lich-hen');
    expect(
      screen.getByRole('button', { name: 'Thông báo' }),
    ).toBeInTheDocument();
    fireEvent.click(doc.querySelector('#vas')!);
    expect(mocks.navigate).toHaveBeenCalledWith('/dat-lich');
    fireEvent.click(screen.getByRole('button', { name: /Menu tài khoản/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất tài khoản' }));
    expect(mocks.auth.signOut).toHaveBeenCalledOnce();
  });

  it('keeps the homepage available when public APIs fail and allows a retry', async () => {
    mocks.api.mockRejectedValue(new Error('Offline'));
    render(<PortalLandingPage />);
    const frame = (await screen.findByTitle('Cổng bệnh nhân Tâm An')) as HTMLIFrameElement;
    await waitFor(() => expect(frame.srcdoc).toContain('retry-public'));
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
