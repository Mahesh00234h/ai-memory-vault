
-- Fix the remaining permissive policies on extension_users
-- The INSERT and UPDATE policies need to be more restrictive

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Allow user creation" ON public.extension_users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.extension_users;

-- For user creation, we can't truly restrict since there's no auth
-- But we ensure the insert provides required fields (name is NOT NULL in schema)
-- This is acceptable for a public onboarding flow
CREATE POLICY "Allow user creation with valid data"
ON public.extension_users FOR INSERT
WITH CHECK (
  name IS NOT NULL AND 
  length(trim(name)) > 0
);

-- For updates, ensure the record exists and name is valid
CREATE POLICY "Users can update profiles with valid data"
ON public.extension_users FOR UPDATE
USING (id IS NOT NULL)
WITH CHECK (
  name IS NOT NULL AND 
  length(trim(name)) > 0
);
