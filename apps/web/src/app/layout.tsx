import type { Metadata } from 'next';
import '@drive/ui/styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Віддалений диск — вебверсія',
  description: 'Клієнт для взаємодії з віддаленою папкою з файлами. Варіант 41.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
