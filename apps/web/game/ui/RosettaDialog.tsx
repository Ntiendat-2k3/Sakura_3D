'use client';
import { useEffect, useRef } from 'react';
import type { useRosettaInteraction } from '../systems/useRosettaInteraction';

/** Dialog native giữ focus và trả focus khi đóng, tránh phím di chuyển/cửa lọt xuống game. */
export function RosettaDialog({ interaction }: { interaction: ReturnType<typeof useRosettaInteraction> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opened = interaction.mode !== 'greeting';
  useEffect(() => {
    const element = dialog.current;
    if (opened && element && !element.open) element.showModal();
    if (!opened && element?.open) element.close();
  }, [opened]);
  return <>
    {interaction.near && <button hidden={opened} className="npc-interact graphics-toggle" onClick={interaction.open}>F · Trò chuyện với Rosetta</button>}
    <dialog ref={dialog} className="npc-dialog" aria-labelledby="rosetta-dialog-title" onCancel={event => { event.preventDefault(); interaction.close(); }}>
      <small>ROSETTA · DENMU</small>
      <h2 id="rosetta-dialog-title">Anh cần gì ạ?</h2>
      <p>{interaction.mode === 'dancing' ? 'Em nhảy dành cho anh nhé. Nhấn Hủy để dừng.' : 'Em có thể nhảy một điệu chào anh.'}</p>
      {interaction.error && <p role="alert">{interaction.error}</p>}
      <div className="npc-dialog-actions"><button autoFocus disabled={interaction.mode === 'dancing'} onClick={interaction.dance}>Nhảy</button><button onClick={interaction.close}>Hủy</button></div>
      <small>Esc để đóng · Tương tác thử nghiệm trên máy bạn</small>
    </dialog>
  </>;
}
