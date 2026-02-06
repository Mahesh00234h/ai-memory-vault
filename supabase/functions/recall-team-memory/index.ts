import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RecallRequest = {
  teamId: string;
  query?: string;
  limit?: number;
};

type TeamSummary = {
  id: string;
  title: string;
  topic_cluster: string | null;
  summary: string;
  key_points: unknown;
  decisions: unknown;
  open_questions: unknown;
  tech_stack: unknown;
  member_attributions: unknown;
  memory_ids: unknown;
  last_merge_at: string;
  merge_version: number;
  created_at: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function ensureArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  return [];
}

function buildTeamPromptBlock(
  summaries: TeamSummary[],
  query: string
): { json: object; markdown: string } {
  const contextPack = {
    schema: "team_context_v1",
    generatedAt: new Date().toISOString(),
    query,
    topicCount: summaries.length,
    instructions: [
      "This is your TEAM's unified knowledge base - decisions from multiple members.",
      "Decisions include attribution [MemberName] - respect all perspectives.",
      "Use this as authoritative context; don't re-explain what's already decided.",
      "Prioritize open questions and unresolved items for next steps.",
    ],
    topics: summaries.map((s) => ({
      id: s.id,
      title: s.title,
      topic: s.topic_cluster,
      lastMerged: s.last_merge_at,
      memoryCount: ensureArray(s.memory_ids).length,
      summary: s.summary,
      key_points: ensureArray(s.key_points),
      decisions: ensureArray(s.decisions),
      open_questions: ensureArray(s.open_questions),
      tech_stack: ensureArray(s.tech_stack),
      contributors: s.member_attributions,
    })),
  };

  // Build Markdown version
  const mdLines: string[] = [
    "# Team Knowledge Base",
    "",
    `> ${summaries.length} topic clusters merged from team memories`,
    "",
  ];

  for (const s of summaries) {
    mdLines.push(`## ${s.title}`);
    if (s.topic_cluster) mdLines.push(`**Topic:** ${s.topic_cluster}`);
    mdLines.push(`**Last Merged:** ${new Date(s.last_merge_at).toLocaleDateString()}`);
    mdLines.push("");
    
    if (s.summary) {
      mdLines.push(s.summary);
      mdLines.push("");
    }

    const keyPoints = ensureArray(s.key_points);
    if (keyPoints.length) {
      mdLines.push("**Key Points:**");
      keyPoints.forEach((p) => mdLines.push(`- ${p}`));
      mdLines.push("");
    }

    const decisions = ensureArray(s.decisions);
    if (decisions.length) {
      mdLines.push("**Team Decisions:**");
      decisions.forEach((d) => mdLines.push(`- ${d}`));
      mdLines.push("");
    }

    const questions = ensureArray(s.open_questions);
    if (questions.length) {
      mdLines.push("**Open Questions:**");
      questions.forEach((q) => mdLines.push(`- ${q}`));
      mdLines.push("");
    }

    const techStack = ensureArray(s.tech_stack);
    if (techStack.length) {
      mdLines.push(`**Tech Stack:** ${techStack.join(", ")}`);
      mdLines.push("");
    }

    mdLines.push("---");
    mdLines.push("");
  }

  mdLines.push("## Recommended Next Steps");
  mdLines.push("- Review open questions above and prioritize");
  mdLines.push("- Check for any conflicting decisions that need resolution");
  mdLines.push("- Continue from the team's current status");

  return {
    json: contextPack,
    markdown: mdLines.join("\n"),
  };
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

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Backend keys are not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RecallRequest;

    // Validate teamId
    if (!body.teamId || !isValidUuid(body.teamId)) {
      return new Response(JSON.stringify({ error: "Invalid teamId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const query = typeof body.query === "string" ? body.query.trim().slice(0, 500) : "";
    const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);

    // Verify user is a team member (via having memories in that team)
    const { data: memberCheck } = await supabase
      .from("memories")
      .select("id")
      .eq("team_id", body.teamId)
      .eq("user_id", userData.user.id)
      .limit(1);

    if (!memberCheck || memberCheck.length === 0) {
      return new Response(JSON.stringify({ error: "Not a member of this team" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch team summaries
    let dbQuery = supabase
      .from("team_summaries")
      .select("*")
      .eq("team_id", body.teamId)
      .order("last_merge_at", { ascending: false })
      .limit(limit);

    const { data: summaries, error: queryErr } = await dbQuery;

    if (queryErr) {
      return new Response(JSON.stringify({ error: queryErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let results: TeamSummary[] = summaries || [];

    // If there's a search query, filter by keyword matching
    if (query) {
      const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
      
      results = results
        .map((s) => {
          const searchableText = [
            s.title || "",
            s.topic_cluster || "",
            s.summary || "",
            ...ensureArray(s.key_points),
            ...ensureArray(s.decisions),
            ...ensureArray(s.open_questions),
          ].join(" ").toLowerCase();

          let score = 0;
          for (const kw of keywords) {
            if (searchableText.includes(kw)) {
              score += 1;
              if ((s.title || "").toLowerCase().includes(kw)) score += 2;
              if ((s.topic_cluster || "").toLowerCase().includes(kw)) score += 1;
            }
          }

          return { ...s, relevance_score: score };
        })
        .filter((s) => (s as TeamSummary & { relevance_score: number }).relevance_score > 0)
        .sort((a, b) => 
          ((b as TeamSummary & { relevance_score: number }).relevance_score || 0) - 
          ((a as TeamSummary & { relevance_score: number }).relevance_score || 0)
        )
        .slice(0, limit);
    }

    // Build hybrid prompt block
    const { json, markdown } = buildTeamPromptBlock(results, query);

    const promptBlock = [
      "# Team Context Pack (Hybrid)",
      "",
      "## JSON (for tools/agents)",
      "```json",
      JSON.stringify(json, null, 2),
      "```",
      "",
      "## Markdown (for direct injection)",
      "",
      markdown,
    ].join("\n");

    return new Response(
      JSON.stringify({
        success: true,
        teamId: body.teamId,
        count: results.length,
        summaries: results,
        promptBlock,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("recall-team-memory error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
