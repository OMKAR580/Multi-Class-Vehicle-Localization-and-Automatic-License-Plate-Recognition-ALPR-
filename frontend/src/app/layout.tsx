import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/context/ThemeContext';
import { GlassProvider } from '@/context/GlassContext';

export const metadata: Metadata = {
  title: 'VisionPlate AI — Operational ALPR & Vehicle Intelligence',
  description: 'Autonomous Multi-Class Vehicle Localization & Indian License Plate Recognition Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('visionplate-theme');
                  var isDark = saved ? saved === 'dark' : true;
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('beige', 'light');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('beige', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className="min-h-screen flex flex-col antialiased selection:bg-[#E8E2D5] selection:text-black"
      >
        <ThemeProvider>
          <GlassProvider>{children}</GlassProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

