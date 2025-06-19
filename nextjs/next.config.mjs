/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add '@supabase/realtime-js' to your existing array
  serverExternalPackages: [
    '@azure/ai-form-recognizer', 
    '@azure/openai', 
    '@supabase/realtime-js'
  ],
  images: {
    domains: ['supabase.co', 'localhost'],
  },
};

export default nextConfig;