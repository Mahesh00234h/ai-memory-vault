import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MergeRequest = {
  teamId: string;
  sinceDays?: number;
};

type MemoryRow = {
  id: string;
  title: string;
  topic: string | null;
  summary: string | null;
  key_points: unknown;
  decisions: unknown;
  open_questions: unknown;
  user_id: string;
  created_at: string;
  source_platform: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

// Lovable AI Gateway
const AI_GATEWAY_URL = "https://ai-gateway.lovable.dev/v1/chat/completions";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function ensureArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  return [];
}

// Group memories by topic similarity using simple keyword overlap
function clusterMemoriesByTopic(memories: MemoryRow[]): Map<string, MemoryRow[]> {
  const clusters = new Map<string, MemoryRow[]>();
  
  for (const mem of memories) {
    const topic = mem.topic?.toLowerCase().trim() || "general";
    if (!clusters.has(topic)) {
      clusters.set(topic, []);
    }
    clusters.get(topic)!.push(mem);
  }
  
  return clusters;
}

// Build merge prompt for AI
function buildMergePrompt(
  memories: MemoryRow[],
  profiles: Map<string, string>,
  topic: string
): string {
  const memoryBlocks = memories.map((m) => {
    const memberName = profiles.get(m.user_id) || "Unknown";
    const keyPoints = ensureArray(m.key_points);
    const decisions = ensureArray(m.decisions);
    const openQuestions = ensureArray(m.open_questions);
    
    return `
### Memory from ${memberName} (${new Date(m.created_at).toLocaleDateString()})
**Title:** ${m.title}
${m.summary ? `**Summary:** ${m.summary}` : ""}
${keyPoints.length ? `**Key Points:**\n${keyPoints.map(p => `- ${p}`).join("\n")}` : ""}
${decisions.length ? `**Decisions:**\n${decisions.map(d => `- [${memberName}] ${d}`).join("\n")}` : ""}
${openQuestions.length ? `**Open Questions:**\n${openQuestions.map(q => `- ${q}`).join("\n")}` : ""}
`;
  }).join("\n---\n");

  return `You are a Team Knowledge Synthesizer. Merge these ${memories.length} memories from different team members into ONE unified team knowledge summary for the topic: "${topic}".

RULES:
1. Preserve ALL decisions with attribution: "[MemberName] decided X"
2. Merge overlapping key points into concise bullets
3. Consolidate open questions, removing duplicates
4. Keep conflicting perspectives visible with attribution
5. Create a unified summary that captures the team's collective understanding

TEAM MEMORIES TO MERGE:
${memoryBlocks}

OUTPUT FORMAT (JSON):
{
  "title": "Unified summary title for this topic cluster",
  "summary": "4-8 sentence synthesis of all perspectives",
  "key_points": ["merged key points, max 10"],
  "decisions": ["[MemberName] decided X", "each with attribution"],
  "open_questions": ["consolidated questions, max 8"],
  "tech_stack": ["any technologies mentioned"],
  "member_contributions": {
    "member_id": {
      "name": "Display Name",
      "memory_count": 2,
      "key_decisions": ["their key decisions"]
    }
  }
}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // This function can be called by cron (no auth) or by authenticated user
    const authHeader = req.headers.get("Authorization") ?? "";
    
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Backend keys are not configured");
    }
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Use service role for cron jobs, or user auth for manual triggers
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = (await req.json()) as MergeRequest;
    
    // Validate teamId
    if (!body.teamId || !isValidUuid(body.teamId)) {
      return new Response(JSON.stringify({ error: "Invalid teamId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sinceDays = Math.min(Math.max(body.sinceDays ?? 7, 1), 90);
    const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

    // Fetch team memories
    const { data: memories, error: memErr } = await supabase
      .from("memories")
      .select("id, title, topic, summary, key_points, decisions, open_questions, user_id, created_at, source_platform")
      .eq("team_id", body.teamId)
      .gte("created_at", sinceDate)
      .order("created_at", { ascending: false })
      .limit(100);

    if (memErr) {
      return new Response(JSON.stringify({ error: memErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!memories || memories.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No memories to merge", merged: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user profiles for attribution
    const userIds = [...new Set(memories.map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    const profileMap = new Map<string, string>();
    (profiles || []).forEach((p: ProfileRow) => {
      profileMap.set(p.id, p.display_name || "Team Member");
    });

    // Cluster memories by topic
    const clusters = clusterMemoriesByTopic(memories as MemoryRow[]);
    const results: Array<{ topic: string; merged: boolean; error?: string }> = [];

    // Process each cluster
    for (const [topic, clusterMemories] of clusters) {
      if (clusterMemories.length < 1) continue;

      try {
        const prompt = buildMergePrompt(clusterMemories, profileMap, topic);

        // Call AI for semantic merge
        const aiResponse = await fetch(AI_GATEWAY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "You are a precise JSON generator. Output only valid JSON." },
              { role: "user", content: prompt },
            ],
            max_tokens: 2000,
            temperature: 0.3,
          }),
        });

        if (!aiResponse.ok) {
          throw new Error(`AI request failed: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || "";

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON in AI response");
        }

        const merged = JSON.parse(jsonMatch[0]);
        const memoryIds = clusterMemories.map((m) => m.id);

        // Upsert team summary
        const { error: upsertErr } = await supabase
          .from("team_summaries")
          .upsert(
            {
              team_id: body.teamId,
              topic_cluster: topic,
              title: merged.title || `Team Knowledge: ${topic}`,
              summary: merged.summary || "",
              key_points: merged.key_points || [],
              decisions: merged.decisions || [],
              open_questions: merged.open_questions || [],
              tech_stack: merged.tech_stack || [],
              memory_ids: memoryIds,
              member_attributions: merged.member_contributions || {},
              last_merge_at: new Date().toISOString(),
              merge_version: 1,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "team_id,topic_cluster" }
          );

        if (upsertErr) {
          throw new Error(upsertErr.message);
        }

        results.push({ topic, merged: true });
      } catch (e) {
        console.error(`Error merging topic ${topic}:`, e);
        results.push({ topic, merged: false, error: e instanceof Error ? e.message : "Unknown error" });
      }
    }

    const mergedCount = results.filter((r) => r.merged).length;

    return new Response(
      JSON.stringify({
        success: true,
        teamId: body.teamId,
        memoriesProcessed: memories.length,
        topicsClustered: clusters.size,
        merged: mergedCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("merge-team-context error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
