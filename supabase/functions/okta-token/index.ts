// Edge function: proxies the Okta token exchange server-side.
// This avoids Okta's browser-enforced PKCE requirement — the request
// originates from a server, not the browser.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, redirectUri, domain, clientId, clientSecret } = await req.json() as {
      code:         string;
      redirectUri:  string;
      domain:       string;
      clientId:     string;
      clientSecret: string;
    };

    if (!code || !redirectUri || !domain || !clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tokenUrl = `${domain.replace(/\/$/, "")}/oauth2/v1/token`;

    const body = new URLSearchParams({
      grant_type:    "authorization_code",
      code,
      redirect_uri:  redirectUri,
      client_id:     clientId,
      client_secret: clientSecret,
    });

    const oktaRes = await fetch(tokenUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const data = await oktaRes.json();

    return new Response(JSON.stringify(data), {
      status:  oktaRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
