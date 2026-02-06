import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { RealtimeChannel } from "@supabase/supabase-js";

type TeamSummaryPayload = {
  id: string;
  team_id: string;
  title: string;
  topic_cluster: string | null;
  last_merge_at: string;
  merge_version: number;
};

type UseTeamRealtimeOptions = {
  teamIds: string[];
  onSummaryUpdate?: (payload: TeamSummaryPayload) => void;
  showToast?: boolean;
};

export function useTeamRealtime({
  teamIds,
  onSummaryUpdate,
  showToast = true,
}: UseTeamRealtimeOptions) {
  const { toast } = useToast();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const handleSummaryChange = useCallback(
    (payload: { new: TeamSummaryPayload; old: TeamSummaryPayload | null; eventType: string }) => {
      const summary = payload.new;
      
      if (showToast) {
        const action = payload.eventType === "INSERT" ? "created" : "updated";
        toast({
          title: `Team Knowledge ${action}`,
          description: `"${summary.title}" has been ${action}`,
          duration: 5000,
        });
      }

      onSummaryUpdate?.(summary);
    },
    [toast, showToast, onSummaryUpdate]
  );

  useEffect(() => {
    if (!teamIds.length) return;

    // Create a single channel for all team subscriptions
    const channel = supabase
      .channel("team-summaries-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "team_summaries",
          filter: `team_id=in.(${teamIds.join(",")})`,
        },
        (payload) => handleSummaryChange({ ...payload, eventType: "INSERT" } as any)
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "team_summaries",
          filter: `team_id=in.(${teamIds.join(",")})`,
        },
        (payload) => handleSummaryChange({ ...payload, eventType: "UPDATE" } as any)
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [teamIds, handleSummaryChange]);

  return {
    unsubscribe: () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    },
  };
}
