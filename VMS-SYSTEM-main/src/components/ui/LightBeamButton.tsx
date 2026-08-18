import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface LightBeamButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  className?: string;
  gradientColors?: [string, string, string];
  variant?: 'purple' | 'gold' | 'danger' | 'dark';
}

/**
 * LightBeamButton
 * 
 * Futuristic button featuring a rotating conic light beam border effect,
 * implemented with CSS @property animations & framer-motion interaction states.
 */
export const LightBeamButton: React.FC<LightBeamButtonProps> = ({ 
  children, 
  className, 
  onClick,
  gradientColors,
  variant = 'purple',
  ...props 
}) => {
  // Determine gradient colors based on variant if not explicitly provided
  let colors: [string, string, string] = ["#a53aed", "#f59e0b", "#a53aed"];
  if (gradientColors) {
    colors = gradientColors;
  } else if (variant === 'gold') {
    colors = ["#f59e0b", "#fbbf24", "#f59e0b"];
  } else if (variant === 'danger') {
    colors = ["#ef4444", "#f87171", "#ef4444"];
  } else if (variant === 'dark') {
    colors = ["#6366f1", "#a855f7", "#6366f1"];
  }

  const gradientString = `conic-gradient(from var(--gradient-angle), transparent 0%, ${colors[0]} 40%, ${colors[1]} 50%, transparent 60%, transparent 100%)`;

  return (
    <>
      <style>{`
        @property --gradient-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes border-spin {
          from { --gradient-angle: 0deg; }
          to { --gradient-angle: 360deg; }
        }
        .animate-border-spin {
          animation: border-spin 2.2s linear infinite;
        }
      `}</style>
      
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={cn(
          "group relative isolate overflow-hidden rounded-2xl bg-[#2a082a] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[#3b0e3b] active:scale-95 cursor-pointer select-none",
          "shadow-[0_0_20px_-5px_rgba(128,0,128,0.4)] hover:shadow-[0_0_25px_-5px_rgba(128,0,128,0.6)]",
          variant === 'gold' && "bg-[#291702] hover:bg-[#3d2203] shadow-[0_0_20px_-5px_rgba(245,158,11,0.4)] hover:shadow-[0_0_25px_-5px_rgba(245,158,11,0.6)]",
          variant === 'danger' && "bg-[#2b0909] hover:bg-[#3d0d0d] shadow-[0_0_20px_-5px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_-5px_rgba(239,68,68,0.6)]",
          className
        )}
        {...props}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
        
        {/* Gradient Border Simulation */}
        <div 
          className="absolute inset-0 -z-10 rounded-2xl p-[1.5px] animate-border-spin" 
          style={{ 
            '--gradient-angle': '0deg',
            background: gradientString
          } as React.CSSProperties} 
        />
        
        {/* Inner Background (keeps text crisp & readable) */}
        <div className={cn(
          "absolute inset-[1.5px] -z-10 rounded-[14px] bg-[#1d051d]",
          variant === 'gold' && "bg-[#1f1001]",
          variant === 'danger' && "bg-[#1c0404]"
        )} />
        
        {/* Shine Effect Overlay */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(165,58,237,0.25)_0%,transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </motion.button>
    </>
  );
}

export default LightBeamButton;
