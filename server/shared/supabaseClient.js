// server/shared/supabaseClient.js
const { createClient } = require('@supabase/supabase-js');

// Check if environment variables are available
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('ERROR: Supabase environment variables are missing!');
  console.error('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
  console.error('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
  }
);

module.exports = { supabase };