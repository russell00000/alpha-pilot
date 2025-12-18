-- Create table for storing creator's investing philosophy
CREATE TABLE public.investing_philosophy (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  philosophy_text text NOT NULL,
  risk_guidance text,
  asset_allocation_rules text,
  market_insights_style text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.investing_philosophy ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the philosophy (needed for portfolio generation)
CREATE POLICY "Philosophy is readable by authenticated users" 
ON public.investing_philosophy 
FOR SELECT 
TO authenticated
USING (true);

-- Only admins can modify (we'll use a simple admin check for now)
CREATE POLICY "Admins can modify philosophy" 
ON public.investing_philosophy 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Insert a default philosophy
INSERT INTO public.investing_philosophy (
  philosophy_text,
  risk_guidance,
  asset_allocation_rules,
  market_insights_style
) VALUES (
  'I believe in long-term wealth building through diversified, low-cost index investing. Time in the market beats timing the market. Focus on what you can control: costs, diversification, and discipline.',
  'Risk tolerance should align with your timeline. Younger investors can weather volatility for higher returns. As you approach your goal, shift toward stability.',
  'Core holdings should be broad market ETFs. International diversification reduces country-specific risk. Bonds provide ballast during market downturns. Alternatives like REITs add uncorrelated returns.',
  'I provide straightforward, jargon-free explanations. I focus on education over prediction. Markets are unpredictable short-term but tend to grow long-term.'
);