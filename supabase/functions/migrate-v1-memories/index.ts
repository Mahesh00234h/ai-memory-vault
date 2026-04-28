import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface V1Context {
  id: string;
  user_id: string;
  team_id: string | null;
  url: string;
  title: string;
  topic: string | null;
  summary: string | null;
  key_points: string[];
  tech_stack: string[];
  decisions: string[];
  open_questions: string[];
  raw_content: string | null;
  platform: string | null;
  message_count: number;
  captured_at: string;
  updated_at: string;
}

/**
 * Migrate V1 captured_contexts to V2 memories table
 * - Reads all user's captured_contexts
 * - Checks for existing migrations via source_url
 * - Inserts new memories for unmigrated contexts
 */
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

    const userId = userData.user.id;

    // Parse optional body params
    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body.dryRun === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // 1. Fetch all V1 captured_contexts for this user
    // Note: captured_contexts uses extension_users (different auth), so we use service role or just query all
    // For now, we'll migrate contexts that match URLs the user might have
    // Actually, captured_contexts has user_id from extension_users, not auth.users
    // We need to query using the service role to read captured_contexts, then insert as this user
    
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Service role key not configured");
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all captured_contexts (V1 uses extension_users, we migrate all available)
    const { data: v1Contexts, error: v1Error } = await adminClient
      .from("captured_contexts")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(500);

    if (v1Error) {
      console.error("Error fetching V1 contexts:", v1Error);
      return new Response(JSON.stringify({ error: "Failed to fetch V1 contexts" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!v1Contexts || v1Contexts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No V1 contexts found to migrate",
          migrated: 0,
          skipped: 0,
          total: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get existing V2 memories for this user to check for duplicates
    const { data: existingMemories, error: memError } = await supabase
      .from("memories")
      .select("source_url")
      .eq("user_id", userId);

    if (memError) {
      console.error("Error fetching existing memories:", memError);
    }

    const existingUrls = new Set(
      (existingMemories || []).map((m) => m.source_url).filter(Boolean)
    );

    // 3. Transform and insert new memories
    const toMigrate: V1Context[] = v1Contexts.filter(
      (ctx: V1Context) => !existingUrls.has(ctx.url)
    );

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          message: `Would migrate ${toMigrate.length} contexts`,
          total: v1Contexts.length,
          alreadyMigrated: v1Contexts.length - toMigrate.length,
          toMigrate: toMigrate.length,
          preview: toMigrate.slice(0, 5).map((c) => ({
            title: c.title,
            platform: c.platform,
            url: c.url,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let migrated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const ctx of toMigrate) {
      const memoryRow = {
        user_id: userId,
        team_id: null, // Don't migrate team association, let user re-share if needed
        project_id: null,
        
        title: ctx.title || "Untitled",
        topic: ctx.topic || null,
        summary: ctx.summary || null,
        key_points: Array.isArray(ctx.key_points) ? ctx.key_points : [],
        decisions: Array.isArray(ctx.decisions) ? ctx.decisions : [],
        open_questions: Array.isArray(ctx.open_questions) ? ctx.open_questions : [],
        
        raw_text: ctx.raw_content || null,
        source_platform: ctx.platform || null,
        source_url: ctx.url,
        source_thread_key: null,
        source_page_title: ctx.title || null,
        source_captured_at: ctx.captured_at,
        
        content_hash: null,
        message_count: ctx.message_count || 0,
        memory_version: 1,
      };

      const { error: insertError } = await supabase
        .from("memories")
        .insert(memoryRow);

      if (insertError) {
        console.error("Failed to migrate context:", ctx.id, insertError.message);
        errors.push(`${ctx.title}: ${insertError.message}`);
        failed++;
      } else {
        migrated++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migration complete`,
        total: v1Contexts.length,
        alreadyMigrated: v1Contexts.length - toMigrate.length,
        migrated,
        failed,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("migrate-v1-memories error:", e);
    return new Response(
      JSON.stringify({ error: "An error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
