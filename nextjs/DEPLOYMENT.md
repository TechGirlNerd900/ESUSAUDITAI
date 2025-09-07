# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Environment Variables**: Have all your environment variables ready

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Connect Repository**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Environment Variables**:
   Add these environment variables in the Vercel dashboard:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://vczmjgajmdlniqohdesv.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
   AZURE_FORM_RECOGNIZER_ENDPOINT=https://esusdocai.cognitiveservices.azure.com/
   AZURE_FORM_RECOGNIZER_KEY=your-key
   AZURE_OPENAI_ENDPOINT=https://esusaudiau.openai.azure.com/
   AZURE_OPENAI_API_KEY=your-key
   AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
   AZURE_OPENAI_API_VERSION=2024-02-15-preview
   AZURE_SEARCH_ENDPOINT=https://esussearch.search.windows.net
   AZURE_SEARCH_API_KEY=your-key
   AZURE_SEARCH_INDEX_NAME=esussearch
   CSRF_SECRET=your-32-char-secret
   ENCRYPTION_KEY=your-32-char-key
   UPSTASH_REDIS_REST_URL=your-redis-url (optional)
   UPSTASH_REDIS_REST_TOKEN=your-redis-token (optional)
   ```

3. **Deploy**:
   - Click "Deploy"
   - Vercel will automatically build and deploy your application

### Option 2: Deploy via CLI

1. **Install Vercel CLI**:

   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:

   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

## Post-Deployment Steps

1. **Update NEXT_PUBLIC_SITE_URL**:
   - After deployment, update the `NEXT_PUBLIC_SITE_URL` environment variable
   - Set it to your actual Vercel URL (e.g., `https://your-app.vercel.app`)

2. **Update Supabase Settings**:
   - Go to your Supabase dashboard
   - Update the "Site URL" in Authentication settings
   - Add your Vercel URL to the "Redirect URLs" list

3. **Test the Application**:
   - Visit your deployed URL
   - Test the signup/login functionality
   - Verify all features work correctly

## Environment Variables Reference

| Variable                        | Description                           | Required |
| ------------------------------- | ------------------------------------- | -------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                  | Yes      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key                | Yes      |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role key             | Yes      |
| `NEXT_PUBLIC_SITE_URL`          | Your deployed app URL                 | Yes      |
| `AZURE_*`                       | Azure services configuration          | Yes      |
| `CSRF_SECRET`                   | CSRF protection secret                | Yes      |
| `ENCRYPTION_KEY`                | Encryption key for sensitive data     | Yes      |
| `UPSTASH_REDIS_*`               | Redis configuration for rate limiting | Optional |

## Custom Domain (Optional)

1. **Add Domain in Vercel**:
   - Go to your project settings
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Update Environment Variables**:
   - Update `NEXT_PUBLIC_SITE_URL` to your custom domain
   - Update Supabase authentication settings

## Troubleshooting

### Common Issues:

1. **Build Errors**:
   - Check that all environment variables are set
   - Verify TypeScript types are correct
   - Check the build logs in Vercel dashboard

2. **Authentication Issues**:
   - Verify Supabase URLs are correct
   - Check that redirect URLs are properly configured
   - Ensure `NEXT_PUBLIC_SITE_URL` matches your deployed URL

3. **API Errors**:
   - Check environment variables in Vercel dashboard
   - Verify Azure services are accessible
   - Check function logs in Vercel dashboard

### Monitoring:

- Use Vercel Analytics for performance monitoring
- Check Vercel Functions logs for API errors
- Monitor Supabase dashboard for database issues

## Performance Optimization

The application is configured with:

- Automatic code splitting
- Image optimization
- Static generation where possible
- Edge runtime for API routes
- Proper caching headers

## Security

The deployment includes:

- HTTPS by default
- Security headers (CSP, HSTS, etc.)
- Rate limiting
- CSRF protection
- Input validation and sanitization
