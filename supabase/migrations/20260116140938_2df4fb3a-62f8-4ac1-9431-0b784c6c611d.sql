-- Fix portfolio_recommendations RLS policies
-- Drop existing restrictive policies and recreate as permissive with auth checks

DROP POLICY IF EXISTS "Users can view their own recommendations" ON public.portfolio_recommendations;
DROP POLICY IF EXISTS "Users can insert their own recommendations" ON public.portfolio_recommendations;

CREATE POLICY "Users can view their own recommendations" 
ON public.portfolio_recommendations 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recommendations" 
ON public.portfolio_recommendations 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix profiles RLS policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);