import Header from "@/components/Header";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Privacy = () => {
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

        <h1 className="text-3xl font-bold text-foreground mb-6">Privacy Policy</h1>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect information you provide directly to us, such as when you create an account, use our AI chat feature, 
              or contact us for support. This may include your name, email address, and any messages you send through our platform.
            </p>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">2. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Provide, maintain, and improve our services</li>
              <li>Personalize your experience with AI-powered insights</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Send you technical notices and support messages</li>
              <li>Monitor and analyze trends, usage, and activities</li>
            </ul>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">3. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate security measures to protect your personal information against unauthorized access, 
              alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">4. AI Chat Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              Messages sent through our AI chat feature are processed to provide you with personalized responses. 
              We do not share your chat history with third parties, except as necessary to provide the service 
              (e.g., AI model providers under strict data processing agreements).
            </p>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar technologies to collect information about your browsing activities. 
              You can control cookies through your browser settings.
            </p>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to access, correct, or delete your personal information. You may also request 
              a copy of your data or opt out of certain data processing activities.
            </p>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us through our support chat feature.
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

export default Privacy;
