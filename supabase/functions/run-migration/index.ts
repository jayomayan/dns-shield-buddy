import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Pre-defined migrations — never accept arbitrary SQL
const MIGRATIONS: Record<string, string> = {
  "002_add_branding_columns": `
    ALTER TABLE public.user_settings
      ADD COLUMN IF NOT EXISTS brand_name  text NOT NULL DEFAULT 'DNSGuard',
      ADD COLUMN IF NOT EXISTS logo_url    text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS theme_preset text NOT NULL DEFAULT 'cyan-shield';
  `,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { migration_id } = await req.json();

    if (!migration_id || !MIGRATIONS[migration_id]) {
      return new Response(
        JSON.stringify({ error: `Unknown migration: ${migration_id}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Execute the migration SQL using the postgres extension
    const { error } = await supabase.rpc("exec_migration_sql", {
      sql_text: MIGRATIONS[migration_id],
    });

    if (error) {
      // If rpc doesn't exist, try direct approach — test if columns already exist
      const { error: testErr } = await supabase
        .from("user_settings")
        .select("brand_name, logo_url, theme_preset")
        .limit(1);

      if (!testErr) {
        return new Response(
          JSON.stringify({ success: true, message: "Columns already exist — migration not needed." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Migration applied successfully!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
