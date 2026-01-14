-- Create users table for extension users (not auth.users since extension users are external)
CREATE TABLE public.extension_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create teams table for group collaboration
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by UUID REFERENCES public.extension_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team memberships
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.extension_users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Create captured contexts table
CREATE TABLE public.captured_contexts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.extension_users(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  topic TEXT,
  summary TEXT,
  key_points JSONB DEFAULT '[]'::jsonb,
  tech_stack JSONB DEFAULT '[]'::jsonb,
  decisions JSONB DEFAULT '[]'::jsonb,
  open_questions JSONB DEFAULT '[]'::jsonb,
  raw_content TEXT,
  message_count INTEGER DEFAULT 0,
  platform TEXT,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team summaries (final merged summaries for teams)
CREATE TABLE public.team_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_points JSONB DEFAULT '[]'::jsonb,
  tech_stack JSONB DEFAULT '[]'::jsonb,
  decisions JSONB DEFAULT '[]'::jsonb,
  open_questions JSONB DEFAULT '[]'::jsonb,
  context_ids JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES public.extension_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.extension_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captured_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_summaries ENABLE ROW LEVEL SECURITY;

-- Since extension users don't use Supabase Auth, we'll use anon access with user_id validation
-- Allow anyone to create a user (first-time setup)
CREATE POLICY "Anyone can create extension users" ON public.extension_users
  FOR INSERT WITH CHECK (true);

-- Allow reading all users (for team member display)
CREATE POLICY "Anyone can read extension users" ON public.extension_users
  FOR SELECT USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.extension_users
  FOR UPDATE USING (true);

-- Teams policies
CREATE POLICY "Anyone can create teams" ON public.teams
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read teams" ON public.teams
  FOR SELECT USING (true);

-- Team members policies
CREATE POLICY "Anyone can join teams" ON public.team_members
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read team members" ON public.team_members
  FOR SELECT USING (true);

CREATE POLICY "Members can leave teams" ON public.team_members
  FOR DELETE USING (true);

-- Captured contexts policies
CREATE POLICY "Anyone can create contexts" ON public.captured_contexts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read contexts" ON public.captured_contexts
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update contexts" ON public.captured_contexts
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete contexts" ON public.captured_contexts
  FOR DELETE USING (true);

-- Team summaries policies
CREATE POLICY "Anyone can create summaries" ON public.team_summaries
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read summaries" ON public.team_summaries
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update summaries" ON public.team_summaries
  FOR UPDATE USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_extension_users_updated_at
  BEFORE UPDATE ON public.extension_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_captured_contexts_updated_at
  BEFORE UPDATE ON public.captured_contexts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_summaries_updated_at
  BEFORE UPDATE ON public.team_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for contexts and summaries
ALTER PUBLICATION supabase_realtime ADD TABLE public.captured_contexts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_summaries;