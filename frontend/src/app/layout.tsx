import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ColorThemeProvider } from '@/components/providers/color-theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'ТвойМатПлан — онлайн-занятия с репетитором',
  description: 'Кабинет для занятий с репетитором: урок, доска, отчёт и домашнее задание',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { document.documentElement.dataset.colorTheme = 'cranberry'; try { localStorage.setItem('tvoimatplan-color-theme', 'cranberry'); } catch (_) {} })();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <ColorThemeProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: 'rgb(var(--surface))',
                  color: 'rgb(var(--text))',
                  border: '1px solid rgb(var(--border))',
                },
              }}
            />
          </ColorThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
