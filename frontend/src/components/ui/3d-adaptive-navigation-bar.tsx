'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, useSpring, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export interface NavItem {
  label: string;
  id: string;
  href?: string;
}

interface AdaptiveNavPillProps {
  items?: NavItem[];
  defaultSection?: string;
  onSelect?: (id: string) => void;
}

/**
 * 3D Adaptive Navigation Pill
 * Smart navigation with spring physics and hover expansion
 */
export const PillBase: React.FC<AdaptiveNavPillProps> = ({
  items,
  defaultSection = 'scanner',
  onSelect,
}) => {
  const router = useRouter();

  const navItems: NavItem[] = items || [
    { label: 'Live Scanner', id: 'scanner', href: '#scanner' },
    { label: 'How It Works', id: 'how-it-works', href: '/how-it-works' },
    { label: 'Pipeline', id: 'pipeline', href: '/technology' },
    { label: 'YOLO + OCR', id: 'model', href: '/model' },
    { label: 'Android App', id: 'download', href: '/download' },
  ];

  const [activeSection, setActiveSection] = useState(defaultSection);
  const [expanded, setExpanded] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSectionRef = useRef(defaultSection);

  // Dynamic spring widths based on items count
  const collapsedWidth = 155;
  const expandedWidth = Math.max(520, navItems.length * 115);

  const pillWidth = useSpring(collapsedWidth, { stiffness: 220, damping: 25, mass: 1 });
  const pillShift = useSpring(0, { stiffness: 220, damping: 25, mass: 1 });

  // Handle hover expansion
  useEffect(() => {
    if (hovering) {
      setExpanded(true);
      pillWidth.set(expandedWidth);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    } else {
      hoverTimeoutRef.current = setTimeout(() => {
        setExpanded(false);
        pillWidth.set(collapsedWidth);
      }, 500);
    }

    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [hovering, pillWidth, expandedWidth, collapsedWidth]);

  const handleMouseEnter = () => {
    setHovering(true);
  };

  const handleMouseLeave = () => {
    setHovering(false);
  };

  const handleSectionClick = (item: NavItem) => {
    setIsTransitioning(true);
    prevSectionRef.current = item.id;
    setActiveSection(item.id);
    setHovering(false);

    if (onSelect) {
      onSelect(item.id);
    }

    if (item.href) {
      if (item.href.startsWith('#')) {
        const el = document.querySelector(item.href);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        router.push(item.href);
      }
    }

    setTimeout(() => {
      setIsTransitioning(false);
    }, 400);
  };

  const activeItem = navItems.find((item) => item.id === activeSection) || navItems[0];

  return (
    <motion.nav
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative rounded-full select-none"
      style={{
        width: pillWidth,
        height: '48px',
        background: `
          linear-gradient(135deg, 
            #fcfcfd 0%, 
            #f8f8fa 15%, 
            #f3f4f6 30%, 
            #eeeff2 45%, 
            #e9eaed 60%, 
            #e4e5e8 75%, 
            #dee0e3 90%, 
            #e2e3e6 100%
          )
        `,
        boxShadow: expanded
          ? `
            0 2px 4px rgba(0, 0, 0, 0.12),
            0 6px 14px rgba(0, 0, 0, 0.18),
            0 14px 28px rgba(0, 0, 0, 0.22),
            0 24px 48px rgba(0, 0, 0, 0.16),
            inset 0 2px 2px rgba(255, 255, 255, 0.9),
            inset 0 -3px 8px rgba(0, 0, 0, 0.12),
            inset 3px 3px 8px rgba(0, 0, 0, 0.10),
            inset -3px 3px 8px rgba(0, 0, 0, 0.09),
            inset 0 -1px 2px rgba(0, 0, 0, 0.08)
          `
          : isTransitioning
          ? `
            0 3px 6px rgba(0, 0, 0, 0.15),
            0 8px 16px rgba(0, 0, 0, 0.12),
            0 16px 32px rgba(0, 0, 0, 0.10),
            0 1px 2px rgba(0, 0, 0, 0.12),
            inset 0 2px 1px rgba(255, 255, 255, 0.88),
            inset 0 -2px 6px rgba(0, 0, 0, 0.08),
            inset 2px 2px 8px rgba(0, 0, 0, 0.06),
            inset -2px 2px 8px rgba(0, 0, 0, 0.05),
            inset 0 0 1px rgba(0, 0, 0, 0.12),
            inset 0 0 20px rgba(255, 255, 255, 0.20)
          `
          : `
            0 3px 6px rgba(0, 0, 0, 0.16),
            0 8px 16px rgba(0, 0, 0, 0.14),
            0 16px 32px rgba(0, 0, 0, 0.10),
            0 1px 2px rgba(0, 0, 0, 0.14),
            inset 0 2px 1px rgba(255, 255, 255, 0.8),
            inset 0 -2px 6px rgba(0, 0, 0, 0.10),
            inset 2px 2px 8px rgba(0, 0, 0, 0.08),
            inset -2px 2px 8px rgba(0, 0, 0, 0.07),
            inset 0 0 1px rgba(0, 0, 0, 0.15)
          `,
        x: pillShift,
        overflow: 'hidden',
        transition: 'box-shadow 0.3s ease-out',
      }}
    >
      {/* Primary top edge ridge - ultra bright */}
      <div
        className="absolute inset-x-0 top-0 rounded-t-full pointer-events-none"
        style={{
          height: '2px',
          background:
            'linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.95) 5%, rgba(255, 255, 255, 1) 15%, rgba(255, 255, 255, 1) 85%, rgba(255, 255, 255, 0.95) 95%, rgba(255, 255, 255, 0) 100%)',
          filter: 'blur(0.3px)',
        }}
      />

      {/* Top hemisphere light catch */}
      <div
        className="absolute inset-x-0 top-0 rounded-full pointer-events-none"
        style={{
          height: '55%',
          background:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.25) 30%, rgba(255, 255, 255, 0.10) 60%, rgba(255, 255, 255, 0) 100%)',
        }}
      />

      {/* Directional light - top left */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(255, 255, 255, 0.40) 0%, rgba(255, 255, 255, 0.20) 20%, rgba(255, 255, 255, 0.08) 40%, rgba(255, 255, 255, 0) 65%)',
        }}
      />

      {/* Premium gloss reflection - main */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          left: expanded ? '14%' : '12%',
          top: '16%',
          width: expanded ? '140px' : '60px',
          height: '12px',
          background:
            'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0.40) 40%, rgba(255, 255, 255, 0.10) 70%, rgba(255, 255, 255, 0) 100%)',
          filter: 'blur(3.5px)',
          transform: 'rotate(-10deg)',
          transition: 'all 0.3s ease',
        }}
      />

      {/* Secondary gloss accent - only show when expanded */}
      {expanded && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            right: '18%',
            top: '20%',
            width: '80px',
            height: '10px',
            background:
              'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.50) 0%, rgba(255, 255, 255, 0.15) 60%, rgba(255, 255, 255, 0) 100%)',
            filter: 'blur(3px)',
            transform: 'rotate(8deg)',
          }}
        />
      )}

      {/* Bottom curvature - deep shadow */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-b-full pointer-events-none"
        style={{
          height: '50%',
          background:
            'linear-gradient(0deg, rgba(0, 0, 0, 0.14) 0%, rgba(0, 0, 0, 0.08) 25%, rgba(0, 0, 0, 0.03) 50%, rgba(0, 0, 0, 0) 100%)',
        }}
      />

      {/* Bottom edge contact shadow */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-b-full pointer-events-none"
        style={{
          height: '20%',
          background: 'linear-gradient(0deg, rgba(0, 0, 0, 0.20) 0%, rgba(0, 0, 0, 0) 100%)',
          filter: 'blur(2px)',
        }}
      />

      {/* Inner diffuse glow */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 35px rgba(255, 255, 255, 0.25)',
          opacity: 0.8,
        }}
      />

      {/* Micro edge definition */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 0 0.5px rgba(0, 0, 0, 0.12)',
        }}
      />

      {/* Navigation items container */}
      <div
        ref={containerRef}
        className="relative z-10 h-full flex items-center justify-center px-4"
        style={{
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro", Poppins, sans-serif',
        }}
      >
        {/* Collapsed state - show only active section with smooth text transitions */}
        {!expanded && (
          <div className="flex items-center justify-center relative w-full cursor-pointer">
            <AnimatePresence mode="wait">
              {activeItem && (
                <motion.span
                  key={activeItem.id}
                  initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
                  transition={{
                    duration: 0.3,
                    ease: [0.4, 0.0, 0.2, 1],
                  }}
                  style={{
                    fontSize: '14.5px',
                    fontWeight: 650,
                    color: '#1a1a1a',
                    letterSpacing: '0.35px',
                    whiteSpace: 'nowrap',
                    textShadow: `
                      0 1px 0 rgba(0, 0, 0, 0.35),
                      0 -1px 0 rgba(255, 255, 255, 0.8),
                      1px 1px 0 rgba(0, 0, 0, 0.18),
                      -1px 1px 0 rgba(0, 0, 0, 0.15)
                    `,
                  }}
                >
                  {activeItem.label}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Expanded state - show all sections with stagger */}
        {expanded && (
          <div className="flex items-center justify-evenly w-full">
            {navItems.map((item, index) => {
              const isActive = item.id === activeSection;

              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{
                    delay: index * 0.05,
                    duration: 0.2,
                    ease: 'easeOut',
                  }}
                  onClick={() => handleSectionClick(item)}
                  className="relative cursor-pointer transition-all duration-200"
                  style={{
                    fontSize: isActive ? '14.5px' : '14px',
                    fontWeight: isActive ? 680 : 520,
                    color: isActive ? '#111111' : '#555555',
                    letterSpacing: '0.3px',
                    background: 'transparent',
                    border: 'none',
                    padding: '6px 12px',
                    outline: 'none',
                    whiteSpace: 'nowrap',
                    transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
                    textShadow: isActive
                      ? `
                        0 1px 0 rgba(0, 0, 0, 0.35),
                        0 -1px 0 rgba(255, 255, 255, 0.8),
                        1px 1px 0 rgba(0, 0, 0, 0.18),
                        -1px 1px 0 rgba(0, 0, 0, 0.15)
                      `
                      : `
                        0 1px 0 rgba(0, 0, 0, 0.22),
                        0 -1px 0 rgba(255, 255, 255, 0.65),
                        1px 1px 0 rgba(0, 0, 0, 0.12),
                        -1px 1px 0 rgba(0, 0, 0, 0.10)
                      `,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#222222';
                      e.currentTarget.style.transform = 'translateY(-0.5px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#555555';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {item.label}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </motion.nav>
  );
};

export default PillBase;

