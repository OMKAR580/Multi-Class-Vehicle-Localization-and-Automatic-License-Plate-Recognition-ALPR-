import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VehicleVision | Multi-Class Vehicle Localization & ALPR',
  description: 'AI-Powered Intelligent Traffic Monitoring and License Plate Recognition Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
