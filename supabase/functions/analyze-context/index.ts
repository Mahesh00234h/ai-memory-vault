import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawContent, platform, pageTitle } = await req.json();

    if (!rawContent || rawContent.length < 50) {
      return new Response(
        JSON.stringify({ error: "Content too short for analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Truncate content if too long (to stay within token limits)
    const truncatedContent = rawContent.length > 15000 
      ? rawContent.substring(0, 15000) + "\n\n[Content truncated for analysis...]" 
      : rawContent;

    const systemPrompt = `You are an expert at analyzing AI chat conversations and extracting structured context. 
Analyze the conversation and extract:
1. A clear, descriptive title (max 60 chars) - NOT generic like "Untitled" or platform names
2. The main topic being discussed
3. A concise summary (2-3 sentences max)
4. Key points or important information (up to 5 items)
5. Any technology stack mentioned (programming languages, frameworks, tools)
6. Decisions made during the conversation (up to 5)
7. Open questions or unresolved items (up to 5)

Be specific and actionable. Focus on extracting the most useful context for resuming this conversation later.`;

    const userPrompt = `Platform: ${platform || 'Unknown'}
Page Title: ${pageTitle || 'Unknown'}

Conversation:
${truncatedContent}

Analyze this conversation and return a JSON object with these exact fields:
{
  "title": "A clear descriptive title (max 60 chars)",
  "topic": "Main topic being discussed",
  "summary": "2-3 sentence summary of the conversation",
  "keyPoints": ["Key point 1", "Key point 2", ...],
  "techStack": ["Tech1", "Tech2", ...],
  "decisions": ["Decision 1", "Decision 2", ...],
  "openQuestions": ["Question 1", "Question 2", ...]
}`;

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
      summary: analysis.summary || null,
      keyPoints: Array.isArray(analysis.keyPoints) ? analysis.keyPoints.slice(0, 5) : [],
      techStack: Array.isArray(analysis.techStack) ? analysis.techStack.slice(0, 10) : [],
      decisions: Array.isArray(analysis.decisions) ? analysis.decisions.slice(0, 5) : [],
      openQuestions: Array.isArray(analysis.openQuestions) ? analysis.openQuestions.slice(0, 5) : [],
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
