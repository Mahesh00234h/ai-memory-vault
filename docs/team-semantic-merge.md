# Team Semantic Merge - Cron Setup

The team semantic merge runs periodically to consolidate all team members' memories into a unified knowledge base.

## How to set up the cron job

Run this SQL in your Supabase SQL Editor (or via the insert tool) to create a cron job that triggers the merge for all active teams every 6 hours:

```sql
-- Create a function to trigger merge for all teams
CREATE OR REPLACE FUNCTION public.trigger_team_merges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_record RECORD;
  supabase_url TEXT := 'https://meqqbjhfmrpsiqsexcif.supabase.co';
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lcXFiamhmbXJwc2lxc2V4Y2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDkzNzUsImV4cCI6MjA4Mzk4NTM3NX0.pqoNxaO0CtEFpGSYOZ3JZk7S3B1EOEYuh9mymP1mDqI';
BEGIN
  -- Loop through all teams with recent activity
  FOR team_record IN 
    SELECT DISTINCT t.id as team_id
    FROM teams t
    INNER JOIN memories m ON m.team_id = t.id
    WHERE m.created_at > NOW() - INTERVAL '7 days'
  LOOP
    -- Call the merge function for each team
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/merge-team-context',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object('teamId', team_record.team_id, 'sinceDays', 7)
    );
  END LOOP;
END;
$$;

-- Schedule the cron job to run every 6 hours
SELECT cron.schedule(
  'merge-team-contexts',
  '0 */6 * * *',  -- Every 6 hours
  $$SELECT public.trigger_team_merges()$$
);
```

## Manual trigger

You can also trigger a merge manually by calling the edge function:

```bash
curl -X POST \
  'https://meqqbjhfmrpsiqsexcif.supabase.co/functions/v1/merge-team-context' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -d '{"teamId": "your-team-uuid", "sinceDays": 7}'
```

## Recall team context

To get the unified team knowledge:

```bash
curl -X POST \
  'https://meqqbjhfmrpsiqsexcif.supabase.co/functions/v1/recall-team-memory' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -d '{"teamId": "your-team-uuid", "query": "optional search query"}'
```

The response includes:
- `summaries`: Array of merged topic clusters
- `promptBlock`: Hybrid JSON + Markdown ready for AI injection
