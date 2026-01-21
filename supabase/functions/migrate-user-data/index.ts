import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MigrateRequest {
  legacyUserId: string;
  dryRun?: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Validate authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("Missing environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user is authenticated
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authUserId = userData.user.id;

    // Parse and validate request body
    const body: MigrateRequest = await req.json();
    const { legacyUserId, dryRun = false } = body;

    if (!legacyUserId || !isValidUuid(legacyUserId)) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing legacyUserId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client for migration operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Step 1: Verify the legacy user exists
    const { data: legacyUser, error: legacyUserError } = await adminClient
      .from("extension_users")
      .select("id, name, migrated_to_auth_id")
      .eq("id", legacyUserId)
      .single();

    if (legacyUserError || !legacyUser) {
      return new Response(
        JSON.stringify({ error: "Legacy user not found", details: legacyUserError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already migrated
    if (legacyUser.migrated_to_auth_id) {
      if (legacyUser.migrated_to_auth_id === authUserId) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "User already migrated to this account",
            alreadyMigrated: true 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({ error: "Legacy user already migrated to a different account" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 2: Fetch all captured_contexts for this legacy user
    const { data: legacyContexts, error: contextsError } = await adminClient
      .from("captured_contexts")
      .select("*")
      .eq("user_id", legacyUserId)
      .order("captured_at", { ascending: false });

    if (contextsError) {
      console.error("Error fetching contexts:", contextsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch legacy contexts", details: contextsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Check for existing memories with same source_url to avoid duplicates
    const urls = legacyContexts?.map(c => c.url).filter(Boolean) || [];
    let existingUrls: Set<string> = new Set();

    if (urls.length > 0) {
      const { data: existingMemories } = await adminClient
        .from("memories")
        .select("source_url")
        .eq("user_id", authUserId)
        .in("source_url", urls);

      existingUrls = new Set(existingMemories?.map(m => m.source_url).filter(Boolean) || []);
    }

    // Filter contexts that haven't been migrated yet
    const contextsToMigrate = legacyContexts?.filter(c => !existingUrls.has(c.url)) || [];

    // Prepare migration summary
    const migrationSummary = {
      legacyUserId,
      authUserId,
      legacyUserName: legacyUser.name,
      totalLegacyContexts: legacyContexts?.length || 0,
      alreadyMigrated: existingUrls.size,
      toMigrate: contextsToMigrate.length,
      dryRun,
    };

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Dry run complete - no changes made",
          summary: migrationSummary,
          previewContexts: contextsToMigrate.slice(0, 5).map(c => ({
            title: c.title,
            url: c.url,
            capturedAt: c.captured_at,
          })),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Migrate contexts to memories table
    const memoriesToInsert = contextsToMigrate.map(context => ({
      user_id: authUserId,
      team_id: context.team_id,
      title: context.title,
      topic: context.topic,
      summary: context.summary,
      key_points: context.key_points || [],
      decisions: context.decisions || [],
      open_questions: context.open_questions || [],
      raw_text: context.raw_content,
      source_platform: context.platform,
      source_url: context.url,
      source_captured_at: context.captured_at,
      message_count: context.message_count,
      memory_version: 1, // Mark as migrated from V1
    }));

    let insertedCount = 0;
    const errors: string[] = [];

    // Insert in batches of 50 to avoid payload limits
    const batchSize = 50;
    for (let i = 0; i < memoriesToInsert.length; i += batchSize) {
      const batch = memoriesToInsert.slice(i, i + batchSize);
      const { error: insertError, data: insertedData } = await adminClient
        .from("memories")
        .insert(batch)
        .select("id");

      if (insertError) {
        console.error(`Batch insert error at ${i}:`, insertError);
        errors.push(`Batch ${Math.floor(i / batchSize)}: ${insertError.message}`);
      } else {
        insertedCount += insertedData?.length || 0;
      }
    }

    // Step 5: Mark legacy contexts with legacy_user_id for tracking
    if (contextsToMigrate.length > 0) {
      const contextIds = contextsToMigrate.map(c => c.id);
      const { error: updateContextsError } = await adminClient
        .from("captured_contexts")
        .update({ legacy_user_id: legacyUserId })
        .in("id", contextIds);

      if (updateContextsError) {
        console.error("Error updating legacy contexts:", updateContextsError);
        errors.push(`Context tracking update: ${updateContextsError.message}`);
      }
    }

    // Step 6: Link extension_user to auth user
    const { error: linkError } = await adminClient
      .from("extension_users")
      .update({ migrated_to_auth_id: authUserId })
      .eq("id", legacyUserId);

    if (linkError) {
      console.error("Error linking legacy user:", linkError);
      errors.push(`User linking: ${linkError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        message: errors.length === 0 
          ? "Migration completed successfully" 
          : "Migration completed with some errors",
        summary: {
          ...migrationSummary,
          inserted: insertedCount,
          errors: errors.length,
        },
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Internal server error", details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
