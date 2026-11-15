'use client';

import React from 'react';
import BeamWordmarkFooter, { FooterColumn, FooterSocial } from '@/components/ui/beam-wordmark-footer';

interface FooterProps {
  theme?: 'dark' | 'beige' | 'light';
}

const VISIONPLATE_COLUMNS: FooterColumn[] = [
  {
    title: 'Platform Hub',
    links: [
      { label: 'Live Camera HUD', href: '/#scanner' },
      { label: 'Detection Studio', href: '/app/detect' },
      { label: 'Telemetry Dashboard', href: '/app/dashboard' },
      { label: 'Android Native APK v1.0', href: '/download' },
      { label: 'Operator Access', href: '/app/login' },
    ],
  },
  {
    title: 'AI Subsystems',
    links: [
      { label: 'YOLOv8 Vehicle Localization', href: '/model' },
      { label: 'Plate ROI Micro-Model', href: '/model' },
      { label: 'Pipeline Architecture', href: '/technology' },
      { label: 'Indian HSRP Syntactic Engine', href: '/#hsrp' },
      { label: '28 Indian RTO Normalizer', href: '/technology' },
    ],
  },
  {
    title: 'Engineering & Docs',
    links: [
      { label: 'Documentation Hub', href: '/documentation' },
      { label: 'FastAPI Swagger UI', href: 'http://127.0.0.1:8000/docs' },
      { label: 'Backend Health Probe', href: 'http://127.0.0.1:8000/api/v1/health' },
      { label: 'Monorepo Quality Suite', href: '/testing' },
      { label: 'GitHub Repository', href: 'https://github.com/OMKAR580/Multi-Class-Vehicle-Localization-and-Automatic-License-Plate-Recognition-ALPR-' },
    ],
  },
];

const VISIONPLATE_SOCIALS: FooterSocial[] = [
  { label: 'GitHub', href: 'https://github.com/OMKAR580/Multi-Class-Vehicle-Localization-and-Automatic-License-Plate-Recognition-ALPR-', icon: 'github' },
  { label: 'LinkedIn', href: '#', icon: 'linkedin' },
  { label: 'X (Twitter)', href: '#', icon: 'x' },
  { label: 'YouTube', href: '#', icon: 'youtube' },
];

export default function Footer({ theme }: FooterProps) {
  // Auto-detect theme if not provided as prop
  const [currentTheme, setCurrentTheme] = React.useState<'dark' | 'beige'>(
    theme === 'beige' || theme === 'light' ? 'beige' : 'dark'
  );

  React.useEffect(() => {
    if (theme) {
      setCurrentTheme(theme === 'beige' || theme === 'light' ? 'beige' : 'dark');
      return;
    }

    const syncTheme = () => {
      try {
        const saved = localStorage.getItem('visionplate-theme');
        const isBeige =
          saved === 'beige' ||
          saved === 'light' ||
          document.documentElement.classList.contains('beige') ||
          document.documentElement.classList.contains('light');
        setCurrentTheme(isBeige ? 'beige' : 'dark');
      } catch {
        setCurrentTheme('dark');
      }
    };

    syncTheme();
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, [theme]);

  const isDark = currentTheme === 'dark';

  return (
    <BeamWordmarkFooter
      brand="VisionPlate"
      wordmark="VISIONPLATE"
      company="VisionPlate AI Infrastructure"
      year={2026}
      columns={VISIONPLATE_COLUMNS}
      socials={VISIONPLATE_SOCIALS}
      credits={[
        { lead: 'VisionPlate AI by ', label: 'Computer Vision Engineering', href: '/about' },
        { lead: 'Purpose-built for ', label: 'Indian Roadways', tail: ' & FASTag Automation' },
      ]}
      background={isDark ? '#040404' : '#DDD1BE'}
      ink={isDark ? '#FAF8F5' : '#1A1815'}
      muted={isDark ? '#8A8174' : '#6B6152'}
      accent={isDark ? '#10B981' : '#B27D22'}
      wordTop={isDark ? '#047857' : '#926217'}
      wordFoot={isDark ? '#022c22' : '#4E3610'}
      cut={0.14}
      animate={true}
    />
  );
}
