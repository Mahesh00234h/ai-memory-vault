-- Create a security definer function to check team membership via memories
-- This avoids infinite recursion by bypassing RLS
CREATE OR REPLACE FUNCTION public.is_team_member_via_memories(check_user_id uuid, check_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memories
    WHERE user_id = check_user_id
      AND team_id = check_team_id
  )
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Team members can read team memories" ON public.memories;

-- Recreate the policy using the security definer function
CREATE POLICY "Team members can read team memories"
ON public.memories
FOR SELECT
USING (
  (auth.uid() = user_id) 
  OR (
    team_id IS NOT NULL 
    AND public.is_team_member_via_memories(auth.uid(), team_id)
  )
);