import { describe, expect, it } from 'vitest';
import template from './template.html?raw';
import { buildLandingDocument, type LandingData } from './document';

const parse = (html: string) =>
  new DOMParser().parseFromString(html, 'text/html');
const fixture = (count: number): LandingData => ({
  specialties: Array.from({ length: count }, (_, i) => ({
    slug: `specialty-${i}`,
    name: `Chuyên khoa ${i}`,
  })),
  services: [
    {
      id: 'service-1',
      name: 'Khám thai',
      prices: [{ amountMinor: 250000, currency: 'VND', status: 'ACTIVE' }],
    },
  ],
  doctors: Array.from({ length: count }, (_, i) => ({
    id: `doctor-${i}`,
    profile: { fullName: `Bác sĩ ${i}`, photoUrl: '/doctor.jpg' },
    specialties: [{ name: 'Sản khoa' }],
  })),
  errors: [],
});

describe('patient landing document adapter', () => {
  it.each([0, 1, 3, 8])(
    'supports %i live doctors and specialties without invalid scripts',
    (count) => {
      const doc = parse(buildLandingDocument(fixture(count)));
      expect(doc.querySelectorAll('#ag .ag-p')).toHaveLength(count);
      const scripts = Array.from(
        doc.querySelectorAll('script:not([src])'),
        (s) => s.textContent!,
      );
      scripts.forEach((code) => expect(() => new Function(code)).not.toThrow());
      expect(scripts.join('')).toContain(`N=${count},G=12`);
      expect(scripts.join('')).not.toContain('BS. Nguyễn Lan Anh');
      expect(scripts.join('')).not.toContain("+' / 06'");
      expect(
        doc.querySelectorAll('.landing-doctor-fallback article'),
      ).toHaveLength(count);
      if (!count) {
        expect(scripts.join('')).not.toContain(' row();');
        expect(scripts.join('')).not.toContain(' acc();');
      }
    },
  );

  it('keeps original animation assets, CSS and tween timings alongside the patient hero video', () => {
    const original = parse(template);
    const doc = parse(buildLandingDocument(fixture(5)));
    expect(doc.querySelector('style')!.textContent).toBe(
      original.querySelector('style')!.textContent,
    );
    expect(
      Array.from(doc.querySelectorAll('script[src]'), (s) =>
        s.getAttribute('src'),
      ),
    ).toEqual(
      Array.from(original.querySelectorAll('script[src]'), (s) =>
        s.getAttribute('src'),
      ),
    );
    expect(doc.querySelector('#hero video source')?.getAttribute('src')).toBe(
      '/videos/patient-home-pexels-7089369.mp4',
    );
    const timings = (d: Document) =>
      Array.from(d.querySelectorAll('script:not([src])'), (s) => s.textContent)
        .join('')
        .match(/(?:duration|delay|stagger|ease|lerp):[^,}\n]+/g);
    expect(timings(doc)).toEqual(timings(original));
  });

  it('routes booking and catalogs to existing pages, with a recoverable error state', () => {
    const data = fixture(2);
    data.errors = ['dịch vụ'];
    const doc = parse(buildLandingDocument(data));
    expect(doc.querySelector('#vas')?.getAttribute('href')).toBe('/dat-lich');
    expect(doc.querySelector('#cylCta')?.getAttribute('href')).toBe(
      '/dat-lich',
    );
    expect(doc.querySelector('#ag a')?.getAttribute('href')).toBe(
      '/chuyen-khoa/specialty-0',
    );
    expect(doc.querySelector('#dv a')?.getAttribute('href')).toBe(
      '/dich-vu/service-1',
    );
    expect(doc.querySelector('#dv')?.textContent).toContain('250.000');
    expect(doc.querySelector('#retry-public')).not.toBeNull();
    expect(doc.querySelector('body > nav')).toBeNull();
    expect(doc.querySelector('#patient-summary')).not.toBeNull();
    expect(doc.querySelectorAll('[data-count-to]')).toHaveLength(3);
    expect(doc.querySelector('.ag-m')?.getAttribute('style')).toContain(
      'images.unsplash.com',
    );
    expect(doc.body.textContent).not.toContain(
      'Số liệu và nội dung giới thiệu minh họa cho đồ án.',
    );
  });

  it('treats API text as data even with HTML, script terminators or replacement tokens', () => {
    const data = fixture(1);
    const hostile = '</script><img src=x onerror=alert(1)> $&';
    data.doctors[0].profile!.fullName = hostile;
    data.doctors[0].specialties![0].name = hostile;
    data.services[0].name = hostile;
    const doc = parse(buildLandingDocument(data));
    expect(doc.querySelector('#dv h3')?.textContent).toBe(hostile);
    expect(doc.querySelectorAll('[onerror]')).toHaveLength(0);
    expect(doc.querySelectorAll('script')).toHaveLength(
      parse(buildLandingDocument(fixture(1))).querySelectorAll('script').length,
    );
    Array.from(doc.querySelectorAll('script:not([src])')).forEach((s) =>
      expect(() => new Function(s.textContent!)).not.toThrow(),
    );
  });
});
