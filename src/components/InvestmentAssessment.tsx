import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, ChevronLeft, Calendar, DollarSign, Target, TrendingUp, Clock, Briefcase, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AssessmentData {
  dateOfBirth: string;
  investmentAmount: number;
  recurringInvestment: boolean;
  recurringAmount?: number;
  recurringFrequency?: string;
  riskTolerance: string;
  investmentGoal: string;
  investmentTimeline: string;
  investmentExperience: string;
  incomeStability: string;
}

interface InvestmentAssessmentProps {
  onComplete: (data: AssessmentData) => void;
  loading?: boolean;
}

const InvestmentAssessment = ({ onComplete, loading }: InvestmentAssessmentProps) => {
  const [step, setStep] = useState(1);
  const totalSteps = 7;
  
  const [formData, setFormData] = useState<AssessmentData>({
    dateOfBirth: "",
    investmentAmount: 0,
    recurringInvestment: false,
    recurringAmount: undefined,
    recurringFrequency: undefined,
    riskTolerance: "",
    investmentGoal: "",
    investmentTimeline: "",
    investmentExperience: "",
    incomeStability: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = () => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.dateOfBirth) {
          newErrors.dateOfBirth = "Please enter your date of birth";
        } else {
          const birthDate = new Date(formData.dateOfBirth);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear();
          if (age < 18) {
            newErrors.dateOfBirth = "You must be at least 18 years old";
          } else if (age > 120) {
            newErrors.dateOfBirth = "Please enter a valid date of birth";
          }
        }
        break;
      case 2:
        if (formData.investmentAmount === undefined || formData.investmentAmount === null || formData.investmentAmount < 100) {
          newErrors.investmentAmount = "Minimum investment is $100";
        }
        if (formData.recurringInvestment) {
          if (!formData.recurringAmount || formData.recurringAmount < 25) {
            newErrors.recurringAmount = "Minimum recurring investment is $25";
          }
          if (!formData.recurringFrequency) {
            newErrors.recurringFrequency = "Please select a frequency (Weekly, Bi-weekly, Monthly, or Quarterly)";
          }
        }
        break;
      case 3:
        if (!formData.riskTolerance) {
          newErrors.riskTolerance = "Please select your risk tolerance";
        }
        break;
      case 4:
        if (!formData.investmentGoal) {
          newErrors.investmentGoal = "Please select your investment goal";
        }
        break;
      case 5:
        if (!formData.investmentTimeline) {
          newErrors.investmentTimeline = "Please select your investment timeline";
        }
        break;
      case 6:
        if (!formData.investmentExperience) {
          newErrors.investmentExperience = "Please select your experience level";
        }
        break;
      case 7:
        if (!formData.incomeStability) {
          newErrors.incomeStability = "Please select your income stability";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      if (step === totalSteps) {
        onComplete(formData);
      } else {
        setStep(step + 1);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-3 h-3 rounded-full transition-all",
            i + 1 === step
              ? "bg-primary w-8"
              : i + 1 < step
              ? "bg-primary"
              : "bg-muted"
          )}
        />
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
          <Calendar className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Let's start with your age</h2>
        <p className="text-muted-foreground">Your age helps us determine the right investment strategy and risk level for you.</p>
      </div>
      <div className="space-y-2 max-w-xs mx-auto">
        <Label htmlFor="dob">Date of Birth</Label>
        <Input
          id="dob"
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
          max={new Date().toISOString().split('T')[0]}
          className="text-center"
        />
        {errors.dateOfBirth && <p className="text-sm text-destructive">{errors.dateOfBirth}</p>}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
          <DollarSign className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">How much would you like to invest?</h2>
        <p className="text-muted-foreground">Enter your initial investment amount and set up recurring contributions.</p>
      </div>
      <div className="space-y-4 max-w-sm mx-auto">
        <div className="space-y-2">
          <Label htmlFor="amount">Initial Investment Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="amount"
              type="number"
              min="100"
              step="100"
              placeholder="1,000"
              value={formData.investmentAmount || ""}
              onChange={(e) => {
                const raw = e.target.value;
                const normalized = raw.replace(/,/g, "");
                const next = normalized === "" ? 0 : Number(normalized);
                setFormData({ ...formData, investmentAmount: next });
                setErrors((prev) => {
                  const copy = { ...prev };
                  delete copy.investmentAmount;
                  return copy;
                });
              }}
              className="pl-8"
            />
          </div>
          {errors.investmentAmount && <p className="text-sm text-destructive">{errors.investmentAmount}</p>}
        </div>

        <div className="flex items-center space-x-2 pt-4">
          <Checkbox
            id="recurring"
            checked={formData.recurringInvestment}
            onCheckedChange={(checked) => {
              const enabled = checked === true;
              setFormData({
                ...formData,
                recurringInvestment: enabled,
                ...(enabled
                  ? {}
                  : {
                      recurringAmount: undefined,
                      recurringFrequency: undefined,
                    }),
              });
              setErrors((prev) => {
                const copy = { ...prev };
                delete copy.recurringAmount;
                delete copy.recurringFrequency;
                return copy;
              });
            }}
          />
          <Label htmlFor="recurring" className="cursor-pointer">I want to make recurring investments</Label>
        </div>

        {formData.recurringInvestment && (
          <div className="space-y-4 pt-2 pl-6 border-l-2 border-primary/20">
            <div className="space-y-2">
              <Label htmlFor="recurringAmount">Recurring Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="recurringAmount"
                  type="number"
                  min="25"
                  step="25"
                  placeholder="100"
                  value={formData.recurringAmount || ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const normalized = raw.replace(/,/g, "");
                    const next = normalized === "" ? 0 : Number(normalized);
                    setFormData({ ...formData, recurringAmount: next });
                    setErrors((prev) => {
                      const copy = { ...prev };
                      delete copy.recurringAmount;
                      return copy;
                    });
                  }}
                  className="pl-8"
                />
              </div>
              {errors.recurringAmount && <p className="text-sm text-destructive">{errors.recurringAmount}</p>}
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <RadioGroup
                value={formData.recurringFrequency || ""}
                onValueChange={(value) => {
                  setFormData({ ...formData, recurringFrequency: value });
                  setErrors((prev) => {
                    const copy = { ...prev };
                    delete copy.recurringFrequency;
                    return copy;
                  });
                }}
                className="grid grid-cols-2 gap-2"
              >
                {[
                  { value: "weekly", label: "Weekly" },
                  { value: "biweekly", label: "Bi-weekly" },
                  { value: "monthly", label: "Monthly" },
                  { value: "quarterly", label: "Quarterly" },
                ].map((option) => (
                  <div key={option.value}>
                    <RadioGroupItem value={option.value} id={option.value} className="peer sr-only" />
                    <Label
                      htmlFor={option.value}
                      className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-sm"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {errors.recurringFrequency && <p className="text-sm text-destructive">{errors.recurringFrequency}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
          <TrendingUp className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">What's your risk tolerance?</h2>
        <p className="text-muted-foreground">This helps us balance potential returns with your comfort level.</p>
      </div>
      <RadioGroup
        value={formData.riskTolerance}
        onValueChange={(value) => setFormData({ ...formData, riskTolerance: value })}
        className="grid gap-3 max-w-md mx-auto"
      >
        {[
          { value: "conservative", label: "Conservative", desc: "Prefer stability over growth. Minimize losses even if it means lower returns." },
          { value: "moderate", label: "Moderate", desc: "Balance between growth and stability. Accept some volatility for better returns." },
          { value: "aggressive", label: "Aggressive", desc: "Prioritize growth. Comfortable with significant fluctuations for higher potential returns." },
          { value: "very_aggressive", label: "Very Aggressive", desc: "Maximize growth. Accept high volatility for maximum potential returns." },
        ].map((option) => (
          <div key={option.value}>
            <RadioGroupItem value={option.value} id={option.value} className="peer sr-only" />
            <Label
              htmlFor={option.value}
              className="flex flex-col p-4 rounded-lg border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <span className="font-semibold">{option.label}</span>
              <span className="text-sm text-muted-foreground">{option.desc}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      {errors.riskTolerance && <p className="text-sm text-destructive text-center">{errors.riskTolerance}</p>}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
          <Target className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">What's your primary investment goal?</h2>
        <p className="text-muted-foreground">This determines the strategy we recommend for your portfolio.</p>
      </div>
      <RadioGroup
        value={formData.investmentGoal}
        onValueChange={(value) => setFormData({ ...formData, investmentGoal: value })}
        className="grid gap-3 max-w-md mx-auto"
      >
        {[
          { value: "retirement", label: "Retirement", desc: "Build wealth for a comfortable retirement." },
          { value: "wealth_building", label: "Wealth Building", desc: "Grow your money over time through investments." },
          { value: "income", label: "Generate Income", desc: "Create a steady stream of passive income." },
          { value: "short_term", label: "Short-term Savings", desc: "Save for a major purchase or expense coming up soon." },
          { value: "education", label: "Education", desc: "Save for college or educational expenses." },
          { value: "emergency_fund", label: "Emergency Fund", desc: "Build a safety net for unexpected expenses." },
        ].map((option) => (
          <div key={option.value}>
            <RadioGroupItem value={option.value} id={`goal-${option.value}`} className="peer sr-only" />
            <Label
              htmlFor={`goal-${option.value}`}
              className="flex flex-col p-4 rounded-lg border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <span className="font-semibold">{option.label}</span>
              <span className="text-sm text-muted-foreground">{option.desc}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      {errors.investmentGoal && <p className="text-sm text-destructive text-center">{errors.investmentGoal}</p>}
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
          <Clock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">What's your investment timeline?</h2>
        <p className="text-muted-foreground">When do you expect to need this money?</p>
      </div>
      <RadioGroup
        value={formData.investmentTimeline}
        onValueChange={(value) => setFormData({ ...formData, investmentTimeline: value })}
        className="grid gap-3 max-w-md mx-auto"
      >
        {[
          { value: "less_than_1_year", label: "Less than 1 year", desc: "Need access to funds very soon." },
          { value: "1_to_3_years", label: "1-3 years", desc: "Short-term goals like a down payment." },
          { value: "3_to_5_years", label: "3-5 years", desc: "Medium-term goals with some flexibility." },
          { value: "5_to_10_years", label: "5-10 years", desc: "Long-term goals with time to grow." },
          { value: "more_than_10_years", label: "More than 10 years", desc: "Very long-term, like retirement or legacy." },
        ].map((option) => (
          <div key={option.value}>
            <RadioGroupItem value={option.value} id={`timeline-${option.value}`} className="peer sr-only" />
            <Label
              htmlFor={`timeline-${option.value}`}
              className="flex flex-col p-4 rounded-lg border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <span className="font-semibold">{option.label}</span>
              <span className="text-sm text-muted-foreground">{option.desc}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      {errors.investmentTimeline && <p className="text-sm text-destructive text-center">{errors.investmentTimeline}</p>}
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
          <Briefcase className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">What's your investment experience?</h2>
        <p className="text-muted-foreground">This helps us tailor our recommendations to your knowledge level.</p>
      </div>
      <RadioGroup
        value={formData.investmentExperience}
        onValueChange={(value) => setFormData({ ...formData, investmentExperience: value })}
        className="grid gap-3 max-w-md mx-auto"
      >
        {[
          { value: "none", label: "No Experience", desc: "I've never invested before." },
          { value: "beginner", label: "Beginner", desc: "I have basic knowledge and maybe a savings account." },
          { value: "intermediate", label: "Intermediate", desc: "I've invested in stocks, bonds, or mutual funds." },
          { value: "advanced", label: "Advanced", desc: "I actively manage investments and understand complex strategies." },
        ].map((option) => (
          <div key={option.value}>
            <RadioGroupItem value={option.value} id={`exp-${option.value}`} className="peer sr-only" />
            <Label
              htmlFor={`exp-${option.value}`}
              className="flex flex-col p-4 rounded-lg border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <span className="font-semibold">{option.label}</span>
              <span className="text-sm text-muted-foreground">{option.desc}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      {errors.investmentExperience && <p className="text-sm text-destructive text-center">{errors.investmentExperience}</p>}
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">How stable is your income?</h2>
        <p className="text-muted-foreground">This helps us understand your financial security for appropriate risk levels.</p>
      </div>
      <RadioGroup
        value={formData.incomeStability}
        onValueChange={(value) => setFormData({ ...formData, incomeStability: value })}
        className="grid gap-3 max-w-md mx-auto"
      >
        {[
          { value: "very_stable", label: "Very Stable", desc: "Secure job with consistent income, good emergency fund." },
          { value: "stable", label: "Stable", desc: "Steady income with some savings as backup." },
          { value: "somewhat_unstable", label: "Somewhat Unstable", desc: "Variable income or contract work, building savings." },
          { value: "unstable", label: "Unstable", desc: "Irregular income, limited financial cushion." },
        ].map((option) => (
          <div key={option.value}>
            <RadioGroupItem value={option.value} id={`income-${option.value}`} className="peer sr-only" />
            <Label
              htmlFor={`income-${option.value}`}
              className="flex flex-col p-4 rounded-lg border-2 border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
            >
              <span className="font-semibold">{option.label}</span>
              <span className="text-sm text-muted-foreground">{option.desc}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
      {errors.incomeStability && <p className="text-sm text-destructive text-center">{errors.incomeStability}</p>}
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      default: return null;
    }
  };

  return (
    <div className="glass-card p-6 md:p-8 max-w-2xl mx-auto">
      {renderStepIndicator()}
      {renderCurrentStep()}
      
      <div className="flex justify-between mt-8 pt-6 border-t border-border/50">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 1 || loading}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button onClick={handleNext} disabled={loading} className="gap-2">
          {loading ? "Generating..." : step === totalSteps ? "Get My Portfolio" : "Continue"}
          {step !== totalSteps && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default InvestmentAssessment;