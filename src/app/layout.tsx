import type { Metadata } from 'next';
import { Cormorant_Garamond, DM_Sans, DM_Mono } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
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
  title: { default: 'FashionOS Admin', template: '%s | FashionOS Admin' },
  description: 'FashionOS store management panel',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable}`}>
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
      </body>
    </html>
  );
}
