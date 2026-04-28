import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const { messages, projectId } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's memories for context
    let dbQuery = supabase
      .from("memories")
      .select("title, topic, summary, key_points, decisions, open_questions, source_platform, captured_by_name, created_at")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (projectId) {
      dbQuery = dbQuery.eq("project_id", projectId);
    }

    const { data: memories } = await dbQuery;

    // Build context from memories
    const memoryContext = (memories || []).map((m: any) => {
      const parts = [`### ${m.title}`];
      if (m.captured_by_name) parts.push(`Captured by: ${m.captured_by_name}`);
      if (m.topic) parts.push(`Topic: ${m.topic}`);
      if (m.summary) parts.push(m.summary);
      if (m.key_points?.length) parts.push(`Key points: ${m.key_points.join("; ")}`);
      if (m.decisions?.length) parts.push(`Decisions: ${m.decisions.join("; ")}`);
      if (m.open_questions?.length) parts.push(`Open questions: ${m.open_questions.join("; ")}`);
      parts.push(`Date: ${new Date(m.created_at).toLocaleDateString()}`);
      return parts.join("\n");
    }).join("\n\n---\n\n");

    const systemPrompt = `You are an AI assistant with access to the user's captured project memories. Use this knowledge to answer their questions accurately and helpfully. Reference specific memories when relevant.

## User's Memories
${memoryContext || "No memories available yet."}

## Instructions
- Answer based on the user's captured context when possible
- Reference specific memory titles when citing information
- If a memory was captured by a specific person, mention their name
- If information isn't in the memories, say so clearly
- Be concise but thorough`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-memories error:", e);
    return new Response(
      JSON.stringify({ error: "An error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
