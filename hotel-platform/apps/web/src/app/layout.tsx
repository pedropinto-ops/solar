import './globals.css';
import type { Metadata } from 'next';
import { QueryProvider } from '@/lib/query-provider';

export const metadata: Metadata = {
  title: 'Solar Irará Hotel',
  description: 'Solar Irará Hotel — plataforma de gestão',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
