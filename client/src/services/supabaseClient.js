// src/services/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Environment variables from Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables:');
    if (!supabaseUrl) console.error('VITE_SUPABASE_URL is not defined');
    if (!supabaseAnonKey) console.error('VITE_SUPABASE_ANON_KEY is not defined');
    throw new Error('Supabase configuration is incomplete');
}

// Create Supabase client - automatically handles session persistence for browser
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true, // ✅ Correct for client-side
        detectSessionInUrl: true
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'x-application-name': 'esus-audit-ai-client'
        }
    }
});

// Setup real-time subscriptions
export const setupRealtimeSubscriptions = (userId) => {
    // Projects subscription
    const projectsSubscription = supabase
        .channel('projects-channel')
        .on('postgres_changes', 
            {
                event: '*',
                schema: 'public',
                table: 'projects',
                filter: `created_by=eq.${userId}`
            },
            (payload) => {
                console.log('Projects change received:', payload);
            }
        )
        .on('error', (error) => {
            console.error('Projects channel error:', error);
        })
        .subscribe();

    // Documents subscription
    const documentsSubscription = supabase
        .channel('documents-channel')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'documents'
            },
            (payload) => {
                console.log('Documents change received:', payload);
            }
        )
        .on('error', (error) => {
            console.error('Documents channel error:', error);
        })
        .subscribe();

    // Analysis results subscription
    const analysisSubscription = supabase
        .channel('analysis-channel')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'analysis_results'
            },
            (payload) => {
                console.log('Analysis change received:', payload);
            }
        )
        .on('error', (error) => {
            console.error('Analysis channel error:', error);
        })
        .subscribe();

    return {
        cleanup: () => {
            projectsSubscription.unsubscribe();
            documentsSubscription.unsubscribe();
            analysisSubscription.unsubscribe();
        }
    };
};

// Add error logging for development
if (import.meta.env.DEV) {
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('Supabase auth event:', event, session);
    });

    // Note: realtime error handling is now done per channel subscription
    // Individual channels handle their own error states
}

// Test connection and log status
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        console.log('Connected to Supabase as:', session.user.email);
    } else if (event === 'SIGNED_OUT') {
        console.log('Disconnected from Supabase');
    }
});

export default supabase;
