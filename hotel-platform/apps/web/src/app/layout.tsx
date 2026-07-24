import './globals.css';
import type { Metadata, Viewport } from 'next';
import { QueryProvider } from '@/lib/query-provider';
import { VersionChecker } from '@/components/version-checker';
import { RegisterSW } from '@/components/register-sw';

export const metadata: Metadata = {
  title: 'Solar Irará Hotel',
  description: 'Solar Irará Hotel — plataforma de gestão',
  applicationName: 'Solar Irará',
  // iOS: abre em tela cheia quando instalado na tela de início.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Solar Irará',
  },
  icons: {
    icon: '/brand/logo.png',
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#9E4620', // terracota da marca
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans">
        <QueryProvider>{children}</QueryProvider>
        <VersionChecker />
        <RegisterSW />
      </body>
    </html>
  );
}
