-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  date_of_birth DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

-- Create investment assessments table
CREATE TABLE public.investment_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date_of_birth DATE NOT NULL,
  investment_amount DECIMAL(12, 2) NOT NULL,
  recurring_investment BOOLEAN NOT NULL DEFAULT false,
  recurring_amount DECIMAL(12, 2),
  recurring_frequency TEXT,
  risk_tolerance TEXT NOT NULL CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive', 'very_aggressive')),
  investment_goal TEXT NOT NULL CHECK (investment_goal IN ('retirement', 'wealth_building', 'income', 'short_term', 'education', 'emergency_fund')),
  investment_timeline TEXT NOT NULL CHECK (investment_timeline IN ('less_than_1_year', '1_to_3_years', '3_to_5_years', '5_to_10_years', 'more_than_10_years')),
  investment_experience TEXT NOT NULL CHECK (investment_experience IN ('none', 'beginner', 'intermediate', 'advanced')),
  income_stability TEXT NOT NULL CHECK (income_stability IN ('very_stable', 'stable', 'somewhat_unstable', 'unstable')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.investment_assessments ENABLE ROW LEVEL SECURITY;

-- Assessment policies
CREATE POLICY "Users can view their own assessments" 
ON public.investment_assessments FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assessments" 
ON public.investment_assessments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assessments" 
ON public.investment_assessments FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assessments" 
ON public.investment_assessments FOR DELETE 
USING (auth.uid() = user_id);

-- Create portfolio recommendations table
CREATE TABLE public.portfolio_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.investment_assessments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allocation_stocks DECIMAL(5, 2) NOT NULL,
  allocation_bonds DECIMAL(5, 2) NOT NULL,
  allocation_etfs DECIMAL(5, 2) NOT NULL,
  allocation_cash DECIMAL(5, 2) NOT NULL,
  allocation_alternatives DECIMAL(5, 2) NOT NULL DEFAULT 0,
  recommended_funds JSONB NOT NULL,
  rationale TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portfolio_recommendations ENABLE ROW LEVEL SECURITY;

-- Recommendations policies
CREATE POLICY "Users can view their own recommendations" 
ON public.portfolio_recommendations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recommendations" 
ON public.portfolio_recommendations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at
BEFORE UPDATE ON public.investment_assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();