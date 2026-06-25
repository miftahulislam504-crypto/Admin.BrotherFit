import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, DM_Sans, DM_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import Script from 'next/script';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'], weight: ['400','500','600','700'],
  variable: '--font-cormorant', display: 'swap',
});
const dmSans = DM_Sans({
  subsets: ['latin'], weight: ['400','500','600'],
  variable: '--font-dm-sans', display: 'swap',
});
const dmMono = DM_Mono({
  subsets: ['latin'], weight: ['400','500'],
  variable: '--font-dm-mono', display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'BrotherFit Admin', template: '%s | BrotherFit Admin' },
  description: 'BrotherFit fashion store admin panel',
  robots: 'noindex, nofollow',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BrotherFit Admin',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png',  sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#1C1007',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable}`}>
      <head>
        {/* PWA meta tags */}
        <meta name="application-name" content="BrotherFit Admin" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BrotherFit Admin" />
        <meta name="msapplication-TileColor" content="#1C1007" />
        <meta name="msapplication-TileImage" content="/icon-144x144.png" />
        <meta name="msapplication-tap-highlight" content="no" />
        {/* Apple splash screens */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icon-192x192.png" />
      </head>
      <body className="bg-bg text-text font-sans antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1C1007', color: '#fff',
              borderRadius: '12px', fontSize: '13px',
            },
            success: { iconTheme: { primary: '#C89B6D', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#DC2626', secondary: '#fff' } },
          }}
        />
        {/* Service Worker Registration */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(reg) {
                      console.log('[PWA] Service Worker registered:', reg.scope);
                    })
                    .catch(function(err) {
                      console.log('[PWA] Service Worker failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
