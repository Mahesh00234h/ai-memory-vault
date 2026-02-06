-- Add unique constraint for team_id + topic_cluster to enable upsert
ALTER TABLE public.team_summaries 
DROP CONSTRAINT IF EXISTS team_summaries_team_topic_unique;

ALTER TABLE public.team_summaries 
ADD CONSTRAINT team_summaries_team_topic_unique UNIQUE (team_id, topic_cluster);

-- Allow service role to insert team summaries (for cron merge job)
DROP POLICY IF EXISTS "Service role can manage team summaries" ON public.team_summaries;
CREATE POLICY "Service role can manage team summaries"
ON public.team_summaries
FOR ALL
USING (true)
WITH CHECK (true);