'use client';

import React, { useState, useEffect } from 'react';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_MAP = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-20 h-20 text-3xl',
};

// Consistent color generator based on name string for pleasant avatar backgrounds
function getInitialsColor(name: string): string {
  const gradients = [
    'from-orange-600 to-amber-600',
    'from-emerald-600 to-teal-700',
    'from-blue-600 to-indigo-700',
    'from-purple-600 to-pink-700',
    'from-rose-600 to-red-700',
    'from-cyan-600 to-blue-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

export default function UserAvatar({
  src,
  name = 'Operator',
  className = '',
  size = 'md',
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Reset error state if src changes
  useEffect(() => {
    setImageError(false);
  }, [src]);

  const displayName = (name || 'Operator').trim();
  const initial = displayName.charAt(0).toUpperCase() || 'O';
  const sizeClasses = size ? SIZE_MAP[size] : '';
  const gradientClass = getInitialsColor(displayName);

  const showImage = Boolean(src && !imageError && src.trim() !== '');

  return (
    <div
      className={`relative rounded-2xl flex items-center justify-center font-bold text-white select-none overflow-hidden shrink-0 transition-transform ${sizeClasses} ${className}`}
    >
      {showImage ? (
        <img
          src={src!}
          alt={displayName}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div
          className={`w-full h-full flex items-center justify-center bg-gradient-to-tr ${gradientClass} font-black tracking-wider shadow-inner`}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

