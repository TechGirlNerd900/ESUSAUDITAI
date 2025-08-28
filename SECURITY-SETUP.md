# 🔐 ESUS Audit AI - Security Setup Guide

## ⚠️ CRITICAL SECURITY NOTICE

This guide contains essential security setup instructions. **Failure to follow these steps will leave your application vulnerable to security breaches.**

## 🚨 IMMEDIATE ACTIONS REQUIRED

### 1. API Key Rotation (URGENT)

The following API keys were previously exposed and **MUST be rotated immediately**:

- **Supabase Service Role Key** - Go to your Supabase dashboard → Settings → API → Generate new service role key
- **Azure Form Recognizer Key** - Go to Azure portal → Your Form Recognizer resource → Keys and Endpoint → Regenerate keys
- **Azure OpenAI API Key** - Go to Azure portal → Your OpenAI resource → Keys and Endpoint → Regenerate keys  
- **Upstash Redis Token** - Go to Upstash console → Your Redis database → REST API → Regenerate token
- **News API Token** - Go to newsapi.org → Account → Regenerate API key

### 2. Environment Configuration

#### For Local Development:

1. **Generate secure keys** (already done):
   ```bash
   node scripts/generate-security-keys.js
   ```

2. **Create .env.local** (never commit this file):
   ```bash
   cp .env.template .env.local
   # Edit .env.local with your actual values
   ```

3. **Verify .gitignore** (already configured):
   - All `.env*` files are excluded from version control
   - Security-sensitive files are properly ignored

#### For Production Deployment:

**Vercel (Recommended):**
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each environment variable individually
4. Set appropriate environment (Production, Preview, Development)

**Other Platforms:**
- Use your platform's secret management system
- Never store secrets in plain text configuration files
- Consider using Azure Key Vault, AWS Secrets Manager, or similar

## 🔑 Required Environment Variables

### Critical Security Keys
```bash
CSRF_SECRET=<generated-secure-key>
ENCRYPTION_KEY=<generated-secure-key>
JWT_SECRET=<generated-secure-key>
SESSION_SECRET=<generated-secure-key>
API_SECRET_KEY=<generated-secure-key>
WEBHOOK_SECRET=<generated-secure-key>
```

### Database Configuration
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-new-service-role-key>
```

### Azure AI Services
```bash
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=<your-new-azure-openai-key>
AZURE_FORM_RECOGNIZER_ENDPOINT=https://your-form-recognizer.cognitiveservices.azure.com/
AZURE_FORM_RECOGNIZER_KEY=<your-new-form-recognizer-key>
AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net
AZURE_SEARCH_API_KEY=<your-new-search-key>
```

### Redis Configuration
```bash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-new-redis-token>
```

## 🛡️ Security Best Practices

### 1. Key Management
- **Rotate keys regularly** (every 90 days minimum)
- **Use different keys** for different environments
- **Monitor key usage** in your service dashboards
- **Implement key rotation automation** where possible

### 2. Access Control
- **Principle of least privilege** - Grant minimal necessary permissions
- **Regular access audits** - Review who has access to what
- **Multi-factor authentication** - Enable on all service accounts
- **IP restrictions** - Limit access to known IP ranges where possible

### 3. Monitoring
- **Enable audit logging** on all external services
- **Set up alerts** for unusual API usage patterns
- **Monitor error rates** for potential security issues
- **Regular security scans** of your infrastructure

### 4. Development Practices
- **Never commit secrets** to version control
- **Use environment-specific configurations**
- **Regular dependency updates** to patch vulnerabilities
- **Code reviews** for all security-related changes

## 🔍 Security Verification Checklist

- [ ] All exposed API keys have been rotated
- [ ] New secure keys are properly configured in production
- [ ] .env.local files are excluded from version control
- [ ] All external services are accessible with new keys
- [ ] Monitoring and alerting are configured
- [ ] Team members have been notified of key changes
- [ ] Documentation has been updated with new procedures

## 🚨 Incident Response

If you suspect a security breach:

1. **Immediately rotate all API keys**
2. **Review access logs** in all connected services
3. **Check for unusual activity** in your applications
4. **Update all team members** about the incident
5. **Document the incident** for future prevention
6. **Consider engaging security professionals** if breach is confirmed

## 📞 Support

For security-related issues:
- Review this guide thoroughly
- Check service-specific documentation
- Contact your cloud provider support
- Consider security consultation services

## 🔄 Regular Maintenance

**Monthly:**
- Review access logs
- Check for unused API keys
- Update team access permissions

**Quarterly:**
- Rotate all API keys
- Security audit of configurations
- Update security procedures

**Annually:**
- Complete security assessment
- Update incident response procedures
- Team security training

---

**⚠️ Remember: Security is an ongoing process, not a one-time setup.**