import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IngestRequest = {
  rawText: string;
  projectId?: string | null;
  teamId?: string | null;
  source?: {
    platform?: string | null;
    url?: string | null;
    threadKey?: string | null;
    pageTitle?: string | null;
    capturedAt?: string | null;
    messageCount?: number | null;
    contentHash?: string | null;
  };
};

// Input validation constants
const MAX_RAW_TEXT_LENGTH = 100000;
const MAX_PLATFORM_LENGTH = 50;
const MAX_URL_LENGTH = 2048;
const MAX_THREAD_KEY_LENGTH = 255;
const MAX_PAGE_TITLE_LENGTH = 200;
const MAX_CONTENT_HASH_LENGTH = 64;
const MAX_MESSAGE_COUNT = 10000;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

function clampArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .slice(0, max);
}

function cleanRawText(text: string): string {
  // Keep this conservative: remove obvious UI boilerplate + collapse whitespace.
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const uiNoise = [
    "type a message",
    "enter a prompt",
    "start a new chat",
    "how can i help",
  ];

  const filtered = lines.filter((l) => {
    const lower = l.toLowerCase();
    return !uiNoise.some((p) => lower.includes(p) && l.length < 120);
  });

  return filtered.join("\n").trim();
}

async function analyzeToMemoryJson(params: {
  rawText: string;
  platform?: string | null;
  url?: string | null;
  pageTitle?: string | null;
}) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const truncated = params.rawText.length > 30000
    ? params.rawText.slice(0, 30000) + "\n\n[Content truncated for analysis...]"
    : params.rawText;

  const systemPrompt =
    "You are a precise extraction engine. Return ONLY valid JSON. Produce detailed, AI-friendly project memory (high-signal, not generic).";

  const userPrompt = `Platform: ${params.platform || "Unknown"}
URL: ${params.url || "Unknown"}
Page Title: ${params.pageTitle || "Unknown"}

RAW INPUT:
${truncated}

Return a JSON object EXACTLY matching this schema:
{
  "title": "string (<= 80 chars, specific)",
  "topic": "string or null",
  "summary": "string (4-8 sentences, detailed and concrete: what was attempted, what worked, constraints, next step)",
  "key_points": ["string (dense, technical when relevant)"] ,
  "decisions": ["string (explicit decisions, chosen options, tradeoffs)"],
  "open_questions": ["string (actionable questions / unknowns)"]
}

Guidelines:
- Avoid generic filler. Prefer exact nouns/verbs from the conversation.
- If there are steps, include them in key_points.
- If there's code/architecture, mention components, flows, and edge cases.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1800,
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    if (resp.status === 429) throw new Error("Rate limit exceeded");
    if (resp.status === 402) throw new Error("Payment required");
    throw new Error(`AI gateway error (${resp.status}): ${body}`);
  }

  const result = await resp.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in AI response");

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse AI JSON");
    parsed = JSON.parse(match[0]);
  }

  const title = (typeof parsed.title === "string" && parsed.title.trim())
    ? parsed.title.trim().slice(0, 80)
    : "Untitled Memory";

  return {
    title,
    topic: typeof parsed.topic === "string" ? parsed.topic.trim() || null : null,
    summary: typeof parsed.summary === "string" ? parsed.summary.trim() || null : null,
    key_points: clampArray(parsed.key_points, 10),
    decisions: clampArray(parsed.decisions, 10),
    open_questions: clampArray(parsed.open_questions, 10),
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

    const body = (await req.json()) as IngestRequest;
    const rawText = typeof body.rawText === "string" ? body.rawText : "";
    
    // Input length validation
    if (!rawText || rawText.trim().length < 50) {
      return new Response(JSON.stringify({ error: "rawText too short (minimum 50 characters)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (rawText.length > MAX_RAW_TEXT_LENGTH) {
      return new Response(JSON.stringify({ error: `rawText too long (maximum ${MAX_RAW_TEXT_LENGTH} characters)` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate projectId format if provided
    if (body.projectId !== undefined && body.projectId !== null) {
      if (!isValidUuid(body.projectId)) {
        return new Response(JSON.stringify({ error: "Invalid projectId format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validate teamId format if provided
    if (body.teamId !== undefined && body.teamId !== null) {
      if (!isValidUuid(body.teamId)) {
        return new Response(JSON.stringify({ error: "Invalid teamId format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Validate and sanitize source fields
    const sanitizedSource = {
      platform: typeof body.source?.platform === "string" 
        ? body.source.platform.slice(0, MAX_PLATFORM_LENGTH) 
        : null,
      url: typeof body.source?.url === "string" 
        ? body.source.url.slice(0, MAX_URL_LENGTH) 
        : null,
      threadKey: typeof body.source?.threadKey === "string" 
        ? body.source.threadKey.slice(0, MAX_THREAD_KEY_LENGTH) 
        : null,
      pageTitle: typeof body.source?.pageTitle === "string" 
        ? body.source.pageTitle.slice(0, MAX_PAGE_TITLE_LENGTH) 
        : null,
      capturedAt: typeof body.source?.capturedAt === "string" 
        ? body.source.capturedAt 
        : null,
      messageCount: typeof body.source?.messageCount === "number" 
        ? Math.min(Math.max(0, Math.floor(body.source.messageCount)), MAX_MESSAGE_COUNT) 
        : 0,
      contentHash: typeof body.source?.contentHash === "string" 
        ? body.source.contentHash.slice(0, MAX_CONTENT_HASH_LENGTH) 
        : null,
    };

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

    // Validate project ownership if projectId is provided
    if (body.projectId) {
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
    }

    const cleaned = cleanRawText(rawText);
    if (cleaned.length < 50) {
      return new Response(JSON.stringify({ error: "Content too short after cleaning" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = await analyzeToMemoryJson({
      rawText: cleaned,
      platform: sanitizedSource.platform,
      url: sanitizedSource.url,
      pageTitle: sanitizedSource.pageTitle,
    });

    // Fetch user's display name for captured_by_name
    let capturedByName: string | null = null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userData.user.id)
      .maybeSingle();
    capturedByName = profile?.display_name || userData.user.email || null;

    const insertPayload = {
      user_id: userData.user.id,
      team_id: body.teamId ?? null,
      project_id: body.projectId ?? null,
      captured_by_name: capturedByName,

      source_platform: sanitizedSource.platform,
      source_url: sanitizedSource.url,
      source_thread_key: sanitizedSource.threadKey,
      source_page_title: sanitizedSource.pageTitle,
      source_captured_at: sanitizedSource.capturedAt,

      raw_text: cleaned,

      title: analysis.title,
      topic: analysis.topic,
      summary: analysis.summary,
      key_points: analysis.key_points,
      decisions: analysis.decisions,
      open_questions: analysis.open_questions,

      content_hash: sanitizedSource.contentHash,
      message_count: sanitizedSource.messageCount,
    };

    const { data, error } = await supabase
      .from("memories")
      .insert(insertPayload)
      .select("*")
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, memory: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-memory error:", e);
    return new Response(
      JSON.stringify({ error: "An error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
