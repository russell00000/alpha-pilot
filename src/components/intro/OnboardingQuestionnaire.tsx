import { useState } from "react";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import type { AssessmentData } from "@/components/InvestmentAssessment";
import { cn } from "@/lib/utils";
import TrajectoryGraphic, { type VizVariant, type Slice } from "@/components/intro/TrajectoryGraphic";
import OptionCoverflow, { type CoverflowItem } from "@/components/intro/OptionCoverflow";

/* Restrained champagne-gold palette — metallic, controlled, never hazy orange */
const HUES = [
  { c1: "#8a7038", c2: "#0a0a0c", glow: "#E3C783" },
  { c1: "#7d6c46", c2: "#0a0a0c", glow: "#DCC38C" },
  { c1: "#8f7a44", c2: "#0b0a0a", glow: "#E8D29B" },
  { c1: "#6f6244", c2: "#0a0a0b", glow: "#D6BE8A" },
  { c1: "#847048", c2: "#0a0a0c", glow: "#E0CA96" },
  { c1: "#78683f", c2: "#09090b", glow: "#D9C089" },
  { c1: "#8b7647", c2: "#0a0a0b", glow: "#E5CE95" },
];

type Option = {
  value: string;
  label: string;
  desc?: string;
  /** age bands only — miniature portfolio dashboard preview */
  viz?: VizVariant;
  slices?: Slice[];
  tag?: string;
};

/* microscopic film grain — keeps the glass surface from reading digitally flat */
const GRAIN_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>\")";

/* All option copy below is drawn from the Vantage investing philosophy:
   age-banded allocation rules, risk beta/volatility bands, the asset-class
   hierarchy, and the 1:3 risk-to-reward standard. */
const RISK: Option[] = [
  { value: "conservative", label: "Conservative", desc: "Beta under 1.0 · volatility 2–5%. Capital preservation first — bond ETFs lead, minimal drawdown." },
  { value: "moderate", label: "Moderate", desc: "Beta around 1.0 · volatility ~10%. Balanced growth and preservation across stocks, ETFs and bonds." },
  { value: "aggressive", label: "Aggressive", desc: "Beta 1.2–1.5 · volatility ~15%. Growth-weighted equities, risk justified by 1:3 reward potential." },
  { value: "very_aggressive", label: "Very Aggressive", desc: "Beta 1.5–1.8 · volatility ~20%. Maximum upside capture, diversified across sectors to spread risk." },
];

const GOALS: Option[] = [
  { value: "wealth_building", label: "Growth Maximization", desc: "Intelligently capture upside — established companies in growing addressable markets." },
  { value: "retirement", label: "Retirement", desc: "Long-horizon compounding that shifts from equities to bond ballast as you age." },
  { value: "income", label: "Income Generation", desc: "Bond ETFs and dividend-durable equities producing steady cash flow with low risk." },
  { value: "short_term", label: "Capital Preservation", desc: "Protect the downside first — low-beta exposure with a liquidity buffer." },
  { value: "education", label: "Education Funding", desc: "Dated goal — growth early, de-risked into ETFs and bonds as the date nears." },
  { value: "emergency_fund", label: "Liquidity Buffer", desc: "Cash and short-duration holdings — minimum 5% cash held at all times." },
];

const TIMELINE: Option[] = [
  { value: "less_than_1_year", label: "Under 1 year", desc: "Preservation only — cash and short-duration bond ETFs, no equity risk." },
  { value: "1_to_3_years", label: "1–3 years", desc: "Bond-led with a small ETF sleeve. Volatility must stay contained." },
  { value: "3_to_5_years", label: "3–5 years", desc: "ETF core for diversified exposure with selective single-name stocks." },
  { value: "5_to_10_years", label: "5–10 years", desc: "Equity-weighted — time to let undervalued, high-conviction names compound." },
  { value: "more_than_10_years", label: "10+ years", desc: "Maximum runway. Highest stock weighting the age band allows." },
];

const EXPERIENCE: Option[] = [
  { value: "none", label: "New Investor", desc: "We lead with ETFs for diversified exposure and explain every signal in plain language." },
  { value: "beginner", label: "Beginner", desc: "Recognizable, well-established companies plus an ETF core. Rationale on every position." },
  { value: "intermediate", label: "Intermediate", desc: "Comfortable with fundamentals and RSI / MACD / moving-average signals." },
  { value: "advanced", label: "Advanced", desc: "Full composite scoring — technical (40%) and fundamental (60%) with target prices." },
];

