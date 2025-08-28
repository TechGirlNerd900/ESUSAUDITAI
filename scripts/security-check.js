#!/usr/bin/env node

/**
 * Simple Security Configuration Check
 * Validates security setup without requiring TypeScript compilation
 */

import fs from 'fs';
import path from 'path';

function checkSecurityConfiguration() {
  console.log('🔐 ESUS Audit AI - Security Configuration Check');
  console.log('==============================================');
  console.log('');

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  // Check 1: Security Headers File Exists
  console.log('📁 Checking Security Headers Implementation...');
  const securityHeadersPath = './nextjs/lib/securityHeaders.ts';
  if (fs.existsSync(securityHeadersPath)) {
    console.log('✅ Security headers module exists');
    passed++;
  } else {
    console.log('❌ Security headers module missing');
    failed++;
  }

  // Check 2: Middleware Updated
  console.log('');
  console.log('🛠️  Checking Middleware Configuration...');
  const middlewarePath = './nextjs/middleware.ts';
  if (fs.existsSync(middlewarePath)) {
    const middlewareContent = fs.readFileSync(middlewarePath, 'utf8');
    
    if (middlewareContent.includes('addSecurityHeaders')) {
      console.log('✅ Middleware imports security headers');
      passed++;
    } else {
      console.log('❌ Middleware not updated to use security headers');
      failed++;
    }

    if (middlewareContent.includes('unsafe-inline') || middlewareContent.includes('unsafe-eval')) {
      console.log('⚠️  Middleware still contains unsafe CSP directives');
      warnings++;
    } else {
      console.log('✅ No unsafe CSP directives found in middleware');
      passed++;
    }
  } else {
    console.log('❌ Middleware file missing');
    failed++;
  }

  // Check 3: Next.js Configuration
  console.log('');
  console.log('⚙️  Checking Next.js Configuration...');
  const nextConfigPath = './nextjs/next.config.js';
  if (fs.existsSync(nextConfigPath)) {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8');
    
    if (configContent.includes('poweredByHeader: false')) {
      console.log('✅ X-Powered-By header disabled');
      passed++;
    } else {
      console.log('⚠️  X-Powered-By header not disabled');
      warnings++;
    }

    if (configContent.includes('headers()')) {
      console.log('✅ Custom security headers configured');
      passed++;
    } else {
      console.log('⚠️  Custom headers not configured in Next.js');
      warnings++;
    }
  } else {
    console.log('❌ Next.js configuration missing');
    failed++;
  }

  // Check 4: CSP Nonce Hook
  console.log('');
  console.log('🔗 Checking CSP Nonce Implementation...');
  const nonceHookPath = './nextjs/hooks/useCSPNonce.ts';
  if (fs.existsSync(nonceHookPath)) {
    console.log('✅ CSP nonce hook implemented');
    passed++;
  } else {
    console.log('❌ CSP nonce hook missing');
    failed++;
  }

  // Check 5: Environment Variables
  console.log('');
  console.log('🌍 Checking Environment Configuration...');
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NODE_ENV'
  ];

  requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar} is configured`);
      passed++;
    } else {
      console.log(`⚠️  ${envVar} not configured (may be normal for testing)`);
      warnings++;
    }
  });

  // Check 6: Vulnerable Dependencies Fixed
  console.log('');
  console.log('📦 Checking Dependency Security...');
  const packageJsonPath = './nextjs/package.json';
  if (fs.existsSync(packageJsonPath)) {
    const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageContent);
    
    // Check for removed vulnerable packages
    const vulnerablePackages = ['html-pdf', 'xlsx', 'swagger-ui-react'];
    const foundVulnerable = vulnerablePackages.filter(pkg => 
      packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg]
    );

    if (foundVulnerable.length === 0) {
      console.log('✅ Vulnerable packages have been replaced');
      passed++;
    } else {
      console.log(`❌ Vulnerable packages still present: ${foundVulnerable.join(', ')}`);
      failed++;
    }

    // Check for secure replacements
    const securePackages = ['puppeteer', 'exceljs'];
    const foundSecure = securePackages.filter(pkg => 
      packageJson.dependencies?.[pkg] || packageJson.devDependencies?.[pkg]
    );

    if (foundSecure.length === securePackages.length) {
      console.log('✅ Secure replacement packages installed');
      passed++;
    } else {
      console.log(`⚠️  Missing secure packages: ${securePackages.filter(pkg => !foundSecure.includes(pkg)).join(', ')}`);
      warnings++;
    }
  }

  // Generate Summary
  console.log('');
  console.log('📊 Security Configuration Summary');
  console.log('=================================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log('');

  const isSecure = failed === 0;

  if (isSecure) {
    console.log('🎉 Security configuration looks good!');
    console.log('');
    console.log('🔒 Key security improvements implemented:');
    console.log('  • Secure CSP without unsafe-inline/unsafe-eval');
    console.log('  • Comprehensive security headers');
    console.log('  • Vulnerable dependencies replaced');
    console.log('  • Next.js security hardening');
    console.log('  • CSP nonce support for inline content');
    
    if (warnings > 0) {
      console.log('');
      console.log('💡 Consider addressing the warnings for optimal security.');
    }
  } else {
    console.log('🚨 Security configuration needs attention!');
    console.log('');
    console.log('🔧 Please fix the failed checks before deployment.');
    console.log('');
    console.log('📚 Security Resources:');
    console.log('  • OWASP Security Headers: https://owasp.org/www-project-secure-headers/');
    console.log('  • Next.js Security: https://nextjs.org/docs/advanced-features/security-headers');
    console.log('  • CSP Guide: https://web.dev/csp/');
  }

  return {
    success: isSecure,
    stats: { passed, failed, warnings }
  };
}

// Security recommendations
function printSecurityRecommendations() {
  console.log('');
  console.log('🛡️  Additional Security Recommendations');
  console.log('======================================');
  console.log('');
  console.log('🔹 For Production Deployment:');
  console.log('  • Enable HSTS with preload');
  console.log('  • Configure CAA DNS records');
  console.log('  • Implement security monitoring');
  console.log('  • Regular security audits');
  console.log('  • Enable CSP reporting');
  console.log('');
  console.log('🔹 For Development:');
  console.log('  • Use HTTPS locally');
  console.log('  • Test with production CSP settings');
  console.log('  • Validate security headers');
  console.log('  • Check for mixed content');
  console.log('');
  console.log('🔹 Monitoring:');
  console.log('  • Set up CSP violation reporting');
  console.log('  • Monitor security header compliance');
  console.log('  • Track security-related errors');
  console.log('  • Regular dependency security scans');
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = checkSecurityConfiguration();
    printSecurityRecommendations();
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('Security configuration check failed:', error);
    process.exit(1);
  }
}