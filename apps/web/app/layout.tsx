import type { ReactNode } from 'react';
import './style.css';
export const metadata = { title: 'Neon Sakura City', description: 'Anime 3D multiplayer dev sandbox — local demo' };
// suppressHydrationWarning: tiện ích trình duyệt (vd. data-yd-*) chèn thuộc tính vào <html> trước khi React hydrate.
// Cờ này chỉ bỏ qua lệch thuộc tính của chính thẻ <html>, lỗi hydration ở component con vẫn được báo.
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="vi" suppressHydrationWarning><body>{children}</body></html>; }
