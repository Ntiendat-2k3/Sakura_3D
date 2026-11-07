import type { ReactNode } from 'react';
import './style.css';
export const metadata = { title: 'Neon Sakura City', description: 'Anime 3D multiplayer dev sandbox — local demo' };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="vi"><body>{children}</body></html>; }
