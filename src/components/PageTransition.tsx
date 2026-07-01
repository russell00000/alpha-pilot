import { useLocation } from "react-router-dom";
import { ReactNode, useEffect, useState } from "react";

/**
 * Wraps route content with a soft blur/fade entrance keyed to the pathname
 * and paints a thin luminous progress sweep across the top of the viewport,
 * giving navigations a classy, deliberate feel.
 */
const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [progressKey, setProgressKey] = useState(0);

  useEffect(() => {
    setProgressKey((k) => k + 1);
  }, [location.pathname]);

  return (
    <>
      <span key={progressKey} className="route-progress" aria-hidden="true" />
      <div key={location.pathname} className="animate-page-in">
        {children}
      </div>
    </>
  );
};

export default PageTransition;