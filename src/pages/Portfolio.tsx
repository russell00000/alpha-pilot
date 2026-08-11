import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import InvestmentAssessment, { AssessmentData } from "@/components/InvestmentAssessment";
import PortfolioRecommendation from "@/components/PortfolioRecommendation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import financeBg from "@/assets/finance-bg.webp";

interface SavedAssessment {
  id: string;
  date_of_birth: string;
  investment_amount: number;
  recurring_investment: boolean;
  recurring_amount: number | null;
  recurring_frequency: string | null;
  risk_tolerance: string;
  investment_goal: string;
  investment_timeline: string;
  investment_experience: string;
  income_stability: string;
}

interface SavedRecommendation {
  allocation_stocks: number;
  allocation_bonds: number;
  allocation_etfs: number;
  allocation_cash: number;
  allocation_alternatives: number;
  recommended_funds: any;
  rationale: string;
  market_insights?: string;
  risk_analysis?: string;
}

const Portfolio = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [showAssessment, setShowAssessment] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [savedAssessment, setSavedAssessment] = useState<SavedAssessment | null>(null);
  const [savedRecommendation, setSavedRecommendation] = useState<SavedRecommendation | null>(null);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Load existing assessment and recommendation
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) return;

      try {
        // Get latest assessment
        const { data: assessments, error: assessmentError } = await supabase
          .from("investment_assessments")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (assessmentError) throw assessmentError;

        if (assessments && assessments.length > 0) {
          const assessment = assessments[0];
          setSavedAssessment(assessment);

          // Get recommendation for this assessment
          const { data: recommendations, error: recError } = await supabase
            .from("portfolio_recommendations")
            .select("*")
            .eq("assessment_id", assessment.id)
            .limit(1);

          if (recError) throw recError;

          if (recommendations && recommendations.length > 0) {
            setSavedRecommendation(recommendations[0]);
          }
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    if (user) {
      loadUserData();
    } else {
      setLoadingData(false);
    }
  }, [user]);

  const handleAssessmentComplete = async (data: AssessmentData) => {
    if (!user) return;

    setGenerating(true);
    try {
      // Call AI edge function to generate portfolio
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke("generate-portfolio", {
        body: { assessment: data },
      });

      if (aiError) {
        console.error("AI generation error:", aiError);
        throw new Error(aiError.message || "Failed to generate portfolio");
      }

      if (aiResponse?.error) {
        throw new Error(aiResponse.error);
      }

      const recommendation = aiResponse;

      // Save assessment to database
      const { data: savedAssess, error: assessError } = await supabase
        .from("investment_assessments")
        .insert({
          user_id: user.id,
          date_of_birth: data.dateOfBirth,
          investment_amount: data.investmentAmount,
          recurring_investment: data.recurringInvestment,
          recurring_amount: data.recurringAmount || null,
          recurring_frequency: data.recurringFrequency || null,
          risk_tolerance: data.riskTolerance,
          investment_goal: data.investmentGoal,
          investment_timeline: data.investmentTimeline,
          investment_experience: data.investmentExperience,
          income_stability: data.incomeStability,
        })
        .select()
        .single();

      if (assessError) throw assessError;

      // Save recommendation to database
      const { data: savedRec, error: recError } = await supabase
        .from("portfolio_recommendations")
        .insert({
          assessment_id: savedAssess.id,
          user_id: user.id,
          allocation_stocks: recommendation.allocation.stocks,
          allocation_bonds: recommendation.allocation.bonds,
          allocation_etfs: 0,
          allocation_cash: recommendation.allocation.cash,
          allocation_alternatives: recommendation.allocation.alternatives,
          recommended_funds: recommendation.funds as any,
          rationale: `${recommendation.rationale}\n\n**Market Insights:**\n${recommendation.marketInsights || ""}\n\n**Risk Analysis:**\n${recommendation.riskAnalysis || ""}`,
        } as any)
        .select()
        .single();

      if (recError) throw recError;

      setSavedAssessment(savedAssess);
      setSavedRecommendation(savedRec);
      setShowAssessment(false);

      toast({
        title: "AI Portfolio Generated!",
        description: "Your personalized portfolio recommendation is ready.",
      });
    } catch (error: any) {
      console.error("Error saving assessment:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate your portfolio. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleRetakeAssessment = () => {
    setShowAssessment(true);
  };

  // Show loading only during auth check, not data loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background relative">
        <div className="fixed inset-0 pointer-events-none opacity-[0.16]" style={{ filter: "brightness(1.2) saturate(0.3) contrast(0.9)", backgroundImage: `url(${financeBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
        <div className="fixed inset-0 pointer-events-none bg-background/90" />
        <Header />
        <main data-scene="portfolio" className="container mx-auto px-4 py-8 relative">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Finance background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.16]" style={{ filter: "brightness(1.2) saturate(0.3) contrast(0.9)", backgroundImage: `url(${financeBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
      <div className="fixed inset-0 pointer-events-none bg-background/90" />

      <Header />
      
      <main data-scene="portfolio" className="container mx-auto px-4 py-8 relative">
        {/* Show loading state while data is being fetched */}
        {loadingData ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-pulse text-muted-foreground">Loading your portfolio...</div>
          </div>
        ) : showAssessment || (!savedAssessment && !savedRecommendation) ? (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2" style={{ textShadow: '0 1px 20px rgba(0,0,0,0.5)' }}>Investment Assessment</h1>
              <p className="text-muted-foreground">Answer a few questions to get your personalized portfolio recommendation</p>
            </div>
            <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 p-6">
              <InvestmentAssessment onComplete={handleAssessmentComplete} loading={generating} />
            </div>
          </>
        ) : savedRecommendation && savedAssessment ? (
          /* Show Portfolio Recommendation */
          <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 p-6">
            <PortfolioRecommendation
              allocation={{
                stocks: Number(savedRecommendation.allocation_stocks),
                bonds: Number(savedRecommendation.allocation_bonds),
                cash: Number(savedRecommendation.allocation_cash),
                alternatives: Number(savedRecommendation.allocation_alternatives),
              }}
              funds={savedRecommendation.recommended_funds}
              rationale={savedRecommendation.rationale}
              investmentAmount={Number(savedAssessment.investment_amount)}
              riskProfile={savedAssessment.risk_tolerance}
              timeline={savedAssessment.investment_timeline}
              goal={savedAssessment.investment_goal}
              onRetakeAssessment={handleRetakeAssessment}
            />
          </div>
        ) : (
          /* Prompt to take assessment */
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/20 p-8 max-w-md mx-auto">
              <div className="inline-flex p-4 rounded-full bg-primary/10 mb-6">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Get Your Personalized Portfolio
              </h2>
              <p className="text-muted-foreground mb-6">
                Take a quick assessment to receive investment recommendations tailored to your goals, risk tolerance, and timeline.
              </p>
              <Button onClick={() => setShowAssessment(true)} size="lg" className="gap-2">
                <ClipboardList className="w-5 h-5" />
                Start Assessment
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Portfolio;