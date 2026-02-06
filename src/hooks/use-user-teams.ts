import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type UserTeam = {
  id: string;
  name: string;
};

export function useUserTeams() {
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchTeams() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          setTeams([]);
          setLoading(false);
          return;
        }

        // Get teams where user has memories (indicating team membership)
        const { data: memories, error: memErr } = await supabase
          .from("memories")
          .select("team_id")
          .eq("user_id", session.user.id)
          .not("team_id", "is", null);

        if (memErr) throw memErr;

        const teamIds = [...new Set(memories?.map((m) => m.team_id).filter(Boolean) || [])];

        if (teamIds.length === 0) {
          setTeams([]);
          setLoading(false);
          return;
        }

        // Fetch team details
        const { data: teamsData, error: teamErr } = await supabase
          .from("teams")
          .select("id, name")
          .in("id", teamIds);

        if (teamErr) throw teamErr;

        setTeams(teamsData || []);
      } catch (e) {
        setError(e instanceof Error ? e : new Error("Failed to fetch teams"));
      } finally {
        setLoading(false);
      }
    }

    fetchTeams();
  }, []);

  return { teams, loading, error, teamIds: teams.map((t) => t.id) };
}
