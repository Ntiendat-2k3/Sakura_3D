"use client";
import { useEffect, useRef, useMemo, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { MoveInput, PlayerDanceStyle } from "@metaverse/game-protocol";
import { createPlayerDanceShortcuts } from "./playerDanceShortcuts";

/** Chuẩn hóa phím di chuyển, ưu tiên e.code từ phần cứng để miễn nhiễm với bộ gõ tiếng Việt (Telex/VNI/Unikey/EVKey). */
function normalizeMovementKey(e: KeyboardEvent): string | null {
  switch (e.code) {
    case "KeyW":
    case "ArrowUp":
      return "w";
    case "KeyS":
    case "ArrowDown":
      return "s";
    case "KeyA":
    case "ArrowLeft":
      return "a";
    case "KeyD":
    case "ArrowRight":
      return "d";
  }
  const key = e.key.toLowerCase();
  if (key === "w" || key === "arrowup") return "w";
  if (key === "s" || key === "arrowdown") return "s";
  if (key === "a" || key === "arrowleft") return "a";
  if (key === "d" || key === "arrowright") return "d";
  return null;
}

/** WASD theo camera; N+1..N+7 chọn kiểu nhảy trong club. Hỗ trợ local prediction và nhả phím dừng tức thì. */
export function PlayerInput({
  sendMove,
  enabled,
  toggleDance,
  localMove,
  autoMove,
  onManualMove,
}: {
  sendMove: (input: MoveInput) => void;
  enabled: boolean;
  toggleDance?: (style: PlayerDanceStyle) => void;
  localMove?: RefObject<MoveInput>;
  /** Input lái tự động theo hướng thế giới (vd. đi theo đoàn xuống hầm Gekkarō); chỉ dùng khi không bấm phím nào. */
  autoMove?: RefObject<MoveInput | null>;
  /** Bấm phím di chuyển trong lúc đang lái tự động: báo để hủy lái. */
  onManualMove?: () => void;
}) {
  const keys = useRef(new Set<string>());
  const elapsed = useRef(0);
  const dirty = useRef(false);
  const danceRef = useRef(toggleDance);
  danceRef.current = toggleDance;
  const manualRef = useRef(onManualMove);
  manualRef.current = onManualMove;
  const basis = useMemo(
    () => ({
      forward: new Vector3(),
      right: new Vector3(),
      move: new Vector3(),
    }),
    [],
  );

  useEffect(() => {
    const shortcuts = createPlayerDanceShortcuts((style) =>
      danceRef.current?.(style),
    );
    const clear = () => {
      keys.current.clear();
      shortcuts.reset();
      dirty.current = true;
      if (localMove?.current) localMove.current = { x: 0, z: 0 };
      sendMove({ x: 0, z: 0 });
    };
    const editable = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

    const keydown = (e: KeyboardEvent) => {
      if (!enabled || editable(e.target)) return;
      const rawKey = e.key.toLowerCase();
      if (
        danceRef.current &&
        !e.isComposing &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !(e.target instanceof HTMLButtonElement) &&
        shortcuts.down(rawKey, e.repeat)
      ) {
        e.preventDefault();
        return;
      }
      const moveKey = normalizeMovementKey(e);
      if (!moveKey) return;
      e.preventDefault();
      if (!keys.current.has(moveKey)) {
        keys.current.add(moveKey);
        dirty.current = true;
      }
      if (autoMove?.current) manualRef.current?.();
    };

    const keyup = (e: KeyboardEvent) => {
      const rawKey = e.key.toLowerCase();
      if (
        enabled &&
        !editable(e.target) &&
        !(e.target instanceof HTMLButtonElement) &&
        !e.isComposing &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      )
        shortcuts.up(rawKey);
      else if (rawKey === "n") shortcuts.reset();

      const moveKey = normalizeMovementKey(e);
      if (moveKey && keys.current.delete(moveKey)) {
        dirty.current = true;
        // Nhả hết phím di chuyển: dừng local ngay lập tức và gửi lệnh dừng lên server không chờ frame kế
        if (keys.current.size === 0) {
          if (localMove?.current) localMove.current = { x: 0, z: 0 };
          sendMove({ x: 0, z: 0 });
        }
      }
    };

    const focus = (e: FocusEvent) => {
      if (editable(e.target)) clear();
    };
    const visibility = () => {
      if (document.hidden) clear();
    };

    if (!enabled) clear();
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clear);
    window.addEventListener("focusin", focus);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clear);
      window.removeEventListener("focusin", focus);
      document.removeEventListener("visibilitychange", visibility);
      clear();
    };
  }, [enabled, sendMove, localMove, autoMove]);

  // Priority -3 chạy trước Avatar (-2), Animation (-1.5) và Camera (-1)
  useFrame(({ camera }, delta) => {
    if (!enabled) {
      if (
        localMove?.current &&
        (localMove.current.x !== 0 || localMove.current.z !== 0)
      ) {
        localMove.current = { x: 0, z: 0 };
      }
      return;
    }
    const k = keys.current;
    const x = Number(k.has("d")) - Number(k.has("a"));
    const forward = Number(k.has("w")) - Number(k.has("s"));

    const auto = autoMove?.current;
    if (x === 0 && forward === 0) {
      basis.move.set(auto?.x ?? 0, 0, auto?.z ?? 0);
    } else {
      camera.getWorldDirection(basis.forward);
      basis.forward.y = 0;
      basis.forward.normalize();
      basis.right.crossVectors(basis.forward, camera.up).normalize();
      basis.move
        .copy(basis.right)
        .multiplyScalar(x)
        .addScaledVector(basis.forward, forward);
      if (basis.move.lengthSq() > 1) basis.move.normalize();
    }

    if (localMove?.current) {
      localMove.current = { x: basis.move.x, z: basis.move.z };
    }

    elapsed.current += delta;
    if (elapsed.current < 0.05 && !dirty.current) return;
    elapsed.current = 0;
    dirty.current = false;
    sendMove({ x: basis.move.x, z: basis.move.z });
  }, -3);

  return null;
}