const INCOME: Option[] = [
  { value: "very_stable", label: "Very Stable", desc: "Secure income and funded reserves — risk budget can be deployed fully." },
  { value: "stable", label: "Stable", desc: "Steady income with savings backup. Standard 5% cash allocation." },
  { value: "somewhat_unstable", label: "Somewhat Variable", desc: "Contract or variable income — we widen the cash and liquidity buffer." },
  { value: "unstable", label: "Unstable", desc: "Limited cushion. Preservation is prioritized over upside capture." },
];

const AMOUNTS: Option[] = [
  { value: "1000", label: "$1,000", desc: "ETF-weighted start — diversification before concentration." },
  { value: "5000", label: "$5,000", desc: "Enough to hold an ETF core plus a few high-conviction names." },
  { value: "25000", label: "$25,000", desc: "Full allocation across stocks, ETFs, bonds, alternatives and cash." },
  { value: "100000", label: "$100,000+", desc: "Sector-diversified build with alternatives capped at 10%." },
];

const AGE: Option[] = [
  {
    value: "2002-01-01",
    label: "20s & younger",
    tag: "Aggressive Growth",
    desc: "Maximum runway — equity-weighted for compounding.",
    viz: "growth",
    slices: [
      { label: "Stocks", pct: 70 },
      { label: "ETFs", pct: 25 },
      { label: "Alts & cash", pct: 5 },
    ],
  },
  {
    value: "1991-01-01",
    label: "30s",
    tag: "Balanced Growth",
    desc: "Growth-led with the first sleeve of bond ballast.",
    viz: "donut",
    slices: [
      { label: "Stocks", pct: 65 },
      { label: "ETFs", pct: 25 },
      { label: "Bonds", pct: 5 },
      { label: "Alts & cash", pct: 5 },
    ],
  },
  {
    value: "1981-01-01",
    label: "40s",
    tag: "Diversification",
    desc: "Broader sector spread, growth moderated.",
    viz: "bars",
    slices: [
      { label: "Stocks", pct: 50 },
      { label: "ETFs", pct: 30 },
      { label: "Bonds", pct: 15 },
      { label: "Alts & cash", pct: 5 },
    ],
  },
  {
    value: "1971-01-01",
    label: "50s",
    tag: "Transition Phase",
    desc: "Income allocation rising as equity weight steps down.",
    viz: "area",
    slices: [
      { label: "Stocks", pct: 40 },
      { label: "ETFs", pct: 30 },
      { label: "Bonds", pct: 20 },
      { label: "Alts & cash", pct: 5 },
    ],
  },
  {
    value: "1964-01-01",
    label: "60 – 64",
    tag: "Preservation",
    desc: "Low-volatility core with a larger fixed-income segment.",
    viz: "stable",
    slices: [
      { label: "ETFs", pct: 45 },
      { label: "Bonds", pct: 25 },
      { label: "Stocks", pct: 25 },
      { label: "Alts & cash", pct: 5 },
    ],
  },
  {
    value: "1956-01-01",
    label: "65+",
    tag: "Retirement Income",
    desc: "Bond-led stability with a modest equity sleeve.",
    viz: "shield",
    slices: [
      { label: "Bonds", pct: 60 },
      { label: "Stocks", pct: 15 },
      { label: "ETFs", pct: 15 },
      { label: "Alts & cash", pct: 5 },
    ],
  },
];

type StepDef = { key: keyof AssessmentData | "ageBand"; question: string; options: Option[] };

type StepMeta = StepDef & { note: string };

const STEPS: StepMeta[] = [
  {
    key: "dateOfBirth",
    question: "What's your age range?",
    note: "Age sets your baseline allocation across stocks, ETFs, bonds, alternatives and cash.",
    options: AGE,
  },
  {
    key: "investmentAmount",
    question: "How much are you looking to invest?",
    note: "Position sizing follows capital — diversification comes before concentration.",
    options: AMOUNTS,
  },
  {
    key: "riskTolerance",
    question: "What's your risk tolerance?",
    note: "Risk is measured by beta and volatility, and every unit must earn a 1:3 reward.",
    options: RISK,
  },
  {
    key: "investmentGoal",
    question: "What's your primary objective?",
    note: "Two priorities, in order: capital preservation, then growth maximization.",
    options: GOALS,
  },
  {
    key: "investmentTimeline",
    question: "What's your investment timeline?",
    note: "Shorter horizons shift weight from stocks toward ETFs and bond ETFs.",
    options: TIMELINE,
  },
  {
    key: "investmentExperience",
    question: "What's your investment experience?",
    note: "Sets how much of the technical and fundamental scoring we surface to you.",
    options: EXPERIENCE,
  },
  {
    key: "incomeStability",
    question: "How stable is your income?",
    note: "Income stability determines your liquidity buffer — minimum 5% cash at all times.",
    options: INCOME,
  },
];

