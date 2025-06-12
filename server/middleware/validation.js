import { body, param, query, validationResult } from 'express-validator';
import { applicationInsights } from '../shared/logging.js';

// Validation error handler
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const errorDetails = errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value
        }));

        applicationInsights.trackEvent({
            name: 'ValidationError',
            properties: {
                path: req.path,
                method: req.method,
                errors: JSON.stringify(errorDetails),
                ip: req.ip
            }
        });

        return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: errorDetails
        });
    }
    
    next();
};

// Common validation rules
export const commonValidations = {
    email: body('email')
        .isEmail()
        .normalizeEmail()
        .isLength({ max: 254 })
        .withMessage('Valid email is required (max 254 characters)'),
    
    password: body('password')
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be 8-128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
    name: (field) => body(field)
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage(`${field} must be 1-100 characters`)
        .matches(/^[a-zA-Z\s\-'\.]+$/)
        .withMessage(`${field} can only contain letters, spaces, hyphens, apostrophes, and periods`),
    
    company: body('company')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Company name must not exceed 200 characters')
        .matches(/^[a-zA-Z0-9\s\-'\.&,]+$/)
        .withMessage('Company name contains invalid characters'),
    
    uuid: (field, location = 'param') => {
        const validator = location === 'param' ? param(field) : body(field);
        return validator
            .isUUID(4)
            .withMessage(`${field} must be a valid UUID`);
    },
    
    projectName: body('name')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Project name must be 1-200 characters')
        .matches(/^[a-zA-Z0-9\s\-_\.]+$/)
        .withMessage('Project name can only contain letters, numbers, spaces, hyphens, underscores, and periods'),
    
    description: body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description must not exceed 1000 characters'),
    
    auditType: body('auditType')
        .isIn(['financial', 'compliance', 'security', 'operational', 'custom'])
        .withMessage('Audit type must be one of: financial, compliance, security, operational, custom'),
    
    status: body('status')
        .optional()
        .isIn(['active', 'completed', 'archived', 'draft'])
        .withMessage('Status must be one of: active, completed, archived, draft'),
    
    pagination: [
        query('page')
            .optional()
            .isInt({ min: 1, max: 10000 })
            .withMessage('Page must be a positive integer (max 10000)'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        query('sortBy')
            .optional()
            .isIn(['created_at', 'updated_at', 'name', 'status'])
            .withMessage('Sort field must be one of: created_at, updated_at, name, status'),
        query('sortOrder')
            .optional()
            .isIn(['asc', 'desc'])
            .withMessage('Sort order must be asc or desc')
    ]
};

// Auth validation schemas
export const validateRegister = [
    commonValidations.email,
    commonValidations.password,
    commonValidations.name('firstName'),
    commonValidations.name('lastName'),
    commonValidations.company,
    handleValidationErrors
];

export const validateLogin = [
    commonValidations.email,
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    handleValidationErrors
];

export const validatePasswordReset = [
    commonValidations.email,
    handleValidationErrors
];

export const validatePasswordChange = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    commonValidations.password.withMessage('New password must meet security requirements'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Password confirmation does not match');
            }
            return true;
        }),
    handleValidationErrors
];

// Project validation schemas
export const validateCreateProject = [
    commonValidations.projectName,
    commonValidations.description,
    commonValidations.auditType,
    body('client')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Client name must not exceed 200 characters'),
    body('dueDate')
        .optional()
        .isISO8601()
        .withMessage('Due date must be a valid ISO 8601 date'),
    handleValidationErrors
];

export const validateUpdateProject = [
    commonValidations.uuid('projectId'),
    commonValidations.projectName.optional(),
    commonValidations.description,
    commonValidations.status,
    body('dueDate')
        .optional()
        .isISO8601()
        .withMessage('Due date must be a valid ISO 8601 date'),
    handleValidationErrors
];

// Document validation schemas
export const validateDocumentUpload = [
    commonValidations.uuid('projectId'),
    body('documentType')
        .optional()
        .isIn(['financial_statement', 'invoice', 'contract', 'report', 'other'])
        .withMessage('Document type must be valid'),
    handleValidationErrors
];

// File validation middleware
export const validateFileUpload = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({
            error: 'File is required',
            code: 'MISSING_FILE'
        });
    }

    const allowedMimeTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
        applicationInsights.trackEvent({
            name: 'InvalidFileUpload',
            properties: {
                filename: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                ip: req.ip,
                userId: req.user?.id
            }
        });

        return res.status(400).json({
            error: 'File type not allowed',
            code: 'INVALID_FILE_TYPE',
            allowedTypes: allowedMimeTypes
        });
    }

    const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 52428800; // 50MB
    if (req.file.size > maxSize) {
        return res.status(400).json({
            error: 'File size exceeds limit',
            code: 'FILE_TOO_LARGE',
            maxSize: maxSize,
            actualSize: req.file.size
        });
    }

    // Sanitize filename
    const sanitizedFilename = req.file.originalname
        .replace(/[^a-zA-Z0-9\.\-_]/g, '_')
        .substring(0, 255);
    
    req.file.sanitizedName = sanitizedFilename;
    
    next();
};

// Chat message validation
export const validateChatMessage = [
    commonValidations.uuid('projectId'),
    body('message')
        .trim()
        .isLength({ min: 1, max: 5000 })
        .withMessage('Message must be 1-5000 characters')
        .matches(/^[^<>]+$/)
        .withMessage('Message contains invalid characters'),
    handleValidationErrors
];

// Report validation
export const validateGenerateReport = [
    commonValidations.uuid('projectId'),
    body('reportName')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Report name must be 1-200 characters'),
    body('includeCharts')
        .optional()
        .isBoolean()
        .withMessage('Include charts must be a boolean'),
    body('sections')
        .optional()
        .isArray()
        .withMessage('Sections must be an array'),
    handleValidationErrors
];

// Generic sanitization middleware
export const sanitizeInput = (req, res, next) => {
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        return str
            .trim()
            .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .substring(0, 10000); // Limit length
    };

    const sanitizeObject = (obj) => {
        if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        } else if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    sanitized[key] = sanitizeObject(obj[key]);
                }
            }
            return sanitized;
        } else if (typeof obj === 'string') {
            return sanitizeString(obj);
        }
        return obj;
    };

    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    next();
};

export default {
    handleValidationErrors,
    commonValidations,
    validateRegister,
    validateLogin,
    validatePasswordReset,
    validatePasswordChange,
    validateCreateProject,
    validateUpdateProject,
    validateDocumentUpload,
    validateFileUpload,
    validateChatMessage,
    validateGenerateReport,
    sanitizeInput
};