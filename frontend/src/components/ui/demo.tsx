'use client';

import React from 'react';
import Hero from '@/components/ui/animated-shader-hero';

export default function HeroDemo() {
  const handlePrimaryClick = () => {
    console.log('Get Started clicked!');
  };

  const handleSecondaryClick = () => {
    console.log('Explore Features clicked!');
  };

  return (
    <div className="w-full">
      <Hero
        monochrome={true}
        trustBadge={{
          text: 'Operational AI Traffic Infrastructure',
          icons: ['✨'],
        }}
        headline={{
          line1: 'Localize Vehicles &',
          line2: 'Extract Number Plates',
        }}
        subtitle="Real-time multi-class vehicle localization & automatic license plate recognition engineered specifically for heterogeneous Indian roadway conditions."
        buttons={{
          primary: {
            text: 'Launch Platform',
            onClick: handlePrimaryClick,
          },
          secondary: {
            text: 'Explore Features',
            onClick: handleSecondaryClick,
          },
        }}
      />
    </div>
  );
}

