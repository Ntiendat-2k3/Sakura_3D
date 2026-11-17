'use client';
import { useEffect, useMemo, useRef } from 'react';
import type { BluffTableView } from '@metaverse/game-protocol';
import { bluffSoundFor, playBluffSfx, startHeartbeat, type BluffSoundState } from './bluffSfx';
import { heartbeatActive, heartbeatBpm } from './bluffStaging';
import { bluffVoiceFor, createOneShots, createVoiceQueue, pickVoiceLine, playBluffVoice, tauntSound, type BluffVoiceState } from './bluffVoice';
import type { ReceivedTaunt } from './useBluffTaunts';

/**
 * Phát âm thanh theo trạng thái bàn Bluff.
 * - 'shuffle': mỗi khi vào pha 'turn' từ pha khác (lobby/result/reveal...) tức là vừa chia vòng mới.
 *   Pha 'turn' liên tiếp (đổi lượt) không phát; chia lại sau 'result' luôn đi qua pha khác nên không bị bỏ sót.
 * - 'play': tiếng "xẹt" úp bài mỗi khi chồng bài trên bàn đổi sang ghế vừa úp (trong pha turn).
 * - 'click'/'bang': khi shotResult đổi sang giá trị đó.
 * - Giọng Shinku theo bluffVoiceFor, xếp hàng trên một kênh để các câu không chồng nhau.
 * - Tim đập trong nhịp chờ bóp cò, nhanh dần theo số lần người cầm súng đã bóp.
 * - Cà khịa: mỗi sự kiện mới phát giọng/SFX riêng ngay (không vào hàng của Shinku).
 * Không phát cho tới khi đã thấy trạng thái thật: bàn khởi tạo là lobby rỗng, nên patch đầu tiên của người vào giữa ván
 *   chỉ gieo giá trị 'trước đó' (seed) chứ không được coi là chuyển pha.
 */
export function useBluffEffects(table: BluffTableView, enabled: boolean, taunts: readonly ReceivedTaunt[] = []) {
  const state = useRef<BluffSoundState>({ phase: table.phase, shot: table.shotResult, seeded: false, rank: table.tableRank, lastSeat: table.lastPlay.seatId });
  const voice = useRef<BluffVoiceState>({ phase: table.phase, shot: table.shotResult, seeded: false, rank: table.tableRank, lastSeat: table.lastPlay.seatId });
  const queue = useMemo(() => createVoiceQueue(playBluffVoice), []);
  const shots = useMemo(() => createOneShots(playBluffVoice), []);
  const lastTauntAt = useRef(Infinity);
  const phase = useRef(table.phase);
  phase.current = table.phase;

  useEffect(() => () => { queue.clear(); shots.stopAll(); }, [queue, shots]);

  useEffect(() => {
    // Vào lại zone (enabled tắt rồi bật) thì seed lại từ trạng thái thật kế tiếp; rời zone thì im ngay.
    if (!enabled) {
      state.current = { phase: table.phase, shot: table.shotResult, seeded: false, rank: table.tableRank, lastSeat: table.lastPlay.seatId };
      voice.current = { phase: table.phase, shot: table.shotResult, seeded: false, rank: table.tableRank, lastSeat: table.lastPlay.seatId };
      queue.clear();
      shots.stopAll();
      return;
    }
    const { sound, next } = bluffSoundFor(state.current, table);
    state.current = next;
    if (sound) playBluffSfx(sound);
    const spoken = bluffVoiceFor(voice.current, table);
    voice.current = spoken.next;
    if (spoken.groups.length) queue.push(spoken.groups.map(group => pickVoiceLine(group)));
  }, [table, enabled, queue, shots]);

  const beating = enabled && heartbeatActive(table);
  const shooterPulls = table.seats.find(seat => seat.seatId === table.shooterSeat)?.pulls ?? 0;
  useEffect(() => {
    if (!beating) return;
    return startHeartbeat(heartbeatBpm(shooterPulls));
  }, [beating, shooterPulls]);

  useEffect(() => {
    // Lần đầu (hoặc vừa vào zone) chỉ ghi mốc: không phát lại cà khịa đã nhận trước đó.
    const newest = taunts.reduce((max, item) => Math.max(max, item.at), -Infinity);
    if (!enabled || lastTauntAt.current === Infinity) { lastTauntAt.current = enabled ? newest : Infinity; return; }
    for (const { fx, at } of taunts) {
      if (at <= lastTauntAt.current) continue;
      const sound = tauntSound(fx.kind, phase.current);
      if (sound?.sfx) playBluffSfx(sound.sfx);
      if (sound?.voice) shots.play(pickVoiceLine(sound.voice));
    }
    lastTauntAt.current = Math.max(lastTauntAt.current, newest);
  }, [taunts, enabled, shots]);
}
