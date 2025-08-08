# TargetVision Development Guide

## 🚨 IMPORTANT: How to Run This Project

This is a **monorepo** containing both frontend (Next.js) and backend (Python/FastAPI) applications.

### ✅ Correct Way to Run

**ALWAYS run commands from the root directory:**

```bash
# From the project root (/targetvision)
npm run dev        # Starts BOTH frontend and backend
npm run build      # Builds for production
npm run start      # Starts production servers
npm run stop       # Stops all servers
```

### ❌ Do NOT Run These

```bash
# DO NOT run these commands:
cd frontend && npm run dev  # Wrong! This won't start the backend
cd backend && python app.py # Wrong! This won't start the frontend
```

## Project Structure

```
targetvision/
├── package.json          # 🎯 MAIN entry point - run commands here
├── frontend/            # Next.js application (port 3000)
│   └── package.json     # Internal use only - do not run directly
├── backend/             # Python FastAPI (port 7050)
│   └── app_simple.py    # Internal use only - do not run directly
└── scripts/             # Orchestration scripts
    ├── dev-start.sh     # Development startup script
    ├── build-prod.sh    # Production build script
    └── deploy.sh        # Deployment preparation
```

## Available Commands (Run from Root)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both servers in development mode |
| `npm run build` | Build for production |
| `npm run start` | Start production servers |
| `npm run stop` | Stop all running servers |
| `npm run setup` | Initial project setup |
| `npm run deploy` | Create deployment package |
| `npm run test` | Run tests |
| `npm run lint` | Run linters |
| `npm run clean` | Clean build artifacts |

## First Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/targetvision.git
cd targetvision

# 2. Run setup script
npm run setup

# 3. Configure environment variables
# Edit backend/.env with your API keys:
# - SMUGMUG_API_KEY
# - SMUGMUG_API_SECRET
# - ANTHROPIC_API_KEY or OPENAI_API_KEY

# 4. Start development server
npm run dev
```

## Development Workflow

1. **Always work from root directory**
2. **Use root npm scripts** for all operations
3. **Never run frontend or backend independently** (unless debugging)

## Deployment

```bash
# Build for production
npm run build

# Create deployment package
npm run deploy

# The dist/ folder contains everything needed for deployment
```

## URLs

When running `npm run dev`:
- Frontend: http://localhost:3000
- Backend API: http://localhost:7050
- API Docs: http://localhost:7050/docs

## Troubleshooting

### "Command not found" errors
- Make sure you're in the root directory
- Run `npm run setup` first

### Port already in use
- Run `npm run stop` to kill existing processes
- Or manually: `lsof -ti:3000 | xargs kill -9`

### Frontend/Backend not connecting
- Both must be started together using `npm run dev`
- Check that backend is running on port 7050
- Check that frontend .env.local has correct API URL

## Why This Structure?

- **Single command** starts everything
- **Coordinated startup** ensures proper initialization
- **Unified logging** for easier debugging
- **Consistent deployment** across environments

Remember: **Always run from root!** 🎯