import { useEffect, useState } from "react";

interface CursorState {
  x: number;
  y: number;
  visible: boolean;
  kind: "default" | "clickable" | "text" | "disabled";
}

const initialState: CursorState = {
  x: 0,
  y: 0,
  visible: false,
  kind: "default",
};

function cursorKind(target: EventTarget | null): CursorState["kind"] {
  if (!(target instanceof Element)) return "default";
  const element = target.closest(
    'a,button,select,input,textarea,[role="button"],[data-cursor="clickable"]',
  );
  if (!element) return "default";
  if (
    (element instanceof HTMLButtonElement ||
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement) &&
    element.disabled
  ) {
    return "disabled";
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return "text";
  }
  return "clickable";
}

export function CustomCursor() {
  const [cursor, setCursor] = useState(initialState);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      setCursor({
        x: event.clientX,
        y: event.clientY,
        visible: true,
        kind: cursorKind(event.target),
      });
    };
    const leave = () => setCursor((current) => ({ ...current, visible: false }));

    window.addEventListener("mousemove", move);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("mousemove", move);
      document.documentElement.removeEventListener("mouseleave", leave);
    };
  }, []);

  return (
    <span
      className={`custom-cursor is-${cursor.kind} ${cursor.visible ? "is-visible" : ""}`}
      style={{ transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)` }}
      aria-hidden="true"
    />
  );
}
