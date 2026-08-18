import React from 'react';

interface PlatformLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  variant?: 'light' | 'dark';
}

/**
 * Official Vidyavahini Group Logo component.
 * Uses the official VVG logo image instead of shield icons.
 */
export const VimtechLogo: React.FC<PlatformLogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = false,
  variant = 'light'
}) => {
  const sizeMap = {
    sm: { img: 'h-8', title: 'text-sm', sub: 'text-[9px]' },
    md: { img: 'h-10', title: 'text-base', sub: 'text-[10px]' },
    lg: { img: 'h-14', title: 'text-lg', sub: 'text-[11px]' },
    xl: { img: 'h-20', title: 'text-2xl', sub: 'text-xs' },
  };

  const s = sizeMap[size];
  const isDark = variant === 'dark';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-purple-100/80 inline-flex items-center justify-center shrink-0">
        <img
          src="/vgi_logo.png"
          alt="Vidyavahini Group Logo"
          className={`${s.img} object-contain`}
          onError={(e) => {
            // Fallback to SVG if PNG fails
            (e.target as HTMLImageElement).src = '/vgi_logo.svg';
          }}
        />
      </div>
      <div>
        <h1 className={`font-heading font-black ${s.title} tracking-tight leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Vidyavahini VMS
        </h1>
        {showSubtitle && (
          <p className={`${s.sub} font-bold tracking-wider uppercase ${isDark ? 'text-purple-200' : 'text-purple-700'} mt-1`}>
            Visitor Management System
          </p>
        )}
      </div>
    </div>
  );
};
