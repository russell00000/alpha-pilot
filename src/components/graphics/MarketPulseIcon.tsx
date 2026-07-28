import { SVGProps } from "react";

/**
 * Market Pulse — a soft, upward-trending gold line.
 * 24px, 2px stroke, rounded caps. Pure SVG.
 */
const MarketPulseIcon = ({ className, ...rest }: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width={24}
    height={24}
    fill="none"
    className={className}
    aria-hidden="true"
    {...rest}
  >
    <defs>
      <filter id="mp-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0.35" />
      </filter>
    </defs>
    <path
      d="M3 16 L8 12 L12 14 L16 8 L21 6"
      stroke="#C9A84C"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      filter="url(#mp-soft)"
    />
    <circle cx={21} cy={6} r={1.4} fill="#C9A84C" />
  </svg>
);

export default MarketPulseIcon;