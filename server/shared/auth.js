import { supabase } from '../shared/supabaseClient.js';
import { applicationInsights } from './logging.js';

class AuthService {
    constructor() {
        this.client = supabase;
    }

    extractTokenFromHeader(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('No valid authorization header found');
        }
        return authHeader.substring(7);
    }

    async verifyToken(token) {
        try {
            const { data: { user }, error } = await this.client.auth.getUser(token);
            
            if (error || !user) {
                throw new Error('Invalid token');
            }

            // Get additional user data from our users table
            const { data: userData, error: userError } = await this.client
                .from('users')
                .select('*')
                .eq('auth_user_id', user.id)
                .single();

            if (userError) {
                throw new Error('Failed to get user data');
            }

            return {
                ...userData,
                auth: user
            };
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw new Error('Token verification failed');
        }
    }

    async authenticateRequest(req) {
        try {
            const authHeader = req.headers.authorization;
            const token = this.extractTokenFromHeader(authHeader);
            const userData = await this.verifyToken(token);
            return userData;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw new Error('Authentication failed');
        }
    }

    async signUp(userData) {
        try {
            const { data: authData, error: authError } = await this.client.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        first_name: userData.firstName,
                        last_name: userData.lastName
                    }
                }
            });

            if (authError) throw authError;

            // User profile will be created automatically via database trigger
            return authData;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async signIn(email, password) {
        try {
            const { data, error } = await this.client.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    async signOut(token) {
        try {
            const { error } = await this.client.auth.signOut();
            if (error) throw error;
            return true;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    canAccessProject(user, project) {
        return project.created_by === user.id || 
               project.assigned_to.includes(user.id) ||
               user.role === 'admin';
    }
}

export default AuthService;