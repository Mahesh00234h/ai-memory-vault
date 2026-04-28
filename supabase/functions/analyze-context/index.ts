import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation constants
const MAX_RAW_CONTENT_LENGTH = 100000;
const MAX_PLATFORM_LENGTH = 50;
const MAX_PAGE_TITLE_LENGTH = 200;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    
    // Input validation
    const rawContent = typeof body.rawContent === "string" ? body.rawContent : "";
    const platform = typeof body.platform === "string" ? body.platform.slice(0, MAX_PLATFORM_LENGTH) : null;
    const pageTitle = typeof body.pageTitle === "string" ? body.pageTitle.slice(0, MAX_PAGE_TITLE_LENGTH) : null;

    if (!rawContent || rawContent.length < 50) {
      return new Response(
        JSON.stringify({ error: "Content too short for analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (rawContent.length > MAX_RAW_CONTENT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Content too long. Maximum ${MAX_RAW_CONTENT_LENGTH} characters allowed.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Send the FULL raw chat — only truncate if extremely large to fit token window
    const MAX_CHARS_FOR_AI = 90000; // Gemini Flash handles ~1M tokens, but cap for cost/latency
    const truncatedContent = rawContent.length > MAX_CHARS_FOR_AI
      ? rawContent.substring(0, MAX_CHARS_FOR_AI) + "\n\n[...conversation truncated due to length, but analyze everything above thoroughly...]"
      : rawContent;

    const systemPrompt = `You are a context extraction engine. You receive an ENTIRE raw AI chat transcript and produce a single, dense, complete context document that another AI can read to instantly continue the work with ZERO loss of information.

Hard rules:
- READ THE ENTIRE TRANSCRIPT. Do not skim. Do not skip the middle.
- Be EXHAUSTIVE: capture every decision, every name, every file, every API, every number, every constraint, every preference, every requirement, every rejected option (and why), and every open thread.
- Use the EXACT terminology, identifiers, code names, file paths, function names, URLs, and people/role names from the transcript. Never paraphrase technical terms.
- Prefer SPECIFICITY over brevity. Length is fine. Vagueness is not.
- If the transcript contains code, list the files/components touched and what changed. Quote critical snippets verbatim if they encode a decision.
- If something is ambiguous in the transcript, say so explicitly rather than inventing.
- Output must be self-contained: another AI reading ONLY your output should be able to continue the conversation without ever seeing the original transcript.`;

    const userPrompt = `Platform: ${platform || 'Unknown'}
Page Title: ${pageTitle || 'Unknown'}

CONVERSATION TO ANALYZE:
${truncatedContent}

---

Analyze this conversation deeply and return a JSON object with these fields. Be thorough and specific - imagine someone needs to continue this exact conversation with a different AI:

{
  "title": "A clear, descriptive title that captures the essence (max 60 chars)",
  
  "topic": "The main subject/domain being discussed",
  
  "projectOrigin": "What is the origin/purpose of this project or discussion? What problem is being solved? Who is it for? (2-3 sentences)",
  
  "coreInsights": "What are the key conceptual breakthroughs or reframings in this conversation? What makes this approach unique or important? (2-4 sentences)",
  
  "summary": "A comprehensive summary covering the main discussion arc, key conclusions, and current state. Should be detailed enough to understand the full context. (4-6 sentences)",
  
  "whatHasBeenBuilt": [
    "Specific thing that was created, defined, or established",
    "Another concrete output or decision from the conversation"
  ],
  
  "keyPoints": [
    "Important point or insight 1",
    "Important point or insight 2",
    "Up to 8 key points that someone continuing this conversation MUST know"
  ],
  
  "techStack": ["Technology", "Framework", "Tool", "Methodology mentioned"],
  
  "decisions": [
    "A specific decision that was made",
    "Another decision or choice that was locked in"
  ],
  
  "strategicDirection": "What is the overall strategy or approach being taken? What is the 'philosophy' or 'design principle' guiding the work? (2-3 sentences)",
  
  "currentStatus": "What has been completed? What is in progress? What is the next step? (2-3 sentences)",
  
  "openQuestions": [
    "Unresolved question or decision that needs to be made",
    "Another open item that was left hanging"
  ],
  
  "continuationPrompt": "A brief instruction for how to continue this conversation. What should NOT be re-explained? What should be the focus going forward? (2-3 sentences)",
  
  "importantContext": "Any critical context, constraints, or nuances that might be lost if not explicitly stated. Include any 'rules' or 'principles' established in the conversation. (2-3 sentences)"
}

Be extremely thorough. If a field doesn't apply, use an empty string or empty array, but try to extract as much as possible.`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse AI response as JSON");
      }
    }

    // Validate and sanitize the response
    const sanitized = {
      title: (analysis.title || "Untitled Chat").substring(0, 60),
      topic: analysis.topic || null,
      projectOrigin: analysis.projectOrigin || null,
      coreInsights: analysis.coreInsights || null,
      summary: analysis.summary || null,
      whatHasBeenBuilt: Array.isArray(analysis.whatHasBeenBuilt) ? analysis.whatHasBeenBuilt.slice(0, 10) : [],
      keyPoints: Array.isArray(analysis.keyPoints) ? analysis.keyPoints.slice(0, 8) : [],
      techStack: Array.isArray(analysis.techStack) ? analysis.techStack.slice(0, 15) : [],
      decisions: Array.isArray(analysis.decisions) ? analysis.decisions.slice(0, 8) : [],
      strategicDirection: analysis.strategicDirection || null,
      currentStatus: analysis.currentStatus || null,
      openQuestions: Array.isArray(analysis.openQuestions) ? analysis.openQuestions.slice(0, 8) : [],
      continuationPrompt: analysis.continuationPrompt || null,
      importantContext: analysis.importantContext || null,
    };

    return new Response(
      JSON.stringify({ success: true, analysis: sanitized }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-context error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
