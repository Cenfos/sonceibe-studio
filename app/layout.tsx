import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://sonceibe-studio.vercel.app'),
  title: 'SonCeibe Studio',
  applicationName: 'SonCeibe Studio',
  description: 'Crea vídeos musicales con letras, fotografías, animaciones y efectos desde tu navegador.',
  openGraph: {
    title: 'SonCeibe Studio',
    description: 'Crea vídeos musicales con letras, fotografías, animaciones y efectos desde tu navegador.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
