import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/providers/theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'TutorPlatform — Онлайн-занятия с репетитором',
  description: 'Платформа для онлайн-обучения с репетиторами',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
