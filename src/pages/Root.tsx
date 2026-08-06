import { useCallback, useEffect, useState } from "react";
import LandingIntro from "@/components/intro/LandingIntro";
import OnboardingQuestionnaire from "@/components/intro/OnboardingQuestionnaire";
import type { AssessmentData } from "@/components/InvestmentAssessment";
import Index from "@/pages/Index";

const DONE_KEY = "vps_intro_v1";
const ANSWERS_KEY = "vps_assessment";

type Phase = "intro" | "quiz" | "site";

/**
 * Route "/" — first-visit experience (animated market-line landing →
 * questionnaire → main site reveal). Returning visitors go straight to
 * the dashboard; every other route is untouched.
 */
const Root = () => {
  const [phase, setPhase] = useState<Phase>(() => {
    try {
      return localStorage.getItem(DONE_KEY) ? "site" : "intro";
    } catch {
      return "intro";
    }
  });
  const [exiting, setExiting] = useState(false);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {}
    setPhase("site");
  }, []);

  const startQuiz = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setPhase("quiz");
      setExiting(false);
    }, 620);
  }, []);

  const handleComplete = useCallback(
    (data: AssessmentData) => {
      try {
        localStorage.setItem(ANSWERS_KEY, JSON.stringify(data));
      } catch {}
      finish();
    },
    [finish]
  );

  useEffect(() => {
    if (phase === "site") return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [phase]);

  if (phase === "site") return <Index />;

  return (
    <div
      className="relative min-h-[100svh] w-full bg-background"
      style={{
        transition: "opacity .6s cubic-bezier(.22,1,.36,1), transform .6s cubic-bezier(.22,1,.36,1)",
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateY(-40px)" : "translateY(0)",
      }}
    >
      {phase === "intro" ? (
        <LandingIntro onStart={startQuiz} onSkip={finish} />
      ) : (
        <OnboardingQuestionnaire onComplete={handleComplete} />
      )}
    </div>
  );
};

export default Root;
