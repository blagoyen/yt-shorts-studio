import { memo } from "react";

export const BrandMark = memo(function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      className="brand-svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cutline-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1c1c22" />
          <stop offset="100%" stopColor="#09090c" />
        </linearGradient>
        <linearGradient id="cutline-beam" x1="12" y1="44" x2="52" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#cutline-bg)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      <polygon points="21,19 29,19 29,33 21,37.8" fill="#ffffff" />
      <polygon points="21,41.6 29,36.8 29,49 21,49" fill="#ffffff" />
      <polygon points="35,14 43,14 43,24.6 35,29.4" fill="#ffffff" />
      <polygon points="35,33.2 43,28.4 43,44 35,44" fill="#ffffff" />
      <line x1="13" y1="43.5" x2="51" y2="20.5" stroke="url(#cutline-beam)" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
});
