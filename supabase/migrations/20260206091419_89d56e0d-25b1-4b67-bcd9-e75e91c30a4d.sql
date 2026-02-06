-- Add team_id foreign key constraint to memories table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'memories_team_id_fkey' 
    AND table_name = 'memories'
  ) THEN
    ALTER TABLE public.memories 
    ADD CONSTRAINT memories_team_id_fkey 
    FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for team_id queries on memories
CREATE INDEX IF NOT EXISTS idx_memories_team_id ON public.memories(team_id) WHERE team_id IS NOT NULL;

-- Add new columns to team_summaries for semantic merge tracking
ALTER TABLE public.team_summaries 
ADD COLUMN IF NOT EXISTS memory_ids jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS member_attributions jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS topic_cluster text,
ADD COLUMN IF NOT EXISTS last_merge_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS merge_version integer DEFAULT 1;

-- Create index for topic clustering
CREATE INDEX IF NOT EXISTS idx_team_summaries_topic ON public.team_summaries(team_id, topic_cluster);

-- Update RLS policies for team_summaries to allow member reads
DROP POLICY IF EXISTS "Team members can read summaries" ON public.team_summaries;
CREATE POLICY "Team members can read team summaries"
ON public.team_summaries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_summaries.team_id
    AND tm.user_id IN (
      SELECT eu.id FROM public.extension_users eu 
      WHERE eu.migrated_to_auth_id = auth.uid()
    )
  )
  OR created_by IN (
    SELECT eu.id FROM public.extension_users eu 
    WHERE eu.migrated_to_auth_id = auth.uid()
  )
);

-- Allow authenticated users who are team members to read team summaries
DROP POLICY IF EXISTS "Auth users can read team summaries" ON public.team_summaries;
CREATE POLICY "Auth users can read team summaries"
ON public.team_summaries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.memories m
    WHERE m.team_id = team_summaries.team_id
    AND m.user_id = auth.uid()
  )
);

-- RLS for memories: allow team members to read team memories
DROP POLICY IF EXISTS "Team members can read team memories" ON public.memories;
CREATE POLICY "Team members can read team memories"
ON public.memories
FOR SELECT
USING (
  auth.uid() = user_id
  OR (
    team_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM public.memories m2
      WHERE m2.team_id = memories.team_id
      AND m2.user_id = auth.uid()
    )
  )
);