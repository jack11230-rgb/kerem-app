import type { Metadata, Viewport } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-sc/500.css';
import '@fontsource/cormorant-sc/600.css';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Kerem — A private circle for Torah, philosophy & conversation',
  description: 'Members club for shiurim, lectures and philosophical conversation.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Kerem', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = { themeColor: '#0B1426', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers><div className="app">{children}</div></Providers>
      </body>
    </html>
  );
}
