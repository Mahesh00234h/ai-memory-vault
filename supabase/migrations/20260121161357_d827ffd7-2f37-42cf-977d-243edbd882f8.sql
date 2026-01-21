-- Add migration tracking column to extension_users
ALTER TABLE public.extension_users 
ADD COLUMN IF NOT EXISTS migrated_to_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for faster lookups during migration
CREATE INDEX IF NOT EXISTS idx_extension_users_migrated_to_auth_id 
ON public.extension_users(migrated_to_auth_id) 
WHERE migrated_to_auth_id IS NOT NULL;

-- Add legacy_user_id column to captured_contexts for tracking migration source
ALTER TABLE public.captured_contexts 
ADD COLUMN IF NOT EXISTS legacy_user_id uuid;

-- Add index for migration queries
CREATE INDEX IF NOT EXISTS idx_captured_contexts_legacy_user_id 
ON public.captured_contexts(legacy_user_id) 
WHERE legacy_user_id IS NOT NULL;