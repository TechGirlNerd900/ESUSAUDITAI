const { supabase } = require('../shared/supabaseClient');
const { applicationInsights } = require('./logging');

class AuthService {
    constructor() {
        // No constructor needed as we're using Supabase
    }

    extractTokenFromHeader(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('No valid authorization header found');
        }
        return authHeader.substring(7);
    }

    async verifyToken(token) {
        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (error || !user) {
                throw new Error('Invalid token');
            }

            return user;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw new Error('Token verification failed');
        }
    }

    async authenticateRequest(req) {
        try {
            const authHeader = req.headers.authorization;
            const token = this.extractTokenFromHeader(authHeader);
            const user = await this.verifyToken(token);

            const { data: userData, error } = await supabase
                .from('users')
                .select('id, email, first_name, last_name, role, company')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            return this.sanitizeUser(userData);
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw new Error('Authentication failed');
        }
    }

    // Role-based authorization
    authorizeRole(user, allowedRoles) {
        if (!user || !user.role || !allowedRoles.includes(user.role)) {
            throw new Error('Insufficient permissions');
        }
        return true;
    }

    canAccessProject(user, project) {
        try {
            // Admin can access all projects
            if (user.role === 'admin') {
                return true;
            }

            // Project creator can access
            if (project.created_by === user.id) {
                return true;
            }

            // Assigned users can access
            if (project.assigned_to && project.assigned_to.includes(user.id)) {
                return true;
            }

            return false;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            return false;
        }
    }

    sanitizeUser(user) {
        const { password_hash, failed_login_attempts, locked_until, ...sanitizedUser } = user;
        return sanitizedUser;
    }
}

module.exports = AuthService;
