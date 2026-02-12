
-- Practice portfolio account (virtual cash balance)
CREATE TABLE public.practice_portfolios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cash_balance NUMERIC NOT NULL DEFAULT 10000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.practice_portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own practice portfolio"
  ON public.practice_portfolios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own practice portfolio"
  ON public.practice_portfolios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own practice portfolio"
  ON public.practice_portfolios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_practice_portfolios_user ON public.practice_portfolios (user_id);

CREATE TRIGGER update_practice_portfolios_updated_at
  BEFORE UPDATE ON public.practice_portfolios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Practice holdings (current positions)
CREATE TABLE public.practice_holdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  avg_cost_basis NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.practice_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own holdings"
  ON public.practice_holdings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own holdings"
  ON public.practice_holdings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own holdings"
  ON public.practice_holdings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own holdings"
  ON public.practice_holdings FOR DELETE
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_practice_holdings_user_symbol ON public.practice_holdings (user_id, symbol);

CREATE TRIGGER update_practice_holdings_updated_at
  BEFORE UPDATE ON public.practice_holdings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Practice trades (transaction history)
CREATE TABLE public.practice_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  trade_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  price_per_share NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.practice_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trades"
  ON public.practice_trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades"
  ON public.practice_trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);
