import React, { useState, useEffect } from 'react';

interface MobileSplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export const MobileSplashScreen: React.FC<MobileSplashScreenProps> = ({
  onFinish,
  durationMs = 2400
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, Math.max(0, durationMs - 500));

    const finishTimer = setTimeout(() => {
      setIsVisible(false);
      if (onFinish) onFinish();
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [durationMs, onFinish]);

  const handleDismiss = () => {
    setIsFading(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onFinish) onFinish();
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div
      onClick={handleDismiss}
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#150a2a] select-none cursor-pointer transition-opacity duration-500 ease-out ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Mobile Splash Screen"
    >
      <img
        src="/splash_screen.png"
        alt="VMS Mobile Splash"
        className="w-full h-full object-cover sm:object-contain"
      />
      <div className="absolute bottom-5 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none">
        <div className="w-10 h-1 bg-white/30 rounded-full animate-pulse" />
        <span className="text-[10px] font-medium tracking-widest text-white/50 uppercase">
          Tap anywhere to continue
        </span>
      </div>
    </div>
  );
};
