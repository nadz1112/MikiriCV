import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

let openCount = 0;
let originalOverflow = '';

/** Keep dialogs in the viewport and prevent clicks from reaching the page below. */
export function ModalPortal({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (openCount++ === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (--openCount === 0) document.body.style.overflow = originalOverflow;
    };
  }, []);

  return createPortal(
    <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
      if (event.key === 'Escape') event.stopPropagation();
    }}>{children}</div>,
    document.body,
  );
}
