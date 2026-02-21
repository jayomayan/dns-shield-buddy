/**
 * Single Supabase client — uses environment variables only.
 */

import { createClient } from "@supabase/supabase-js";

// Self-hosted Supabase instance
const supabaseUrl = "https://dnsguard.frontiertowersphilippines.com/supabase";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcxNjA5NTYwLCJleHAiOjE5MjkyODk1NjB9.-ERB_DXcNSI90n_gHmqy7uFYgIma9BOeL12TvuEs84U";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
