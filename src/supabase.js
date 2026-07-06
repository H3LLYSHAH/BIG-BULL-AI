import { createClient } from '@supabase/supabase-js';

// Values come from your Supabase project's Settings -> API page.
// Loaded from environment variables so real keys stay out of the repo.
// See .env.example.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
