import { ElementType, ReactNode } from "react";
import useInView from "@/hooks/useInView";

export type RevealVariant =
  | "mask"      /* text mask reveal */
  | "clip"      /* clip-path wipe */
  | "depth"     /* translateZ entrance */
  | "rise"      /* soft rise + fade */
  | "drift-x"   /* slight horizontal section movement */
  | "stagger";  /* staggered children */

type Props = {
  children: ReactNode;
  variant?: RevealVariant;
  as?: ElementType;
  delay?: number;
  className?: string;
  threshold?: number;
  style?: React.CSSProperties;
};

/**
 * One coordinated reveal per section. Motion only starts when the element
 * enters the viewport, and `will-change` is dropped once it has landed.
 */
const Reveal = ({
  children,
  variant = "rise",
  as: Tag = "div",
  delay = 0,
  className = "",
  threshold,
  style,
}: Props) => {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold });
  return (
    <Tag
      ref={ref}
      className={`rv rv-${variant} ${className}`}
      data-visible={inView || undefined}
      style={{ ["--rv-delay" as string]: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
