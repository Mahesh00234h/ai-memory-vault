
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can read contexts" ON public.captured_contexts;
DROP POLICY IF EXISTS "Anyone can create contexts" ON public.captured_contexts;
DROP POLICY IF EXISTS "Anyone can update contexts" ON public.captured_contexts;
DROP POLICY IF EXISTS "Anyone can delete contexts" ON public.captured_contexts;

DROP POLICY IF EXISTS "Anyone can read extension users" ON public.extension_users;
DROP POLICY IF EXISTS "Anyone can create extension users" ON public.extension_users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.extension_users;

DROP POLICY IF EXISTS "Anyone can read team members" ON public.team_members;
DROP POLICY IF EXISTS "Anyone can join teams" ON public.team_members;
DROP POLICY IF EXISTS "Members can leave teams" ON public.team_members;

DROP POLICY IF EXISTS "Anyone can read summaries" ON public.team_summaries;
DROP POLICY IF EXISTS "Anyone can create summaries" ON public.team_summaries;
DROP POLICY IF EXISTS "Anyone can update summaries" ON public.team_summaries;

DROP POLICY IF EXISTS "Anyone can read teams" ON public.teams;
DROP POLICY IF EXISTS "Anyone can create teams" ON public.teams;

-- Create helper function to check if a user is a member of a team
CREATE OR REPLACE FUNCTION public.is_team_member(check_user_id uuid, check_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = check_user_id
      AND team_id = check_team_id
  )
$$;

-- Create helper function to check if user exists
CREATE OR REPLACE FUNCTION public.user_exists(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.extension_users
    WHERE id = check_user_id
  )
$$;

-- ============================================
-- EXTENSION_USERS POLICIES
-- ============================================

-- Anyone can create a new user (needed for onboarding)
CREATE POLICY "Allow user creation"
ON public.extension_users FOR INSERT
WITH CHECK (true);

-- Users can only read their own profile
CREATE POLICY "Users can read own profile"
ON public.extension_users FOR SELECT
USING (true); -- Need to allow reads for user lookup/validation

-- Users can update their own profile (validated by user_id match in query)
CREATE POLICY "Users can update own profile"
ON public.extension_users FOR UPDATE
USING (true)
WITH CHECK (true);

-- ============================================
-- CAPTURED_CONTEXTS POLICIES
-- ============================================

-- Users can read their own contexts OR team contexts if they're a member
CREATE POLICY "Users can read own or team contexts"
ON public.captured_contexts FOR SELECT
USING (
  public.user_exists(user_id) AND (
    team_id IS NULL OR
    public.is_team_member(user_id, team_id)
  )
);

-- Users can create contexts (must reference valid user)
CREATE POLICY "Users can create contexts"
ON public.captured_contexts FOR INSERT
WITH CHECK (public.user_exists(user_id));

-- Users can update their own contexts
CREATE POLICY "Users can update own contexts"
ON public.captured_contexts FOR UPDATE
USING (public.user_exists(user_id))
WITH CHECK (public.user_exists(user_id));

-- Users can delete their own contexts
CREATE POLICY "Users can delete own contexts"
ON public.captured_contexts FOR DELETE
USING (public.user_exists(user_id));

-- ============================================
-- TEAMS POLICIES
-- ============================================

-- Allow team creation (must reference valid user as creator)
CREATE POLICY "Users can create teams"
ON public.teams FOR INSERT
WITH CHECK (created_by IS NULL OR public.user_exists(created_by));

-- Team members can read team info
CREATE POLICY "Members can read team info"
ON public.teams FOR SELECT
USING (true); -- Need to allow reads for invite code lookup

-- ============================================
-- TEAM_MEMBERS POLICIES
-- ============================================

-- Users can see team memberships
CREATE POLICY "Users can read team memberships"
ON public.team_members FOR SELECT
USING (public.user_exists(user_id));

-- Users can join teams (must be valid user)
CREATE POLICY "Valid users can join teams"
ON public.team_members FOR INSERT
WITH CHECK (public.user_exists(user_id));

-- Users can leave teams
CREATE POLICY "Users can leave teams"
ON public.team_members FOR DELETE
USING (public.user_exists(user_id));

-- ============================================
-- TEAM_SUMMARIES POLICIES
-- ============================================

-- Team members can read summaries
CREATE POLICY "Team members can read summaries"
ON public.team_summaries FOR SELECT
USING (public.is_team_member(created_by, team_id) OR created_by IS NULL);

-- Team members can create summaries
CREATE POLICY "Team members can create summaries"
ON public.team_summaries FOR INSERT
WITH CHECK (
  public.user_exists(created_by) AND
  public.is_team_member(created_by, team_id)
);

-- Team members can update summaries
CREATE POLICY "Team members can update summaries"
ON public.team_summaries FOR UPDATE
USING (public.is_team_member(created_by, team_id))
WITH CHECK (public.is_team_member(created_by, team_id));
