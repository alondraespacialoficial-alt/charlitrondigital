import React, { useState } from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showText?: boolean;
  variant?: 'full' | 'icon';
  showTagline?: boolean;
}

export const CharlitronLogo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  variant,
  showTagline = true,
}) => {
  const [imgError, setImgError] = useState(false);

  // Determine whether to display the icon-only or the full logo
  const isIconOnly = variant === 'icon' || (!showText && size === 'hero') || (!showText && variant !== 'full');

  // Height configurations tailored to each size tier
  const heightClasses = {
    sm: isIconOnly ? 'h-7 w-auto' : 'h-7 md:h-8 w-auto',
    md: isIconOnly ? 'h-9 w-auto' : 'h-8 md:h-10 w-auto',
    lg: isIconOnly ? 'h-12 w-auto' : 'h-11 md:h-12 w-auto',
    hero: isIconOnly ? 'h-24 sm:h-28 md:h-32 w-auto' : 'h-16 md:h-20 w-auto',
  }[size];

  if (!imgError) {
    if (isIconOnly) {
      return (
        <div data-cotizador-logo-trigger className={`inline-flex items-center justify-center ${className}`}>
          <img
            src="/charlitron-icon.png"
            alt="Charlitron Digital Icon"
            className={`${heightClasses} object-contain select-none drop-shadow-[0_0_16px_rgba(250,204,21,0.25)]`}
            onError={() => setImgError(true)}
            loading="eager"
          />
        </div>
      );
    }

    return (
      <div data-cotizador-logo-trigger className={`inline-flex items-center gap-3 ${className}`}>
        <div className="flex flex-col text-left">
          <img
            src="/charlitron-logo.png"
            alt="Charlitron Digital"
            className={`${heightClasses} object-contain select-none drop-shadow-[0_0_12px_rgba(250,204,21,0.2)]`}
            onError={() => setImgError(true)}
            loading="eager"
          />
          {showTagline && size !== 'sm' && (
            <span className="text-[10.5px] md:text-[11px] text-zinc-400 font-medium tracking-wide mt-0.5 pl-1 hidden sm:block">
              El brazo tecnológico de Charlitron
            </span>
          )}
        </div>
      </div>
    );
  }

  // Fallback geometric vector if image fails
  const iconDimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    hero: 'w-24 h-24 md:w-28 md:h-28',
  }[size];

  return (
    <div data-cotizador-logo-trigger className={`inline-flex items-center gap-3 ${className}`}>
      <div className={`relative ${iconDimensions} flex items-center justify-center shrink-0`}>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-[0_0_12px_rgba(250,204,21,0.35)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon
            points="50,6 94,86 6,86"
            className="fill-[#121216] stroke-amber-400"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <polygon
            points="50,26 80,80 20,80"
            className="fill-amber-400"
            strokeLinejoin="round"
          />
          <polygon
            points="50,44 68,76 32,76"
            className="fill-[#09090b]"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="63" r="5" className="fill-amber-300" />
          <circle cx="50" cy="12" r="2.5" className="fill-amber-200" />
          <circle cx="86" cy="80" r="2.5" className="fill-amber-200" />
          <circle cx="14" cy="80" r="2.5" className="fill-amber-200" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col text-left leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-display font-extrabold tracking-tight text-white text-base md:text-lg">
              CHARLITRON
            </span>
            <span className="font-display font-semibold text-amber-400 text-xs md:text-sm tracking-wider uppercase px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
              DIGITAL
            </span>
          </div>
          {showTagline && (
            <span className="text-[11px] text-zinc-400 font-medium tracking-wide">
              El brazo tecnológico de Charlitron
            </span>
          )}
        </div>
      )}
    </div>
  );
};
