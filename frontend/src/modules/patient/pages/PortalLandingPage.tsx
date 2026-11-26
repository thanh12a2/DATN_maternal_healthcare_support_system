import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate } from '../../../app/navigation';
import { apiRequest } from '../../../services/api';
import { PublicPortalHeader } from '../../../shared/components/portal/PublicPortalHeader';
import { PublicPortalFooter } from '../../../shared/components/portal/PublicPortalFooter';
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
  const savedScroll = useRef(0);
  const [content, setContent] = useState<{
    html: string;
    data: LandingData;
  }>(() => {
    const data: LandingData = { specialties: [], services: [], doctors: [], errors: [] };
    return { html: buildLandingDocument(data), data };
  });
  const [summary, setSummary] = useState<Element | null>(null);
  const [footer, setFooter] = useState<Element | null>(null);
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
        savedScroll.current = frame.current?.contentWindow?.scrollY ?? 0;
        setSummary(null);
        setFooter(null);
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
    if (savedScroll.current > 0) {
      frame.current?.contentWindow?.scrollTo({ top: savedScroll.current, behavior: 'instant' });
      savedScroll.current = 0;
    }
    setSummary(doc.getElementById('patient-summary'));
    setFooter(doc.getElementById('lienhe'));
  }, []);
  const scrollHome = () => {
    frame.current?.contentWindow?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  useEffect(() => {
    const doc = summary?.ownerDocument;
    if (!doc) return;
    // Pointer events inside an iframe do not reach the shared header's outside-click listeners.
    const notifyOutside = (event: Event) => {
      frame.current?.dispatchEvent(new Event(event.type, { bubbles: true }));
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
    observer?.observe(summary);
    const click = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target?.closest) return;
      if (target.closest('#retry-public')) {
        setRevision((v) => v + 1);
        return;
      }
      const link = target.closest('a');
      const href = link?.getAttribute('href');
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
        scrollHome();
        return;
      }
      navigate(
        href === '/dat-lich' && auth.status !== 'authenticated'
          ? '/dang-nhap?returnUrl=/dat-lich'
          : href,
      );
    };
    doc.addEventListener('click', click);
    doc.addEventListener('pointerdown', notifyOutside, true);
    doc.addEventListener('mousedown', notifyOutside, true);
    return () => {
      doc.removeEventListener('click', click);
      doc.removeEventListener('pointerdown', notifyOutside, true);
      doc.removeEventListener('mousedown', notifyOutside, true);
      observer?.disconnect();
    };
  }, [summary, auth.status]);
  return (
    <div className="portal-landing-shell">
      <PublicPortalHeader specialties={content.data.specialties} onHomeClick={scrollHome} />
        <iframe
          ref={frame}
          title="Cổng bệnh nhân Tâm An"
          srcDoc={content.html}
          onLoad={loaded}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            minHeight: 0,
            border: 0,
            background: '#faf3e4',
          }}
        />
      {summary && createPortal(
        <PatientSummary doctors={content.data.doctors} />,
        summary,
      )}
      {footer && createPortal(<PublicPortalFooter onHomeClick={scrollHome} />, footer)}
      <ChatbotLauncher />
    </div>
  );
}
