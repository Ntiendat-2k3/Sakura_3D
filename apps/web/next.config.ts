import type { NextConfig } from 'next';

const DEFAULT_ASSET_CACHE_MAX_AGE_SECONDS = 86400;
const STALE_WHILE_REVALIDATE_FACTOR = 7;

// Chỉ bật ở production: `next dev` cần thấy asset mới ngay. Không dùng `immutable`
// vì URL asset chưa có phiên bản, đổi file thì người chơi vẫn phải lấy được bản mới.
const assetCacheHeaders = async () => {
  if (process.env.NODE_ENV !== 'production') return [];
  // Chỉ nhận số nguyên dương; giá trị lạ (chữ, số âm, số thập phân) quay về mặc định.
  const configured = Number(process.env.ASSET_CACHE_MAX_AGE_SECONDS);
  const maxAge = Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_ASSET_CACHE_MAX_AGE_SECONDS;
  return [
    {
      source: '/assets/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * STALE_WHILE_REVALIDATE_FACTOR}`
        }
      ]
    }
  ];
};

// Chơi qua `tailscale serve` (https://<máy>.<tailnet>.ts.net): cho phép origin này tải tài nguyên dev (HMR, chunk) của `next dev`.
// Khai báo danh sách này khiến Next chặn (thay vì chỉ cảnh báo) origin lạ, nên giữ cả 127.0.0.1; `**` khớp nhiều cấp tên miền.
const DEV_ALLOWED_ORIGINS = ['127.0.0.1', '**.ts.net'];

const nextConfig: NextConfig = { reactStrictMode: true, headers: assetCacheHeaders, allowedDevOrigins: DEV_ALLOWED_ORIGINS };
export default nextConfig;
