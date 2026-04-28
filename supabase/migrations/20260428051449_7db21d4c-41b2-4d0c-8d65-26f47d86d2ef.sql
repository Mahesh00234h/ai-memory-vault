
-- ============================================================
-- Helper: resolve the extension_users.id linked to the current auth user
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_extension_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.extension_users
  WHERE migrated_to_auth_id = auth.uid()
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.current_extension_user_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_extension_user_id() TO authenticated;

-- ============================================================
-- Harden existing SECURITY DEFINER helpers: require auth
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_team_member(check_user_id uuid, check_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE user_id = check_user_id AND team_id = check_team_id
    )
$$;

CREATE OR REPLACE FUNCTION public.user_exists(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.extension_users WHERE id = check_user_id
    )
$$;

REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_exists(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.user_exists(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_team_member_via_memories(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_team_member_via_memories(uuid, uuid) TO authenticated;

-- ============================================================
-- extension_users: lock to migrated auth user
-- ============================================================
DROP POLICY IF EXISTS "Users can read own profile" ON public.extension_users;
DROP POLICY IF EXISTS "Allow user creation with valid data" ON public.extension_users;
DROP POLICY IF EXISTS "Users can update profiles with valid data" ON public.extension_users;

CREATE POLICY "Auth users read own extension profile"
ON public.extension_users
FOR SELECT
TO authenticated
USING (migrated_to_auth_id = auth.uid());

CREATE POLICY "Auth users create own extension profile"
ON public.extension_users
FOR INSERT
TO authenticated
WITH CHECK (
  migrated_to_auth_id = auth.uid()
  AND name IS NOT NULL
  AND length(trim(name)) > 0
);

CREATE POLICY "Auth users update own extension profile"
ON public.extension_users
FOR UPDATE
TO authenticated
USING (migrated_to_auth_id = auth.uid())
WITH CHECK (
  migrated_to_auth_id = auth.uid()
  AND name IS NOT NULL
  AND length(trim(name)) > 0
);

-- ============================================================
-- captured_contexts: scope to authenticated owner / team members
-- ============================================================
DROP POLICY IF EXISTS "Users can read own or team contexts" ON public.captured_contexts;
DROP POLICY IF EXISTS "Users can create contexts" ON public.captured_contexts;
DROP POLICY IF EXISTS "Users can update own contexts" ON public.captured_contexts;
DROP POLICY IF EXISTS "Users can delete own contexts" ON public.captured_contexts;

CREATE POLICY "Auth users read own or team contexts"
ON public.captured_contexts
FOR SELECT
TO authenticated
USING (
  user_id = public.current_extension_user_id()
  OR (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = captured_contexts.team_id
        AND tm.user_id = public.current_extension_user_id()
    )
  )
);

CREATE POLICY "Auth users create own contexts"
ON public.captured_contexts
FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_extension_user_id());

CREATE POLICY "Auth users update own contexts"
ON public.captured_contexts
FOR UPDATE
TO authenticated
USING (user_id = public.current_extension_user_id())
WITH CHECK (user_id = public.current_extension_user_id());

CREATE POLICY "Auth users delete own contexts"
ON public.captured_contexts
FOR DELETE
TO authenticated
USING (user_id = public.current_extension_user_id());

-- ============================================================
-- teams: members see invite codes; creators can delete; auth required to insert
-- ============================================================
DROP POLICY IF EXISTS "Users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Members can read team info" ON public.teams;

CREATE POLICY "Auth users create teams as themselves"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (created_by = public.current_extension_user_id());

CREATE POLICY "Members read their team info"
ON public.teams
FOR SELECT
TO authenticated
USING (
  created_by = public.current_extension_user_id()
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = teams.id
      AND tm.user_id = public.current_extension_user_id()
  )
);

CREATE POLICY "Creators delete own teams"
ON public.teams
FOR DELETE
TO authenticated
USING (created_by = public.current_extension_user_id());

-- ============================================================
-- team_members: only manage own membership; only see fellow members
-- ============================================================
DROP POLICY IF EXISTS "Users can read team memberships" ON public.team_members;
DROP POLICY IF EXISTS "Valid users can join teams" ON public.team_members;
DROP POLICY IF EXISTS "Users can leave teams" ON public.team_members;

CREATE POLICY "Members read fellow memberships"
ON public.team_members
FOR SELECT
TO authenticated
USING (
  user_id = public.current_extension_user_id()
  OR EXISTS (
    SELECT 1 FROM public.team_members self
    WHERE self.team_id = team_members.team_id
      AND self.user_id = public.current_extension_user_id()
  )
);

CREATE POLICY "Auth users join as themselves"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = public.current_extension_user_id());

CREATE POLICY "Auth users leave own membership"
ON public.team_members
FOR DELETE
TO authenticated
USING (user_id = public.current_extension_user_id());

-- ============================================================
-- team_summaries: tighten read access
-- ============================================================
DROP POLICY IF EXISTS "Team members can read team summaries" ON public.team_summaries;
DROP POLICY IF EXISTS "Auth users can read team summaries" ON public.team_summaries;
DROP POLICY IF EXISTS "Team members can create summaries" ON public.team_summaries;
DROP POLICY IF EXISTS "Team members can update summaries" ON public.team_summaries;

CREATE POLICY "Auth team members read summaries"
ON public.team_summaries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.memories m
    WHERE m.team_id = team_summaries.team_id
      AND m.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_summaries.team_id
      AND tm.user_id = public.current_extension_user_id()
  )
);

CREATE POLICY "Auth team members create summaries"
ON public.team_summaries
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = public.current_extension_user_id()
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_summaries.team_id
      AND tm.user_id = public.current_extension_user_id()
  )
);

CREATE POLICY "Auth team members update summaries"
ON public.team_summaries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_summaries.team_id
      AND tm.user_id = public.current_extension_user_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = team_summaries.team_id
      AND tm.user_id = public.current_extension_user_id()
  )
);
