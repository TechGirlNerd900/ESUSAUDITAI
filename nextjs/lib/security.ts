import { createServerClient } from '@supabase/ssr';
import crypto from 'crypto';
import type { CookieOptions } from '@supabase/ssr';

interface CookieStore {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options?: CookieOptions }[]): void;
}

interface User {
  failed_login_attempts?: number;
  locked_until?: string;
}

interface LoginAttemptResult {
  allowed: boolean;
  lockoutTimeRemaining?: number;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface AuditLogEntry {
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ip: string;
  userAgent: string;
}

type ValidationType = 'email' | 'name' | 'password';

export class SecurityService {
  private client;
  private maxLoginAttempts: number;
  private lockoutDuration: number;
  private EMAIL_REGEX: RegExp;
  private NAME_REGEX: RegExp;
  private PASSWORD_REGEX: RegExp;

  constructor(cookieStore: CookieStore) {
    this.client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: cookieStore
      }
    );

    this.maxLoginAttempts = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes

    this.EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    this.NAME_REGEX = /^[A-Za-z\s'-]{2,50}$/;
    this.PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
  }

  // Input validation and sanitization
  validateInput(value: string, type: ValidationType): boolean {
    if (!value) return false;

    switch (type) {
      case 'email':
        return this.EMAIL_REGEX.test(value);
      case 'name':
        return this.NAME_REGEX.test(value);
      case 'password':
        return this.PASSWORD_REGEX.test(value);
      default:
        return false;
    }
  }

  // Sanitize string input
  sanitizeString(input: unknown): string {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 1000); // Limit length
  }

  async checkLoginAttempts(email: string): Promise<LoginAttemptResult> {
    try {
      const { data: user, error } = await this.client
        .from('users')
        .select('failed_login_attempts, locked_until')
        .eq('email', email)
        .single();

      if (error) throw error;

      if (!user) {
        return { allowed: true }; // Don't reveal if user exists
      }

      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const timeRemaining = Math.ceil((new Date(user.locked_until).getTime() - new Date().getTime()) / 1000 / 60);
        return {
          allowed: false,
          lockoutTimeRemaining: timeRemaining
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking login attempts:', error);
      return { allowed: true }; // Fail open for usability
    }
  }

  async recordFailedLogin(email: string): Promise<void> {
    try {
      const { data: user, error } = await this.client
        .from('users')
        .select('failed_login_attempts')
        .eq('email', email)
        .single();

      if (error || !user) return;

      const attempts = (user.failed_login_attempts || 0) + 1;
      const updates: { failed_login_attempts: number; locked_until?: string } = {
        failed_login_attempts: attempts
      };

      if (attempts >= this.maxLoginAttempts) {
        updates.locked_until = new Date(Date.now() + this.lockoutDuration).toISOString();
      }

      await this.client
        .from('users')
        .update(updates)
        .eq('email', email);
    } catch (error) {
      console.error('Error recording failed login:', error);
    }
  }

  async clearLoginAttempts(email: string): Promise<void> {
    try {
      await this.client
        .from('users')
        .update({
          failed_login_attempts: 0,
          locked_until: null
        })
        .eq('email', email);
    } catch (error) {
      console.error('Error clearing login attempts:', error);
    }
  }

  // Validate file upload security
  validateFileUpload(file: { mimetype?: string; size?: number }, maxSizeMB: number = 50): ValidationResult {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv'
    ];

    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
      return { valid: false, error: 'File type not supported' };
    }

    const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
    if (file.size && file.size > maxSize) {
      return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
    }

    return { valid: true };
  }

  // Generate secure random tokens
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash sensitive data
  hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Create audit log entry
  createAuditLog(userId: string, action: string, resource: string, details: Record<string, any> = {}): AuditLogEntry {
    return {
      timestamp: new Date().toISOString(),
      userId: userId,
      action: action,
      resource: resource,
      details: details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown'
    };
  }
}