import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { AppLink, navigate } from '../../../app/navigation';
import { apiRequest } from '../../../services/api';
import { NotificationBell } from '../../../shared/components/notifications/NotificationBell';
import { ChatbotLauncher } from '../components/chatbot/ChatbotLauncher';
import { PatientSummary } from '../components/landing/PatientSummary';
import {
  buildLandingDocument,
  type LandingData,
} from '../components/landing/document';

const list = <T,>(raw: unknown): T[] => {
  const value = raw as { data?: unknown; items?: unknown } | null;
  const result = Array.isArray(raw) ? raw : (value?.data ?? value?.items);
  return Array.isArray(result) ? result : [];
};
// Use the existing public contracts, with a shared deadline and cancellation on unmount.
async function loadSpecialties(signal: AbortSignal) {
  try {
    const values = list<LandingData['specialties'][number]>(
      await apiRequest('/api/doctors/specialties', { signal }),
    );
    if (values.length) return values.filter((s) => s.slug && s.name);
  } catch (error) {
    if (signal.aborted) throw error;
  }
  return list<LandingData['specialties'][number]>(
    await apiRequest('/specialties', { signal }),
  ).filter((s) => s.slug && s.name);
}
export function PortalLandingPage() {
  const auth = useAuthSession();
  const frame = useRef<HTMLIFrameElement>(null);
  const [content, setContent] = useState<{
    html: string;
    data: LandingData;
  } | null>(null);
  const [slots, setSlots] = useState<{
    actions: Element;
    summary: Element;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    Promise.allSettled([
      loadSpecialties(controller.signal),
      apiRequest('/api/catalog/services?limit=100', {
        signal: controller.signal,
      }),
      apiRequest('/api/doctors', { signal: controller.signal }),
    ])
      .then(([specialties, services, doctors]) => {
        if (!active) return;
        const data: LandingData = {
          specialties:
            specialties.status === 'fulfilled' ? specialties.value : [],
          services: services.status === 'fulfilled' ? list(services.value) : [],
          doctors: doctors.status === 'fulfilled' ? list(doctors.value) : [],
          errors: [],
        };
        if (specialties.status === 'rejected') data.errors.push('chuyên khoa');
        if (services.status === 'rejected') data.errors.push('dịch vụ');
        if (doctors.status === 'rejected') data.errors.push('bác sĩ');
        setSlots(null);
        setContent({ html: buildLandingDocument(data), data });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [revision]);
  const loaded = useCallback(() => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    const actions = doc.getElementById('patient-actions'),
      summary = doc.getElementById('patient-summary');
    if (actions && summary) setSlots({ actions, summary });
  }, []);
  useEffect(() => {
    const doc = slots?.actions.ownerDocument;
    if (!doc) return;
    doc.querySelectorAll<HTMLElement>('[data-patient-only]').forEach((link) => {
      link.hidden =
        auth.status !== 'authenticated' || auth.user?.role !== 'PATIENT';
    });
    const closeMenus = (event: PointerEvent | KeyboardEvent) => {
      doc
        .querySelectorAll<HTMLDetailsElement>('body > nav details[open]')
        .forEach((menu) => {
          if (event.type === 'keydown') {
            if ((event as KeyboardEvent).key !== 'Escape') return;
            menu.open = false;
            menu.querySelector('summary')?.focus();
          } else if (!menu.contains(event.target as Node)) menu.open = false;
        });
    };
    // Async React content can move the template's scroll-triggered sections.
    const refresh = () =>
      (
        doc.defaultView as
          (Window & { ScrollTrigger?: { refresh(): void } }) | null
      )?.ScrollTrigger?.refresh();
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(refresh)
        : null;
    if (slots) observer?.observe(slots.summary);
    const click = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target?.closest) return;
      if (target.closest('#retry-public')) {
        setRevision((v) => v + 1);
        return;
      }
      const link = target.closest('a');
      const href = link?.getAttribute('href');
      if (link) link.closest('details')?.removeAttribute('open');
      if (
        !href?.startsWith('/') ||
        href.startsWith('//') ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      if (href === '/') {
        // The template's logo already uses its original Lenis scroll animation.
        doc.querySelector<HTMLAnchorElement>('body > nav > .logo')?.click();
        return;
      }
      navigate(
        href === '/dat-lich' && auth.status !== 'authenticated'
          ? '/dang-nhap?returnUrl=/dat-lich'
          : href,
      );
    };
    doc.addEventListener('click', click);
    doc.addEventListener('pointerdown', closeMenus);
    doc.addEventListener('keydown', closeMenus);
    return () => {
      doc.removeEventListener('click', click);
      doc.removeEventListener('pointerdown', closeMenus);
      doc.removeEventListener('keydown', closeMenus);
      observer?.disconnect();
    };
  }, [slots, auth.status, auth.user?.role]);
  return (
    <>
      {!content ? (
        <div role="status" style={{ padding: 48 }}>
          Đang chuẩn bị cổng bệnh nhân Tâm An…
        </div>
      ) : (
        <iframe
          ref={frame}
          title="Cổng bệnh nhân Tâm An"
          srcDoc={content.html}
          onLoad={loaded}
          style={{
            display: 'block',
            width: '100%',
            height: '100dvh',
            border: 0,
            background: '#faf3e4',
          }}
        />
      )}
      {slots &&
        createPortal(
          <>
            {auth.status === 'authenticated' &&
              auth.user?.role === 'PATIENT' && <NotificationBell />}
            {auth.status === 'authenticated' ? (
              <details className="patient-menu">
                <summary aria-label="Mở menu tài khoản">
                  <span className="patient-menu-avatar" aria-hidden="true">
                    {auth.user?.email.slice(0, 1).toUpperCase()}
                  </span>
                  <span>Tài khoản</span>
                </summary>
                <div className="patient-menu-panel">
                  <span>{auth.user?.email}</span>
                  <AppLink href="/ho-so/hoan-thien">Hồ sơ bệnh nhân</AppLink>
                  <AppLink href="/lich-hen">Lịch hẹn</AppLink>
                  <AppLink href="/thong-bao-hoa-don">
                    Thông báo & hóa đơn
                  </AppLink>
                  <button onClick={() => void auth.signOut()}>Đăng xuất</button>
                </div>
              </details>
            ) : (
              <div className="landing-auth-links">
                <AppLink href="/dang-nhap">Đăng nhập</AppLink>
                <AppLink href="/dang-ky">Đăng ký</AppLink>
              </div>
            )}
          </>,
          slots.actions,
        )}
      {slots &&
        content &&
        createPortal(
          <PatientSummary doctors={content.data.doctors} />,
          slots.summary,
        )}
      <ChatbotLauncher />
    </>
  );
}
