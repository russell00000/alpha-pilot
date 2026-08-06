import { useMemo, useState } from "react";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import type { AssessmentData } from "@/components/InvestmentAssessment";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string; desc?: string };

const RISK: Option[] = [
  { value: "conservative", label: "Conservative", desc: "Prefer stability over growth. Minimize losses even if it means lower returns." },
  { value: "moderate", label: "Moderate", desc: "Balance between growth and stability. Accept some volatility for better returns." },
  { value: "aggressive", label: "Aggressive", desc: "Prioritize growth. Comfortable with significant fluctuations for higher potential returns." },
  { value: "very_aggressive", label: "Very Aggressive", desc: "Maximize growth. Accept high volatility for maximum potential returns." },
];

const GOALS: Option[] = [
  { value: "retirement", label: "Retirement", desc: "Build wealth for a comfortable retirement." },
  { value: "wealth_building", label: "Wealth Building", desc: "Grow your money over time through investments." },
  { value: "income", label: "Generate Income", desc: "Create a steady stream of passive income." },
  { value: "short_term", label: "Short-term Savings", desc: "Save for a major purchase or expense coming up soon." },
  { value: "education", label: "Education", desc: "Save for college or educational expenses." },
  { value: "emergency_fund", label: "Emergency Fund", desc: "Build a safety net for unexpected expenses." },
];

const TIMELINE: Option[] = [
  { value: "less_than_1_year", label: "Less than 1 year", desc: "Need access to funds very soon." },
  { value: "1_to_3_years", label: "1–3 years", desc: "Short-term goals like a down payment." },
  { value: "3_to_5_years", label: "3–5 years", desc: "Medium-term goals with some flexibility." },
  { value: "5_to_10_years", label: "5–10 years", desc: "Long-term goals with time to grow." },
  { value: "more_than_10_years", label: "More than 10 years", desc: "Very long-term, like retirement or legacy." },
];

const EXPERIENCE: Option[] = [
  { value: "none", label: "No Experience", desc: "I've never invested before." },
  { value: "beginner", label: "Beginner", desc: "I have basic knowledge and maybe a savings account." },
  { value: "intermediate", label: "Intermediate", desc: "I've invested in stocks, bonds, or mutual funds." },
  { value: "advanced", label: "Advanced", desc: "I actively manage investments and understand complex strategies." },
];

const INCOME: Option[] = [
  { value: "very_stable", label: "Very Stable", desc: "Secure job with consistent income, good emergency fund." },
  { value: "stable", label: "Stable", desc: "Steady income with some savings as backup." },
  { value: "somewhat_unstable", label: "Somewhat Unstable", desc: "Variable income or contract work, building savings." },
  { value: "unstable", label: "Unstable", desc: "Irregular income, limited financial cushion." },
];

const AMOUNTS: Option[] = [
  { value: "1000", label: "$1,000", desc: "Starting small and steady." },
  { value: "5000", label: "$5,000", desc: "A meaningful first position." },
  { value: "25000", label: "$25,000", desc: "Building a real portfolio." },
  { value: "100000", label: "$100,000+", desc: "Deploying serious capital." },
];

const AGE: Option[] = [
  { value: "2002-01-01", label: "20s & younger", desc: "Maximum runway — growth-weighted equity tilt." },
  { value: "1991-01-01", label: "30s", desc: "Peak accumulation with a first bond sleeve." },
  { value: "1981-01-01", label: "40s", desc: "Balanced growth with rising ballast." },
  { value: "1971-01-01", label: "50s", desc: "Growth moderated by income and stability." },
  { value: "1964-01-01", label: "60 – 64", desc: "Pre-retirement — ETF core, capital durability." },
  { value: "1956-01-01", label: "65+", desc: "Income first — bond-led preservation." },
];

type StepDef = { key: keyof AssessmentData | "ageBand"; question: string; options: Option[] };

const STEPS: StepDef[] = [
  { key: "dateOfBirth", question: "What's your age range?", options: AGE },
  { key: "investmentAmount", question: "How much are you looking to invest?", options: AMOUNTS },
  { key: "riskTolerance", question: "What's your risk tolerance?", options: RISK },
  { key: "investmentGoal", question: "What's your primary investment goal?", options: GOALS },
  { key: "investmentTimeline", question: "What's your investment timeline?", options: TIMELINE },
  { key: "investmentExperience", question: "What's your investment experience?", options: EXPERIENCE },
  { key: "incomeStability", question: "How stable is your income?", options: INCOME },
];

const OnboardingQuestionnaire = ({ onComplete }: { onComplete: (data: AssessmentData) => void }) => {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const current = STEPS[step];
  const selected = answers[current.key as string];

  const grid = useMemo(
    () => (current.options.length > 4 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"),
    [current.options.length]
  );

  const advance = () => {
    if (!selected) return;
    if (step === STEPS.length - 1) {
      const data: AssessmentData = {
        dateOfBirth: answers.dateOfBirth || "1998-01-01",
        investmentAmount: Number(answers.investmentAmount || 1000),
        recurringInvestment: false,
        riskTolerance: answers.riskTolerance || "moderate",
        investmentGoal: answers.investmentGoal || "wealth_building",
        investmentTimeline: answers.investmentTimeline || "5_to_10_years",
        investmentExperience: answers.investmentExperience || "beginner",
        incomeStability: answers.incomeStability || "stable",
      };
      setLeaving(true);
      setTimeout(() => onComplete(data), 520);
      return;
    }
    setLeaving(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setLeaving(false);
    }, 340);
  };

  const back = () => {
    if (step === 0) return;
    setLeaving(true);
    setTimeout(() => {
      setStep((s) => s - 1);
      setLeaving(false);
    }, 340);
  };

  return (
    <div className="relative flex min-h-[100svh] w-full flex-col items-center justify-center px-5 py-16 md:px-8">
      <div className="w-full max-w-5xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.34em] text-foreground/45">
            Step {step + 1} of {STEPS.length}
          </span>
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-[3px] rounded-full transition-all duration-500",
                  i === step ? "w-7 bg-foreground" : i < step ? "w-3 bg-foreground/50" : "w-3 bg-foreground/15"
                )}
              />
            ))}
          </div>
        </div>

        <h2 className="font-display text-3xl md:text-5xl max-w-3xl leading-[1.08]">{current.question}</h2>

        <div
          key={step}
          className={cn("mt-10 grid grid-cols-1 gap-4", grid, leaving && "animate-panel-out")}
        >
          {current.options.map((opt, i) => {
            const isSel = selected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setAnswers((a) => ({ ...a, [current.key as string]: opt.value }))}
                style={{ ["--stagger" as string]: i }}
                data-selected={isSel}
                className={cn(
                  "glass-tile group relative flex flex-col items-start gap-2 overflow-hidden rounded-3xl p-5 text-left md:p-6",
                  leaving && "animate-panel-out"
                )}
              >
                <span
                  className={cn(
                    "absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300",
                    isSel ? "bg-foreground text-background scale-100 opacity-100" : "scale-75 opacity-0"
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="font-display text-lg md:text-xl pr-8 text-foreground">{opt.label}</span>
                {opt.desc && <span className="text-sm leading-relaxed text-foreground/50">{opt.desc}</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={back}
            disabled={step === 0}
            className={cn("pill-secondary text-sm", step === 0 && "pointer-events-none opacity-0")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button onClick={advance} disabled={!selected} className="pill-primary tap-scale text-sm">
            {step === STEPS.length - 1 ? "See my dashboard" : "Continue"}
            <span className="pill-badge">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingQuestionnaire;
