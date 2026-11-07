'use client';
import { useEffect } from 'react';

export function PortalInteraction({ enabled, interact }: { enabled: boolean; interact: () => void }) {
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (!enabled || event.repeat || event.key.toLowerCase() !== 'e') return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      event.preventDefault(); interact();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [enabled, interact]);
  return null;
}
