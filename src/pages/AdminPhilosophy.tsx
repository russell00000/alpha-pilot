import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Save, Brain, Shield, PieChart, MessageSquare } from "lucide-react";

interface Philosophy {
  id: string;
  philosophy_text: string;
  risk_guidance: string | null;
  asset_allocation_rules: string | null;
  market_insights_style: string | null;
  updated_at: string;
}

const AdminPhilosophy = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [philosophy, setPhilosophy] = useState<Philosophy | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    // Server-side role check via user_roles (RLS-enforced)
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error || !data) {
        setIsAdmin(false);
        navigate("/");
      } else {
        setIsAdmin(true);
      }
    })();
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchPhilosophy = async () => {
      if (!user || !isAdmin) return;
      
      const { data, error } = await supabase
        .from("investing_philosophy")
        .select("*")
        .limit(1)
        .single();

      if (error) {
        console.error("Error fetching philosophy:", error);
        toast({
          title: "Error",
          description: "Failed to load investing philosophy",
          variant: "destructive",
        });
      } else {
        setPhilosophy(data);
      }
      setLoading(false);
    };

    if (user && isAdmin) {
      fetchPhilosophy();
    }
  }, [user, isAdmin]);

  const handleSave = async () => {
    if (!philosophy) return;
    
    setSaving(true);
    
    const { error } = await supabase
      .from("investing_philosophy")
      .update({
        philosophy_text: philosophy.philosophy_text,
        risk_guidance: philosophy.risk_guidance,
        asset_allocation_rules: philosophy.asset_allocation_rules,
        market_insights_style: philosophy.market_insights_style,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      })
      .eq("id", philosophy.id);

    setSaving(false);

    if (error) {
      console.error("Error saving philosophy:", error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Saved!",
        description: "Your investing philosophy has been updated. All new portfolio recommendations will use this.",
      });
    }
  };

  if (authLoading || isAdmin === null || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  if (!philosophy) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">No philosophy found</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">AI Philosophy Settings</h1>
          <p className="text-muted-foreground">
            Customize how the AI generates portfolio recommendations. Your philosophy shapes every recommendation users receive.
          </p>
        </div>

        <div className="space-y-6">
          {/* Core Philosophy */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <CardTitle>Core Investing Philosophy</CardTitle>
              </div>
              <CardDescription>
                Your fundamental beliefs about investing. This is the foundation of all recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={philosophy.philosophy_text}
                onChange={(e) => setPhilosophy({ ...philosophy, philosophy_text: e.target.value })}
                placeholder="Describe your core investing philosophy..."
                className="min-h-[150px]"
              />
            </CardContent>
          </Card>

          {/* Risk Guidance */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle>Risk Guidance Principles</CardTitle>
              </div>
              <CardDescription>
                How should risk tolerance be interpreted and applied?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={philosophy.risk_guidance || ""}
                onChange={(e) => setPhilosophy({ ...philosophy, risk_guidance: e.target.value })}
                placeholder="Explain your approach to risk management..."
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>

          {/* Asset Allocation Rules */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-primary" />
                <CardTitle>Asset Allocation Rules</CardTitle>
              </div>
              <CardDescription>
                Guidelines for how portfolios should be structured and diversified.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={philosophy.asset_allocation_rules || ""}
                onChange={(e) => setPhilosophy({ ...philosophy, asset_allocation_rules: e.target.value })}
                placeholder="Describe your asset allocation guidelines..."
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>

          {/* Communication Style */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <CardTitle>Communication & Insights Style</CardTitle>
              </div>
              <CardDescription>
                How should the AI communicate with users? What tone and approach?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={philosophy.market_insights_style || ""}
                onChange={(e) => setPhilosophy({ ...philosophy, market_insights_style: e.target.value })}
                placeholder="Describe your communication style and approach to market insights..."
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Philosophy"}
            </Button>
          </div>

          {/* Info Box */}
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <strong>How it works:</strong> When users complete the investment assessment, the AI uses your philosophy to generate personalized portfolio recommendations, market insights, and risk analysis tailored to each user's unique situation.
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPhilosophy;
