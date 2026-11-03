import './globals.css';
import type { Metadata } from 'next';

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
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@1&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen flex flex-col antialiased selection:bg-[#E8E2D5] selection:text-black"
      >
        {children}
      </body>
    </html>
  );
}
