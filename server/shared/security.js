// Security utilities and middleware for Esus Audit AI
const { supabase } = require('../shared/supabaseClient');
const { applicationInsights } = require('./logging');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

class SecurityService {
    constructor() {
        this.maxLoginAttempts = 5;
        this.lockoutDuration = 15 * 60 * 1000; // 15 minutes

        this.EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        this.NAME_REGEX = /^[A-Za-z\s'-]{2,50}$/;
        this.PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    }

    // Rate limiting configuration
    createRateLimit(windowMs = 15 * 60 * 1000, max = 100) {
        return rateLimit({
            windowMs: windowMs,
            max: max,
            message: {
                error: 'Too many requests from this IP, please try again later.'
            },
            standardHeaders: true,
            legacyHeaders: false,
        });
    }

    // Helmet security headers configuration
    getHelmetConfig() {
        return helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    scriptSrc: ["'self'"],
                    connectSrc: ["'self'", "https://*.azure.com", "https://*.azurewebsites.net"],
                },
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        });
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
            const { data: user, error } = await supabase
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
            applicationInsights.trackException({ exception: error });
            return { allowed: true }; // Fail open for usability
        }
    }

    async recordFailedLogin(email) {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('failed_login_attempts')
                .eq('email', email)
                .single();

            if (error || !user) return;

            const attempts = (user.failed_login_attempts || 0) + 1;
            const updates = {
                failed_login_attempts: attempts
            };

            // Lock account after 5 failed attempts
            if (attempts >= 5) {
                const lockoutDuration = 30 * 60 * 1000; // 30 minutes
                updates.locked_until = new Date(Date.now() + lockoutDuration).toISOString();
            }

            await supabase
                .from('users')
                .update(updates)
                .eq('email', email);
        } catch (error) {
            applicationInsights.trackException({ exception: error });
        }
    }

    async clearLoginAttempts(email) {
        try {
            await supabase
                .from('users')
                .update({
                    failed_login_attempts: 0,
                    locked_until: null
                })
                .eq('email', email);
        } catch (error) {
            applicationInsights.trackException({ exception: error });
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
        const crypto = require('crypto');
        return crypto.randomBytes(length).toString('hex');
    }

    // Hash sensitive data
    hashData(data) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    // Audit log entry
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

module.exports = SecurityService;
