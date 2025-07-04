import { createServerClient } from '@supabase/ssr';
import crypto from 'crypto';
import bcrypt from 'bcryptjs'; // Import bcryptjs
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
        cookies: cookieStore,
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

  /**
   * Sanitizes user input to prevent XSS attacks
   * @param {string} input - The user input to sanitize
   * @returns {string} - The sanitized input
   */
  sanitizeInput(input: unknown): string {
    if (typeof input !== 'string') {
      return String(input); // Convert to string for consistent handling
    }

    return input
      .replace(/&/g, '&') // Must be first
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/\\/g, '&#x5C;')
      .replace(/`/g, '&#96;');
  }

  /**
   * Recursively sanitizes an object's string properties
   * @param {object} obj - The object to sanitize
   * @returns {object} - The sanitized object
   */
  sanitizeObject<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item)) as T;
    }

    const sanitized: { [key: string]: any } = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized as T;
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
        const timeRemaining = Math.ceil(
          (new Date(user.locked_until).getTime() - new Date().getTime()) / 1000 / 60
        );
        return {
          allowed: false,
          lockoutTimeRemaining: timeRemaining,
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
        failed_login_attempts: attempts,
      };

      if (attempts >= this.maxLoginAttempts) {
        updates.locked_until = new Date(Date.now() + this.lockoutDuration).toISOString();
      }

      await this.client.from('users').update(updates).eq('email', email);
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
          locked_until: null,
        })
        .eq('email', email);
    } catch (error) {
      console.error('Error clearing login attempts:', error);
    }
  }

  // Validate file upload security
  validateFileUpload(
    file: { mimetype?: string; size?: number },
    maxSizeMB: number = 50
  ): ValidationResult {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
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

  // Hash password using bcrypt
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10; // Recommended salt rounds for bcrypt
    return bcrypt.hash(password, saltRounds);
  }

  // Verify password against hash using bcrypt
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generates a CSRF token
   * @param {string} sessionId - The user's session ID
   * @returns {string} - The generated CSRF token
   */
  generateCsrfToken(sessionId: string): string {
    const csrfSecret = (process.env.CSRF_SECRET || 'default-csrf-secret-for-development-only-please-change') as string;
    const hmac = crypto.createHmac('sha256', csrfSecret);
    hmac.update(sessionId);
    return hmac.digest('hex');
  }

  /**
   * Validates a CSRF token
   * @param {string} token - The CSRF token to validate
   * @param {string} sessionId - The user's session ID
   * @returns {boolean} - Whether the token is valid
   */
  validateCsrfToken(token: string, sessionId: string): boolean {
    const expectedToken = this.generateCsrfToken(sessionId);
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
  }

  /**
   * Encrypts sensitive data
   * @param {string} data - The data to encrypt
   * @returns {string} - The encrypted data
   */
  encryptData(data: string): string {
    const algorithm = 'aes-256-cbc';
    const encryptionKey = (process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars-long-for-dev') as string;
    const key = Buffer.from(encryptionKey, 'utf8');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypts encrypted data
   * @param {string} encryptedData - The encrypted data to decrypt
   * @returns {string} - The decrypted data
   */
  decryptData(encryptedData: string): string {
    const algorithm = 'aes-256-cbc';
    const encryptionKey = (process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars-long-for-dev') as string;
    const key = Buffer.from(encryptionKey, 'utf8');

    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    const iv = Buffer.from(parts[0] as string, 'hex');
    const encrypted = parts[1] as string;

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generates security headers for HTTP responses
   * @returns {object} - The security headers
   */
  getSecurityHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-XSS-Protection': '1; mode=block',
      'X-Permitted-Cross-Domain-Policies': 'none',
    };
  }

  // Create audit log entry
  createAuditLog(
    userId: string,
    action: string,
    resource: string,
    details: Record<string, any> = {}
  ): AuditLogEntry {
    return {
      timestamp: new Date().toISOString(),
      userId: userId,
      action: action,
      resource: resource,
      details: details,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
    };
  }
}
