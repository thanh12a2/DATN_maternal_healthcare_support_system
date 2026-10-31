import '@testing-library/jest-dom/vitest';

// Polyfill window.matchMedia for Ant Design and Vitest / jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Polyfill ResizeObserver for Ant Design Table / components
(globalThis as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
