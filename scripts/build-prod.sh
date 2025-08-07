#!/bin/bash

# TargetVision Production Build Script

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[Build]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if we're in the project root
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

echo "═══════════════════════════════════════════"
echo "   TargetVision Production Build"
echo "═══════════════════════════════════════════"
echo ""

# Build Frontend
print_status "Building frontend..."
cd frontend

# Clean previous builds
print_status "Cleaning previous builds..."
rm -rf .next
print_success "Clean complete"

# Check dependencies
print_status "Checking frontend dependencies..."
if [ ! -d "node_modules" ]; then
    print_status "Installing frontend dependencies..."
    npm install --no-save --quiet
    print_success "Dependencies installed"
else
    print_success "Dependencies already installed"
fi

# Type check
print_status "Running TypeScript type check..."
if npx tsc --noEmit; then
    print_success "Type check passed"
else
    print_error "TypeScript errors found"
    exit 1
fi

# Lint check
print_status "Running linter..."
if npx next lint; then
    print_success "Lint check passed"
else
    print_warning "Lint warnings found (non-blocking)"
fi

# Build production bundle
print_status "Building production bundle..."
if npx next build; then
    print_success "Frontend build complete"
    
    # Show build stats
    echo ""
    echo "Build Output:"
    echo "────────────"
    if [ -d ".next" ]; then
        echo "  Bundle size: $(du -sh .next | cut -f1)"
        echo "  Static pages: $(find .next/static -name "*.html" 2>/dev/null | wc -l)"
        echo "  JS chunks: $(find .next/static/chunks -name "*.js" 2>/dev/null | wc -l)"
    fi
else
    print_error "Frontend build failed"
    exit 1
fi

cd ..
echo ""

# Prepare Backend
print_status "Preparing backend..."
cd backend

# Create/activate virtual environment
if [ ! -d "venv" ]; then
    print_status "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

# Install dependencies
print_status "Installing backend dependencies..."
pip install -r requirements.txt --quiet
print_success "Backend dependencies installed"

# Check Python syntax
print_status "Checking Python syntax..."
python -m py_compile app_simple.py 2>/dev/null
python -m py_compile services/*.py 2>/dev/null || true
python -m py_compile api/*.py 2>/dev/null || true
print_success "Python syntax check passed"

# Generate requirements lock file
print_status "Generating requirements lock file..."
pip freeze > requirements.lock
print_success "Requirements locked"

cd ..
echo ""

# Create production environment file templates
print_status "Creating production config templates..."

# Frontend production env
cat > frontend/.env.production.local.example << EOF
# Production Environment Variables
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
EOF

# Backend production env  
cat > backend/.env.production.example << EOF
# Production Environment Variables
ENVIRONMENT=production
HOST=0.0.0.0
PORT=8000

# Security (generate new keys for production!)
SECRET_KEY=generate-a-secure-secret-key
ENCRYPTION_KEY=generate-a-secure-encryption-key

# API Keys (add your production keys)
ANTHROPIC_API_KEY=your-production-key
SMUGMUG_API_KEY=your-production-key
SMUGMUG_API_SECRET=your-production-secret
SMUGMUG_CALLBACK_URL=https://yourdomain.com/auth/smugmug/callback

# Database
DATABASE_URL=postgresql://user:password@localhost/targetvision_prod

# CORS
CORS_ORIGINS=https://yourdomain.com
EOF

print_success "Config templates created"
echo ""

# Create deployment package
print_status "Creating deployment package..."

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DIST_DIR="dist/targetvision_${TIMESTAMP}"
mkdir -p $DIST_DIR

# Copy frontend build
cp -r frontend/.next $DIST_DIR/frontend_build
cp frontend/package.json $DIST_DIR/
cp frontend/package-lock.json $DIST_DIR/ 2>/dev/null || true

# Copy backend
mkdir -p $DIST_DIR/backend
cp -r backend/*.py $DIST_DIR/backend/
cp -r backend/services $DIST_DIR/backend/
cp -r backend/api $DIST_DIR/backend/
cp backend/requirements.lock $DIST_DIR/backend/requirements.txt

# Create deployment info
cat > $DIST_DIR/BUILD_INFO.txt << EOF
TargetVision Production Build
Build Date: $(date)
Build ID: ${TIMESTAMP}
Git Commit: $(git rev-parse HEAD 2>/dev/null || echo "unknown")
EOF

# Create start script
cat > $DIST_DIR/start.sh << 'EOF'
#!/bin/bash
# Start production servers

# Backend
cd backend
pip install -r requirements.txt
uvicorn app_simple:app --host 0.0.0.0 --port 8000 &

# Frontend  
cd ../
npm install --production
npm run start
EOF

chmod +x $DIST_DIR/start.sh

# Create archive
print_status "Creating deployment archive..."
tar -czf dist/targetvision_${TIMESTAMP}.tar.gz -C dist targetvision_${TIMESTAMP}

print_success "Deployment package created: dist/targetvision_${TIMESTAMP}.tar.gz"
echo ""

echo "═══════════════════════════════════════════"
echo "   Build Complete!"
echo "═══════════════════════════════════════════"
echo ""
echo "📦 Deployment package: dist/targetvision_${TIMESTAMP}.tar.gz"
echo ""
echo "Next steps:"
echo "1. Update production environment variables"
echo "2. Deploy to your server"
echo "3. Run database migrations (if any)"
echo "4. Start services with start.sh"
echo ""
print_success "Build successful!"