const OnboardingQuestionnaire = ({ onComplete }: { onComplete: (data: AssessmentData) => void }) => {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const current = STEPS[step];
  const selected = answers[current.key as string];

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

  /* build the coverflow cards — our option copy inside the Slider Spectra shell */
  const items: CoverflowItem[] = current.options.map((opt, i) => {
    const hue = HUES[i % HUES.length];
    const isSel = selected === opt.value;
    return {
      key: opt.value,
      label: opt.label,
      c1: hue.c1,
      c2: hue.c2,
      glow: hue.glow,
      selected: isSel,
      node: (
        <>
          <span aria-hidden className="glass-sheen" />
          <span aria-hidden className="card-lumen" />
          <span aria-hidden className="viz-grid" />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ opacity: 0.02, backgroundImage: GRAIN_URL, backgroundSize: "120px 120px" }}
          />

          <span className="relative z-[2] flex w-full items-start justify-between gap-3">
            <span className="flex flex-col gap-1">
              <span
                className="font-mono text-[10px] tracking-[0.32em]"
                style={{
                  color: isSel ? hue.glow : "rgba(244,246,251,0.3)",
                  textShadow: isSel ? `0 0 18px ${hue.glow}66` : undefined,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {opt.tag && (
                <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/35">{opt.tag}</span>
              )}
            </span>
            {opt.viz && opt.slices ? <AgeBandGraphic variant={opt.viz} slices={opt.slices} /> : null}
          </span>

          <span className="relative z-[2] mt-4 text-[15px] font-normal uppercase leading-tight tracking-[0.1em] text-[#f4f6fb] [text-shadow:0_1px_1px_rgba(0,0,0,0.5)]">
            {opt.label}
          </span>
          {opt.desc && (
            <span className="relative z-[2] mt-2 text-[11.5px] font-light leading-relaxed tracking-[0.015em] text-white/45">
              {opt.desc}
            </span>
          )}

          {opt.slices && (
            <span className="relative z-[2] mt-auto w-full pt-3">
              <span
                aria-hidden
                className="mb-2.5 block h-px w-full"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 60%, transparent 100%)",
                }}
              />
              <span className="flex flex-col gap-1.5">
                {opt.slices.map((s, si) => (
                  <span key={s.label} className="flex items-center justify-between gap-2.5">
                    <span
                      className="text-[9.5px] uppercase tracking-[0.16em]"
                      style={{ color: si === 0 ? `${hue.glow}` : "rgba(244,246,251,0.35)" }}
                    >
                      {s.label}
                    </span>
                    <span className="flex flex-1 items-center gap-2">
                      <span aria-hidden className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${s.pct}%`,
                            background: si === 0 ? hue.glow : "rgba(255,255,255,0.3)",
                            boxShadow: si === 0 ? `0 0 10px ${hue.glow}88` : undefined,
                          }}
                        />
                      </span>
                      <span
                        className="w-8 text-right font-mono text-[10px] tabular-nums"
                        style={{ color: si === 0 ? "#f4f6fb" : "rgba(244,246,251,0.4)" }}
                      >
                        {s.pct}%
                      </span>
                    </span>
                  </span>
                ))}
              </span>
            </span>
          )}

          <span
            className={cn(
              "absolute bottom-4 right-4 z-[3] flex h-6 w-6 items-center justify-center rounded-full text-[#05070c] transition-all duration-300",
              isSel ? "scale-100 opacity-100" : "scale-75 opacity-0"
            )}
            style={{ background: hue.glow, boxShadow: `0 0 18px ${hue.glow}99` }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        </>
      ),
    };
  });

  return (
    <div className="relative flex min-h-[100svh] w-full flex-col items-center justify-center px-5 py-16 md:px-8">
      <div className="relative w-full max-w-5xl">
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

        <h2 className="font-display text-3xl md:text-5xl max-w-3xl leading-[1.08] tracking-[-0.015em]">
          {current.question}
        </h2>
        <p className="mt-3 max-w-2xl text-[13px] font-light leading-relaxed tracking-[0.02em] text-foreground/40">
          {current.note}
        </p>

        <div className="relative mt-6">
          <span aria-hidden className="glass-env" />
          <div key={step} className={cn("relative", leaving && "animate-panel-out")}>
            <OptionCoverflow
              items={items}
              resetKey={step}
              start={0}
              autoplay={!selected}
              onSelect={(key) => setAnswers((a) => ({ ...a, [current.key as string]: key }))}
            />
            <p className="mt-1 text-center font-mono text-[9.5px] uppercase tracking-[0.28em] text-foreground/30">
              Drag, swipe or use arrow keys · tap the centre card to choose
            </p>
          </div>
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
