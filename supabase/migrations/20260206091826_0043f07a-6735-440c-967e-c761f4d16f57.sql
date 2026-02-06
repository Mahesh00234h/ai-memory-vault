-- Remove the permissive ALL policy - service role bypasses RLS automatically
DROP POLICY IF EXISTS "Service role can manage team summaries" ON public.team_summaries;