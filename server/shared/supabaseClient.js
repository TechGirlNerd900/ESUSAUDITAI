// server/shared/supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import { applicationInsights } from './logging.js';
import { validateSupabaseConfig } from '../utils/envValidator.js';
import dotenv from 'dotenv';

// Load environment variables if not already loaded
dotenv.config();
dotenv.config({ path: '../../.env' });

// Validate Supabase configuration
validateSupabaseConfig();

// Create Supabase client factory for server-side use
export const createServerSupabaseClient = (accessToken = null, refreshToken = null) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Use anon key for user-scoped operations

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Supabase URL or Anon Key is missing. Check your .env file in the server directory.');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: false, // CRITICAL: Do not let the server client manage session automatically
        },
        db: {
            schema: 'public'
        },
        global: {
            headers: {
                'x-application-name': 'esus-audit-ai-server'
            }
        }
    });

    // If tokens are provided, set the session. This is typically done in middleware.
    if (accessToken && refreshToken) {
        supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        }).catch(error => {
            console.error("Error setting session on server client:", error);
        });
    }

    return supabase;
};

// Legacy service role client for admin operations only
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: false
        },
        db: {
            schema: 'public'
        },
        global: {
            headers: {
                'x-application-name': 'esus-audit-ai-server-admin'
            }
        }
    }
);

// Setup monitoring and error tracking
supabase.auth.onAuthStateChange((event, session) => {
    applicationInsights.trackEvent({
        name: 'SupabaseAuthStateChange',
        properties: {
            event,
            userId: session?.user?.id
        }
    });
});

// Set up error handling for realtime subscriptions (disabled in development)
if (process.env.NODE_ENV === 'production') {
    const channel = supabase.channel('system');
    channel
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Connected to Supabase realtime');
            }
            if (status === 'CLOSED') {
                applicationInsights.trackEvent({
                    name: 'SupabaseRealtimeDisconnected',
                    properties: {
                        status
                    }
                });
            }
            if (status === 'CHANNEL_ERROR') {
                applicationInsights.trackException({
                    exception: new Error('Supabase realtime channel error'),
                    properties: {
                        component: 'SupabaseRealtime',
                        status
                    }
                });
            }
        });
}

// Health check function
export const checkSupabaseConnection = async () => {
    try {
        const { data, error } = await supabase
            .from('health_check')
            .select('id')
            .limit(1);
            
        if (error) throw error;
        return true;
    } catch (error) {
        applicationInsights.trackException({
            exception: error,
            properties: {
                operation: 'checkSupabaseConnection'
            }
        });
        return false;
    }
};

export { supabase };
