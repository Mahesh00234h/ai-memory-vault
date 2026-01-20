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
    "You are a precise extraction engine. Return ONLY valid JSON. Be concise but high-signal.";

  const userPrompt = `Platform: ${params.platform || "Unknown"}
URL: ${params.url || "Unknown"}
Page Title: ${params.pageTitle || "Unknown"}

RAW INPUT:
${truncated}

Return a JSON object EXACTLY matching this schema:
{
  "title": "string (<= 80 chars)",
  "topic": "string or null",
  "summary": "string (2-5 sentences)",
  "key_points": ["string"],
  "decisions": ["string"],
  "open_questions": ["string"]
}`;

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
    if (!rawText || rawText.trim().length < 50) {
      return new Response(JSON.stringify({ error: "rawText too short" }), {
        status: 400,
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

    const cleaned = cleanRawText(rawText);
    if (cleaned.length < 50) {
      return new Response(JSON.stringify({ error: "Content too short after cleaning" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = await analyzeToMemoryJson({
      rawText: cleaned,
      platform: body.source?.platform ?? null,
      url: body.source?.url ?? null,
      pageTitle: body.source?.pageTitle ?? null,
    });

    const insertPayload = {
      user_id: userData.user.id,
      team_id: body.teamId ?? null,
      project_id: body.projectId ?? null,

      source_platform: body.source?.platform ?? null,
      source_url: body.source?.url ?? null,
      source_thread_key: body.source?.threadKey ?? null,
      source_page_title: body.source?.pageTitle ?? null,
      source_captured_at: body.source?.capturedAt ?? null,

      raw_text: cleaned,

      title: analysis.title,
      topic: analysis.topic,
      summary: analysis.summary,
      key_points: analysis.key_points,
      decisions: analysis.decisions,
      open_questions: analysis.open_questions,

      content_hash: body.source?.contentHash ?? null,
      message_count: body.source?.messageCount ?? 0,
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
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
