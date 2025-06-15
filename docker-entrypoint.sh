#!/bin/sh
set -e

# Production startup script for Esus Audit AI

echo "🚀 Starting Esus Audit AI in production mode..."

# Validate environment variables
echo "📋 Validating environment configuration..."
cd /app/server
node -e "
const { validateEnvOrExit } = await import('./utils/envValidator.js');
try {
    validateEnvOrExit();
    console.log('✅ Environment validation passed');
} catch (error) {
    console.error('❌ Environment validation failed:', error.message);
    process.exit(1);
}
"

# Wait for database to be ready
echo "🔌 Checking database connectivity..."
timeout=60
while [ $timeout -gt 0 ]; do
    if node -e "
    const { supabase } = await import('./shared/supabaseClient.js');
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
        console.error('Database not ready:', error.message);
        process.exit(1);
    } else {
        console.log('✅ Database connection established');
        process.exit(0);
    }
    "; then
        break
    fi
    echo "⏳ Waiting for database... ($timeout seconds remaining)"
    sleep 5
    timeout=$((timeout - 5))
done

if [ $timeout -le 0 ]; then
    echo "❌ Database connection timeout. Exiting."
    exit 1
fi

# Run any production setup tasks
echo "⚙️  Running production setup..."

# Create necessary directories (if not read-only)
if [ -w "/app" ]; then
    mkdir -p logs temp uploads reports
    chmod 755 logs temp uploads reports
else
    echo "⚠️  Running in read-only mode, using tmpfs mounts"
fi

echo "🌟 Starting server..."

# Start the application with proper process management
exec node server.js