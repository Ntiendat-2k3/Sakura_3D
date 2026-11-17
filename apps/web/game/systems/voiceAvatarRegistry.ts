/** Avatar đăng ký Object3D gốc theo userId để âm thanh voice đặt đúng vị trí đã nội suy mỗi khung hình, không phải vị trí patch 10 Hz. */
import type { Object3D } from 'three';

const avatars = new Map<string, Object3D>();

export function registerVoiceAvatar(userId: string, object: Object3D): () => void {
  avatars.set(userId, object);
  return () => { if (avatars.get(userId) === object) avatars.delete(userId); };
}

export function getVoiceAvatar(userId: string): Object3D | undefined {
  return avatars.get(userId);
}
