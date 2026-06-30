import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reservar',
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">{children}</div>;
}
