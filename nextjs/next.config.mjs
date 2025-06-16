/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@azure/ai-form-recognizer', '@azure/openai'],
  images: {
    domains: ['supabase.co', 'localhost'],
  },
};

export default nextConfig;
