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
if [ ! -f "client/package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

# Change to client directory
cd client

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

if [ -f ".env" ]; then
    print_success "Environment file found"
    if grep -q "VITE_DEMO_MODE=true" .env; then
        print_warning "Demo mode is enabled"
    else
        print_status "Production mode configured"
    fi
else
    print_warning "No .env file found. Creating demo configuration..."
    cat > .env << EOF
# Esus Audit AI Frontend Configuration
VITE_DEMO_MODE=true
VITE_API_BASE_URL=/api
EOF
    print_success "Demo .env file created"
fi

# Function to test in demo mode
test_demo_mode() {
    print_status "Testing in Demo Mode..."
    
    # Ensure demo mode is enabled
    if ! grep -q "VITE_DEMO_MODE=true" .env; then
        sed -i.bak 's/VITE_DEMO_MODE=.*/VITE_DEMO_MODE=true/' .env 2>/dev/null || echo "VITE_DEMO_MODE=true" >> .env
    fi
    
    print_status "Starting development server in demo mode..."
    print_warning "The server will start in demo mode with sample data"
    print_warning "Press Ctrl+C to stop the server"
    
    # Start the dev server
    npm run dev
}

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
    echo "1) Test in Demo Mode (with sample data)"
    echo "2) Test with Real API (requires Azure setup)"
    echo "3) Run Code Quality Checks"
    echo "4) Test Production Build"
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
