import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RecallRequest = {
  query?: string;
  projectId?: string | null;
  limit?: number;
  recencyDays?: number;
};

// Input validation constants
const MAX_QUERY_LENGTH = 500;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

type MemoryBlock = {
  id: string;
  title: string;
  topic: string | null;
  summary: string | null;
  key_points: string[];
  decisions: string[];
  open_questions: string[];
  source_platform: string | null;
  source_url: string | null;
  created_at: string;
  relevance_score?: number;
};

function formatMemoryForPrompt(memory: MemoryBlock): string {
  const lines: string[] = [];
  
  lines.push(`## ${memory.title}`);
  if (memory.topic) lines.push(`**Topic:** ${memory.topic}`);
  if (memory.source_platform) lines.push(`**Source:** ${memory.source_platform}`);
  lines.push(`**Date:** ${new Date(memory.created_at).toLocaleDateString()}`);
  
  if (memory.summary) {
    lines.push("");
    lines.push(memory.summary);
  }
  
  if (memory.key_points?.length) {
    lines.push("");
    lines.push("**Key Points:**");
    memory.key_points.forEach((p) => lines.push(`- ${p}`));
  }
  
  if (memory.decisions?.length) {
    lines.push("");
    lines.push("**Decisions:**");
    memory.decisions.forEach((d) => lines.push(`- ${d}`));
  }
  
  if (memory.open_questions?.length) {
    lines.push("");
    lines.push("**Open Questions:**");
    memory.open_questions.forEach((q) => lines.push(`- ${q}`));
  }
  
  return lines.join("\n");
}

function buildPromptBlock(memories: MemoryBlock[]): string {
  if (!memories.length) {
    return "No relevant memories found.";
  }

  const header = `# Project Context (${memories.length} memories)\n\n`;
  const blocks = memories.map(formatMemoryForPrompt).join("\n\n---\n\n");
  
  return header + blocks;
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
    
    // Input validation
    const query = typeof body.query === "string" ? body.query.trim().slice(0, MAX_QUERY_LENGTH) : "";
    const limit = Math.min(Math.max(body.limit ?? 10, 1), 50);
    const recencyDays = Math.min(Math.max(body.recencyDays ?? 30, 1), 365);
    
    // Validate projectId format if provided
    let projectId: string | null = null;
    if (body.projectId !== undefined && body.projectId !== null) {
      if (!isValidUuid(body.projectId)) {
        return new Response(JSON.stringify({ error: "Invalid projectId format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Verify project ownership
      const { data: project, error: projectErr } = await supabase
        .from("projects")
        .select("id")
        .eq("id", body.projectId)
        .eq("user_id", userData.user.id)
        .maybeSingle();
      
      if (projectErr || !project) {
        return new Response(JSON.stringify({ error: "Project not found or access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      projectId = body.projectId;
    }

    // Build the query
    let dbQuery = supabase
      .from("memories")
      .select("id, title, topic, summary, key_points, decisions, open_questions, source_platform, source_url, created_at")
      .eq("user_id", userData.user.id)
      .gte("created_at", new Date(Date.now() - recencyDays * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filter by project if specified
    if (projectId) {
      dbQuery = dbQuery.eq("project_id", projectId);
    }

    const { data: memories, error: queryErr } = await dbQuery;

    if (queryErr) {
      return new Response(JSON.stringify({ error: queryErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let results: MemoryBlock[] = memories ?? [];

    // If there's a search query, filter and score results
    if (query) {
      const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
      
      results = results
        .map((mem) => {
          // Score based on keyword matches in title, topic, summary, key_points, decisions
          const searchableText = [
            mem.title ?? "",
            mem.topic ?? "",
            mem.summary ?? "",
            ...(mem.key_points ?? []),
            ...(mem.decisions ?? []),
            ...(mem.open_questions ?? []),
          ].join(" ").toLowerCase();

          let score = 0;
          for (const kw of keywords) {
            if (searchableText.includes(kw)) {
              score += 1;
              // Boost for title/topic matches
              if ((mem.title ?? "").toLowerCase().includes(kw)) score += 2;
              if ((mem.topic ?? "").toLowerCase().includes(kw)) score += 1;
            }
          }

          return { ...mem, relevance_score: score };
        })
        .filter((mem) => mem.relevance_score > 0)
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, limit);
    }

    // Format as prompt-ready block
    const promptBlock = buildPromptBlock(results);

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        memories: results,
        promptBlock,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("recall-memory error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
