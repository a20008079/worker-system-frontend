// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '校車定位系統',
  description: '瘋扣弱電資訊工程 - 師傅定位 / 出勤 / 派工',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
