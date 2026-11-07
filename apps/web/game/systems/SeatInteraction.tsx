'use client';
import { useEffect } from 'react';

export function SeatInteraction({ enabled, interact }: { enabled: boolean; interact: () => void }) {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!enabled || event.repeat || event.key !== 'Enter') return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target.tagName))) return;
      event.preventDefault(); interact();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [enabled, interact]);
  return null;
}
