import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Motion — Find your court',
  description: 'One place to find and book courts for the sports you love.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}