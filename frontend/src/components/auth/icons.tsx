import type { SVGProps } from 'react';

const svgProps: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  'aria-hidden': true,
};

export function UserIcon() {
  return <svg {...svgProps}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

export function LockIcon() {
  return <svg {...svgProps}><rect x="5" y="10" width="14" height="10" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}

export function CalendarIcon() {
  return <svg {...svgProps}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
}

export function PhoneIcon() {
  return <svg {...svgProps}><path d="M6.5 3h3l1.5 5-2 1.5a15 15 0 0 0 5.5 5.5l1.5-2 5 1.5v3A3.5 3.5 0 0 1 17.5 21C9.5 21 3 14.5 3 6.5A3.5 3.5 0 0 1 6.5 3Z" /></svg>;
}

export function GenderIcon() {
  return <svg {...svgProps}><circle cx="12" cy="12" r="8" /><path d="M12 8v8M8 12h8" /></svg>;
}

export function MailIcon() {
  return <svg {...svgProps}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>;
}

export function EyeOpenIcon() {
  return <svg {...svgProps}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

export function EyeClosedIcon() {
  return <svg {...svgProps}><path d="m3 3 18 18M10.7 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.1 2.7M6.6 6.7C4 8.4 2.5 12 2.5 12s3.5 6 9.5 6c1.3 0 2.5-.3 3.5-.7" /></svg>;
}

export function ShieldIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.9 8.5 7 10 4.1-1.5 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
}
