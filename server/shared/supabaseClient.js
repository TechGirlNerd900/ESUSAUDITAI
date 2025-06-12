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

// Create Supabase client with service role key for backend operations
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
                'x-application-name': 'esus-audit-ai-server'
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

// Set up error handling for realtime subscriptions
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
