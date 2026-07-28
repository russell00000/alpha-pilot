import { SVGProps } from "react";

/**
 * Minimal geometric empty-state illustration for an empty watchlist.
 * Outlined star surrounded by a teal ring and gold accent shapes.
 * Subtle float animation is applied via .animate-float on the container.
 */
const EmptyWatchlist = ({ className, ...rest }: SVGProps<SVGSVGElement>) => (
  <div className={"animate-float " + (className ?? "")}>
    <svg
      viewBox="0 0 160 160"
      width={160}
      height={160}
      fill="none"
      aria-hidden="true"
      {...rest}
    >
      <circle
        cx={80}
        cy={80}
        r={62}
        stroke="hsl(178 40% 55% / 0.35)"
        strokeWidth={1}
        strokeDasharray="2 6"
      />
      <path
        d="M22 80 A58 58 0 0 1 80 22"
        stroke="#C9A84C"
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />
      <circle cx={132} cy={44} r={3} fill="hsl(178 40% 55%)" />
      <circle cx={30} cy={122} r={2.5} fill="#C9A84C" />
      <path
        d="M80 52 L88.5 71.5 L110 74 L94 88.5 L98.5 110 L80 99 L61.5 110 L66 88.5 L50 74 L71.5 71.5 Z"
        stroke="#C9A84C"
        strokeWidth={2}
        strokeLinejoin="round"
        fill="none"
      />
      <rect
        x={118}
        y={110}
        width={8}
        height={8}
        stroke="hsl(178 40% 55%)"
        strokeWidth={1}
        transform="rotate(45 122 114)"
        opacity={0.7}
      />
    </svg>
  </div>
);

export default EmptyWatchlist;