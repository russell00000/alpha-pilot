import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type SignalKind = "buy" | "sell" | "hold";

interface SignalBadgeProps {
  kind: SignalKind;
  label?: string;
  className?: string;
}

/**
 * Minimal directional signal badge — chevron up (Buy), chevron down (Sell),
 * horizontal line (Hold). Uses design-system signal tokens + soft glow shadow.
 */
const SignalBadge = ({ kind, label, className }: SignalBadgeProps) => {
  const Icon = kind === "buy" ? ChevronUp : kind === "sell" ? ChevronDown : Minus;
  const text = label ?? (kind === "buy" ? "Buy" : kind === "sell" ? "Sell" : "Hold");
  const tone =
    kind === "buy" ? "signal-badge-buy" : kind === "sell" ? "signal-badge-sell" : "signal-badge-hold";
  return (
    <span className={cn("signal-badge animate-badge-in", tone, className)}>
      <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
      {text}
    </span>
  );
};

export default SignalBadge;