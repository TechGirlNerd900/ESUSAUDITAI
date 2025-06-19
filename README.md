# Esus Audit AI - Production Deployment Guide

## 🚀 Production Readiness Checklist

Your application has been optimized for production with the following enhancements:

### ✅ Security Hardening
- **Environment Variables**: All secrets moved to environment variables
- **Input Validation**: Comprehensive validation middleware added
- **CORS Protection**: Strict CORS policies for production
- **Rate Limiting**: Enhanced rate limiting with separate auth limits
- **Security Headers**: Helmet configuration with CSP
- **Input Sanitization**: XSS and injection protection
- **Authentication**: Enhanced token validation and user status checks

### ✅ Performance Optimization
- **Logging**: Production-ready logging system with Application Insights
- **Monitoring**: Health checks, metrics, and performance monitoring
- **Error Handling**: Structured error handling with proper logging
- **Build Process**: Optimized builds for both frontend and backend
- **Docker**: Multi-stage Docker builds for minimal image size

### ✅ Operational Excellence
- **Health Checks**: `/health`, `/health/ready`, `/health/live`, `/metrics`
- **Graceful Shutdown**: Proper signal handling and cleanup
- **Process Management**: Docker with non-root user and security constraints
- **Monitoring**: Application Insights integration for telemetry

## 🧪 Testing Production Mode

### Quick Test
```bash
# Test the production configuration
node test-production.js
```

### Manual Testing
```bash
# 1. Start backend in production mode
cd server
NODE_ENV=production npm run prod

# 2. In another terminal, build and serve frontend
cd client
npm run build
npm run preview

# 3. Test endpoints
curl http://localhost:3001/health
curl http://localhost:3001/metrics
```

## 🔧 Environment Configuration

### Required Environment Variables

Create a `.env.production` file with:

```bash
# Critical - Must be set
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-256-bit-secret

# Security
ALLOWED_ORIGINS=https://yourdomain.com
TRUST_PROXY=true

# Azure Services
AZURE_OPENAI_ENDPOINT=https://your-service.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key
AZURE_FORM_RECOGNIZER_ENDPOINT=https://your-service.cognitiveservices.azure.com/
AZURE_FORM_RECOGNIZER_KEY=your-key

# Monitoring
APPLICATIONINSIGHTS_CONNECTION_STRING=your-connection-string

# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Rate Limiting (stricter for production)
RATE_LIMIT_MAX_REQUESTS=50
AUTH_RATE_LIMIT_MAX_REQUESTS=3
```

## 🐳 Docker Deployment

### Build and Run with Docker
```bash
# Build the image
docker build -t esus-audit-ai .

# Run in production mode
docker run -d \
  --name esus-audit-ai \
  --env-file .env.production \
  -p 3001:3001 \
  --restart unless-stopped \
  esus-audit-ai
```

### Docker Compose (Recommended)
```bash
# Copy production environment
cp .env.example .env.production
# Edit .env.production with your values

# Start with docker-compose
docker-compose -f docker-compose.production.yml up -d
```

## 🌐 Reverse Proxy Setup (Nginx)

Create `/etc/nginx/sites-available/esus-audit-ai`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    
    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    
    # Frontend (Static Files)
    location / {
        root /path/to/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health checks
    location /health {
        proxy_pass http://localhost:3001;
        access_log off;
    }
}
```

## 📊 Monitoring and Alerting

### Health Check Endpoints
- `GET /health` - Comprehensive system health
- `GET /health/ready` - Readiness probe (Kubernetes)
- `GET /health/live` - Liveness probe (Kubernetes)
- `GET /metrics` - System metrics

### Application Insights Dashboards
Monitor these key metrics:
- Request count and response times
- Error rates and exceptions
- Authentication success/failure rates
- Security events
- Database connection health
- Memory and CPU usage

### Log Analysis
```bash
# View production logs
docker logs esus-audit-ai

# Follow logs in real-time
docker logs -f esus-audit-ai

# Filter error logs
docker logs esus-audit-ai 2>&1 | grep ERROR
```

## 🔒 Security Considerations

### SSL/TLS Configuration
- Use TLS 1.2 or higher
- Strong cipher suites only
- HSTS headers enabled
- Certificate auto-renewal setup

### Database Security
- Use connection pooling with limits
- Enable SSL connections
- Regular security updates
- Monitor for unusual activity

### Application Security
- Regular dependency updates
- Security scanning in CI/CD
- Environment variable validation
- Input sanitization and validation

## 🚨 Troubleshooting

### Common Issues

1. **Environment Variables Not Set**
   ```bash
   # Validate environment
   cd server && npm run validate-env
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connectivity
   curl http://localhost:3001/health
   ```

3. **High Memory Usage**
   ```bash
   # Check memory metrics
   curl http://localhost:3001/metrics
   ```

4. **SSL Certificate Issues**
   ```bash
   # Test SSL configuration
   openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
   ```

### Performance Optimization
- Enable gzip compression in Nginx
- Use CDN for static assets
- Implement Redis caching
- Monitor and optimize database queries
- Set up horizontal scaling if needed

## 📈 Scaling Recommendations

### Horizontal Scaling
- Use load balancer (Nginx/HAProxy)
- Multiple application instances
- Shared Redis for sessions/cache
- Database read replicas

### Vertical Scaling
- Monitor CPU/Memory usage
- Optimize database queries
- Implement caching strategies
- Use connection pooling

## 🔧 Maintenance

### Regular Tasks
- Monitor error rates and performance
- Update dependencies monthly
- Rotate secrets quarterly
- Review and update security policies
- Backup database regularly
- Test disaster recovery procedures

### CI/CD Pipeline
```yaml
# Example GitHub Actions workflow
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run production tests
        run: node test-production.js
      - name: Deploy to production
        run: docker-compose -f docker-compose.production.yml up -d --build
```

## 📞 Support

For production issues:
1. Check health endpoints first
2. Review Application Insights dashboards
3. Analyze server logs
4. Monitor system resources
5. Check database connectivity

---

🎉 **Your Esus Audit AI application is now production-ready!**

Run `node test-production.js` to verify all systems are working correctly.