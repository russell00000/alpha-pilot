
CREATE POLICY "Users can delete their own trades"
  ON public.practice_trades FOR DELETE
  USING (auth.uid() = user_id);
