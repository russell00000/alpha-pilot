import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Props = {
  onDemoMode: () => void;
  onLinked: () => void;
  isDemoMode: boolean;
};

const ConnectBrokerage = ({ onDemoMode, onLinked, isDemoMode }: Props) => {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { toast } = useToast();

  const handleConnect = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const { data, error } = await supabase.functions.invoke('plaid-link-token');
      if (error) {
        // Read the real reason from FunctionsHttpError context
        const anyErr = error as any;
        const details = typeof anyErr?.context?.text === 'function'
          ? await anyErr.context.text()
          : anyErr?.message;
        let msg = 'Brokerage linking is not available yet.';
        try {
          const parsed = JSON.parse(details);
          if (parsed?.error === 'plaid_not_configured') {
            msg = 'Plaid keys are not configured. Add PLAID_CLIENT_ID and PLAID_SECRET in Cloud secrets to enable live brokerage linking. In the meantime you can preview the analysis in Demo Mode below.';
          } else if (parsed?.message) {
            msg = parsed.message;
          }
        } catch { /* leave default */ }
        setNotice(msg);
        return;
      }
      // Plaid Link is not yet installed in the client; guide the user.
      setNotice('Plaid link_token generated. The Plaid Link JS drop-in is not installed yet in the client — the next step is to render Plaid Link with this token, then call plaid-exchange-token. Demo Mode is available now.');
      console.debug('plaid link_token response', data);
      onLinked();
    } catch (e: any) {
      toast({ title: 'Connection failed', description: e?.message ?? 'Unknown error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="luxe-glass rounded-3xl p-6 md:p-8">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg md:text-xl font-semibold">Connect your brokerage</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Link a brokerage account via Plaid to unlock live risk analysis, rebalancing plans, and AI-driven position recommendations. Read-only — we never move money.
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Bank-grade encryption</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI recommendations</span>
          </div>

          <div className="flex flex-wrap gap-3 mt-5">
            <Button onClick={handleConnect} disabled={loading} size="lg" className="rounded-full">
              {loading ? 'Preparing…' : 'Connect Brokerage'}
            </Button>
            <Button
              onClick={onDemoMode}
              variant="outline"
              size="lg"
              className="rounded-full"
            >
              {isDemoMode ? 'Demo Mode Active' : 'Preview with Demo Data'}
            </Button>
          </div>

          {notice && (
            <Alert className="mt-5 border-primary/30 bg-primary/5">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-sm leading-relaxed">{notice}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectBrokerage;