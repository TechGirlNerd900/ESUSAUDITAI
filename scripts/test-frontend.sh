#!/bin/bash

# Frontend Testing Script for Esus Audit AI
# This script helps test the frontend components with and without Azure services

set -e

echo "🚀 Esus Audit AI Frontend Testing"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "nextjs/package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Change to nextjs directory
cd nextjs

print_status "Checking Node.js and npm versions..."
node --version
npm --version

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_warning "node_modules not found. Installing dependencies..."
    npm install
else
    print_success "Dependencies already installed"
fi

# Check for environment variables
print_status "Checking environment configuration..."

if [ -f ".env.local" ]; then
    print_success "Local environment file found"
    print_status "Using Next.js environment configuration"
elif [ -f "../.env" ]; then
    print_success "Root environment file found"
    print_status "Using root environment configuration"
else
    print_warning "No environment file found. Creating local configuration..."
    cat > .env.local << EOF
# Esus Audit AI Next.js Local Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
EOF
    print_success "Local .env.local file created"
    print_warning "Please update .env.local with your actual Supabase credentials"
fi

# Function to test in development mode
test_demo_mode() {
    print_status "Testing in Development Mode..."
    
    print_status "Starting Next.js development server..."
    print_warning "The server will start with your configured environment"
    print_warning "Press Ctrl+C to stop the server"
    print_status "Server will be available at http://localhost:3000"
    
    # Start the dev server
    npm run dev
}

# Function to test with API mode
test_api_mode() {
    print_status "Testing with Full API Mode..."
    
    # Check if environment variables are set
    if [ -f ".env.local" ] && grep -q "NEXT_PUBLIC_SUPABASE_URL=your_supabase_url" .env.local; then
        print_error "Environment variables not configured!"
        print_status "Please update .env.local with your actual Supabase credentials"
        return 1
    fi
    
    print_status "Starting Next.js development server with full API..."
    print_warning "Press Ctrl+C to stop the server"
    
    # Start the dev server
    npm run dev
}

# Function to run linting and type checking
test_code_quality() {
    print_status "Running code quality checks..."
    
    # Check if ESLint is configured
    if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f "eslint.config.js" ]; then
        print_status "Running ESLint..."
        npm run lint 2>/dev/null || print_warning "ESLint not configured or failed"
    else
        print_warning "ESLint not configured"
    fi
    
    # Check for TypeScript
    if [ -f "tsconfig.json" ]; then
        print_status "Running TypeScript checks..."
        npx tsc --noEmit 2>/dev/null || print_warning "TypeScript check failed"
    else
        print_status "TypeScript not configured (using JavaScript)"
    fi
    
    print_success "Code quality checks completed"
}

# Function to build for production
test_build() {
    print_status "Testing production build..."
    
    # Clean previous build
    rm -rf dist
    
    # Build the project
    npm run build
    
    if [ -d "dist" ]; then
        print_success "Production build successful"
        print_status "Build size:"
        du -sh dist
        
        # Optional: serve the build
        if command -v serve &> /dev/null; then
            print_status "Starting production server..."
            print_warning "Press Ctrl+C to stop the server"
            npx serve dist
        else
            print_warning "Install 'serve' to test the production build: npm install -g serve"
        fi
    else
        print_error "Production build failed"
        exit 1
    fi
}

# Main menu
show_menu() {
    echo ""
    print_status "Choose a testing option:"
    echo "1) Test in Development Mode (Next.js dev server)"
    echo "2) Test with Full API (requires Supabase setup)"
    echo "3) Run Code Quality Checks (lint, TypeScript)"
    echo "4) Test Production Build (Vercel-ready)"
    echo "5) Exit"
    echo ""
}

# Main loop
while true; do
    show_menu
    read -p "Enter your choice (1-5): " choice
    
    case $choice in
        1)
            test_demo_mode
            ;;
        2)
            test_api_mode
            ;;
        3)
            test_code_quality
            ;;
        4)
            test_build
            ;;
        5)
            print_success "Goodbye!"
            exit 0
            ;;
        *)
            print_error "Invalid option. Please choose 1-5."
            ;;
    esac
done
