import { useLocation } from "react-router-dom";
import { ReactNode } from "react";

/**
 * Wraps route content with a fade/slide entrance keyed to the pathname,
 * giving subtle, premium transitions between pages.
 */
const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="animate-page-in">
      {children}
    </div>
  );
};

export default PageTransition;