'use client';
import { useEffect } from 'react';

/** Gợi ý + phím Space nhảy từ ban công tầng 2/3 Kohaku xuống tầng 1; server tự kiểm tra điểm nhảy. */
export function KohakuJumpPrompt({ enabled, floor, jump }: { enabled: boolean; floor?: string; jump: () => void }) {
  useEffect(() => {
    if (!enabled) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.code !== 'Space') return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))) return;
      event.preventDefault(); jump();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [enabled, jump]);
  return enabled ? <button className="npc-interact graphics-toggle" onClick={jump}>{`Space · Nhảy từ ${floor ?? 'ban công'} xuống tầng 1`}</button> : null;
}
