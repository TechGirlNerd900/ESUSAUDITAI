import { supabase } from '../shared/supabaseClient.js';
import { applicationInsights } from './logging.js';

class Database {
    constructor() {
        // Supabase client is already initialized in app.js thid
        this.client = supabase;
    }

    // User operations
    async createUser(userData) {
        const { email, passwordHash, firstName, lastName, role, company } = userData;
        
        try {
            const { data, error } = await this.client
                .from('users')
                .insert([{
                    email,
                    password_hash: passwordHash,
                    first_name: firstName,
                    last_name: lastName,
                    role,
                    company
                }])
                .select('id, email, first_name, last_name, role, company, created_at')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            applicationInsights.trackException({ exception: error });
            throw error;
        }
    }

    // [rest of methods remain the same]
}

export default Database;