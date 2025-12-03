import Header from "@/components/Header";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Link to="/">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-6">Terms of Service</h1>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing and using InvestAI, you accept and agree to be bound by the terms and conditions of this agreement. 
              If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Educational Purpose Only</h2>
            <p className="text-muted-foreground leading-relaxed">
              InvestAI is designed for educational and informational purposes only. The information provided through our 
              platform, including AI-generated insights, market data, and analysis, should not be construed as financial, 
              investment, tax, or legal advice.
            </p>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. No Investment Advice</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not provide personalized investment recommendations. Any investment decisions you make are solely your 
              responsibility. Always consult with qualified financial professionals before making investment decisions.
            </p>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Accuracy of Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              While we strive to provide accurate and up-to-date market information, we cannot guarantee the accuracy, 
              completeness, or timeliness of any data. Market data is provided by third-party sources and may be delayed.
            </p>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Risk Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed">
              Investing involves risk, including the potential loss of principal. Past performance does not guarantee 
              future results. The value of investments can fluctuate, and you may receive back less than you originally invested.
            </p>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              InvestAI and its affiliates shall not be liable for any direct, indirect, incidental, special, consequential, 
              or punitive damages resulting from your use of or inability to use the service.
            </p>
          </section>

          <p className="text-sm text-muted-foreground mt-8">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </main>
    </div>
  );
};

export default Terms;
