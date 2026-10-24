import '@testing-library/jest-dom/vitest';

// jsdom thiếu ResizeObserver; Ant Design Table cần nó.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class { observe() { /* noop */ } unobserve() { /* noop */ } disconnect() { /* noop */ } } as unknown as typeof ResizeObserver;
}

// jsdom thiếu matchMedia; Ant Design Grid/Form cần nó.
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
