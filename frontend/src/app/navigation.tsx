import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export function navigate(path: string, options?: { replace?: boolean }) {
  if (window.location.pathname === path) return;
  window.history[options?.replace ? 'replaceState' : 'pushState']({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo?.({ top: 0 });
}

export function usePathname() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return path;
}

export function AppLink({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }
  return <a {...props} href={href} onClick={handleClick} />;
}
