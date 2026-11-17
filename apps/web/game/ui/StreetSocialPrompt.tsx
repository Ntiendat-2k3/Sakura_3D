'use client';
import { useEffect } from 'react';

/** Nút + phím tắt ngoài phố: K hôn người ngồi cạnh trên ghế đá, Q đấm người đứng gần. Server tự chọn người. */
export function StreetSocialPrompt({ kissName, punchName, kiss, punch }: { kissName?: string; punchName?: string; kiss: () => void; punch: () => void }) {
  useEffect(() => {
    if (!kissName && !punchName) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))) return;
      if (event.code === 'KeyK' && kissName) { event.preventDefault(); kiss(); }
      if (event.code === 'KeyQ' && punchName) { event.preventDefault(); punch(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [kissName, punchName, kiss, punch]);
  // Hôn cần đang ngồi, đấm cần đang đứng nên hai nút không bao giờ hiện cùng lúc.
  if (kissName) return <button className="npc-interact graphics-toggle" onClick={kiss}>{`K · Hôn ${kissName} ♥`}</button>;
  if (punchName) return <button className="npc-interact graphics-toggle" onClick={punch}>{`Q · Đấm ${punchName}`}</button>;
  return null;
}
