import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import crypto from 'crypto';

export class SecurityService {
    constructor(cookieStore) {
        this.client = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
    validateInput(value, type) {
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
    sanitizeString(input) {
        if (typeof input !== 'string') return '';
        
        return input
            .trim()
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .substring(0, 1000); // Limit length
    }

    async checkLoginAttempts(email) {
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
                const timeRemaining = Math.ceil((new Date(user.locked_until) - new Date()) / 1000 / 60);
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

    async recordFailedLogin(email) {
        try {
            const { data: user, error } = await this.client
                .from('users')
                .select('failed_login_attempts')
                .eq('email', email)
                .single();

            if (error || !user) return;

            const attempts = (user.failed_login_attempts || 0) + 1;
            const updates = {
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

    async clearLoginAttempts(email) {
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
    validateFileUpload(file, maxSizeMB = 50) {
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

        if (!allowedTypes.includes(file.mimetype)) {
            return { valid: false, error: 'File type not supported' };
        }

        const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
        if (file.size > maxSize) {
            return { valid: false, error: `File size must be less than ${maxSizeMB}MB` };
        }

        return { valid: true };
    }

    // Generate secure random tokens
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    // Hash sensitive data
    hashData(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    // Create audit log entry
    createAuditLog(userId, action, resource, details = {}) {
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