/**
 * Suy ra URL API và world server. Ưu tiên biến NEXT_PUBLIC_*; nếu không đặt thì lấy cùng hostname với trang:
 * - trang http (localhost, LAN): http://host:4000 và ws://host:2567 như cổng dev.
 * - trang https (vd. `tailscale serve`): https://host:8443 và wss://host:10000, vì trang https không được gọi ws:// (mixed content).
 * Ba cổng HTTPS 443/8443/10000 là các cổng `tailscale serve` cho phép; xem docs/reports/VOICE_PROXIMITY_REPORT.md.
 */
export const DEV_SERVICE_PORTS = { api: 4000, world: 2567 } as const;
export const SECURE_SERVICE_PORTS = { api: 8443, world: 10000 } as const;

export type PageLocation = { protocol: string; hostname: string };
export type ServiceUrls = { api: string; world: string };

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function hostOf(url: string): string | null {
  try { return new URL(url).hostname; } catch { return null; }
}

/** Biến môi trường trỏ về localhost chỉ dùng được khi chính trang cũng mở từ localhost; máy thứ hai sẽ gọi nhầm vào chính nó. */
function usable(envUrl: string | undefined, location: PageLocation | undefined): string | undefined {
  const value = envUrl?.trim();
  if (!value) return undefined;
  if (!location) return value;
  const host = hostOf(value);
  if (host && LOOPBACK.has(host) && !LOOPBACK.has(location.hostname)) return undefined;
  // Trang https không được gọi http/ws thường: bỏ giá trị cũ thay vì để trình duyệt chặn âm thầm.
  if (location.protocol === 'https:' && /^(http|ws):/i.test(value)) return undefined;
  return value.replace(/\/+$/, '');
}

export function resolveServiceUrls(env: { api?: string; world?: string }, location?: PageLocation): ServiceUrls {
  const secure = location?.protocol === 'https:';
  const host = location?.hostname ? (location.hostname.includes(':') && !location.hostname.startsWith('[') ? `[${location.hostname}]` : location.hostname) : 'localhost';
  const ports = secure ? SECURE_SERVICE_PORTS : DEV_SERVICE_PORTS;
  return {
    api: usable(env.api, location) ?? `${secure ? 'https' : 'http'}://${host}:${ports.api}`,
    world: usable(env.world, location) ?? `${secure ? 'wss' : 'ws'}://${host}:${ports.world}`,
  };
}

/** Next chỉ thay process.env.NEXT_PUBLIC_* khi viết nguyên văn, nên đọc trực tiếp ở đây thay vì truyền tên biến. */
export function browserServiceUrls(): ServiceUrls {
  return resolveServiceUrls(
    { api: process.env.NEXT_PUBLIC_API_URL, world: process.env.NEXT_PUBLIC_WORLD_URL },
    typeof window === 'undefined' ? undefined : window.location,
  );
}
