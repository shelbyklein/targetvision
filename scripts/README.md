# TargetVision Control Scripts

Complete management suite for the TargetVision application.

## 🚀 Quick Start

### Start Everything
```bash
./scripts/targetvision.sh start
```

### Stop Everything
```bash
./scripts/targetvision.sh stop
```

### Check Status
```bash
./scripts/targetvision.sh status
```

## 📚 Main Control Script

The main `targetvision.sh` script provides complete control:

```bash
./scripts/targetvision.sh [command]
```

### Commands

| Command | Description |
|---------|-------------|
| `start` | Start both backend and frontend servers |
| `stop` | Stop all servers |
| `restart` | Stop and restart all servers |
| `status` | Show server status with health checks |
| `test` | Run API test suite |
| `logs` | View server logs |
| `logs backend` | View only backend logs |
| `logs frontend` | View only frontend logs |
| `clean` | Stop servers and clean up temporary files |

## 🧪 Testing Scripts

### Quick Test
```bash
./scripts/quick_test.sh
```
Fast check to see if everything is running.

### Full API Test
```bash
./scripts/test_api.sh
```
Comprehensive test of all API endpoints including:
- Health check
- Photo upload with Claude analysis
- Chat functionality
- Search capabilities
- List photos

## 🛠️ Developer Tools

### Interactive Developer Menu
```bash
./scripts/dev.sh
```

Features:
1. Install/Update dependencies
2. Watch live logs
3. Monitor processes
4. Quick restart servers
5. Check API health
6. Open API documentation
7. Open web interface
8. Database status

## 🎯 Individual Scripts

### Start All
```bash
./scripts/start_all.sh
```

### Stop All
```bash
./scripts/stop_all.sh
```

## 📍 Default Ports

- **Backend API**: http://localhost:7050
- **API Documentation**: http://localhost:7050/docs
- **Frontend Web UI**: http://localhost:3000

## 🔧 Troubleshooting

### Servers won't start
```bash
# Check if ports are in use
lsof -i :7050  # Backend
lsof -i :3000  # Frontend

# Force stop and restart
./scripts/targetvision.sh clean
./scripts/targetvision.sh start
```

### View logs
```bash
# Real-time logs
./scripts/targetvision.sh logs

# Or use dev tool
./scripts/dev.sh
# Select option 2 or 3 for logs
```

### Test API is working
```bash
# Quick health check
curl http://localhost:7050/api/health

# Or run full test suite
./scripts/test_api.sh
```

## 📁 File Structure

```
scripts/
├── targetvision.sh    # Main control script
├── start_all.sh       # Start wrapper
├── stop_all.sh        # Stop wrapper
├── test_api.sh        # API test suite
├── quick_test.sh      # Quick status check
├── dev.sh             # Developer tools menu
└── README.md          # This file
```

## 🔒 Process Management

The scripts use PID files to track running processes:
- Backend PID: `.pids/backend.pid`
- Frontend PID: `.pids/frontend.pid`

Logs are stored in:
- Backend: `logs/backend.log`
- Frontend: `logs/frontend.log`

## 💡 Tips

1. **First time setup**: Run `./scripts/dev.sh` and select option 1 to install dependencies

2. **Development workflow**:
   ```bash
   ./scripts/targetvision.sh start   # Start servers
   ./scripts/dev.sh                  # Monitor in another terminal
   ```

3. **Testing changes**:
   ```bash
   ./scripts/targetvision.sh restart # Restart after code changes
   ./scripts/test_api.sh             # Test everything works
   ```

4. **Clean shutdown**:
   ```bash
   ./scripts/targetvision.sh clean   # Stop and clean up
   ```

## 🎨 Color Codes

The scripts use colors for clarity:
- 🟢 Green: Success
- 🔴 Red: Error
- 🟡 Yellow: In progress
- 🔵 Blue: Information
- ⚪ Cyan: Headers

## 🐛 Debug Mode

For verbose output, you can modify scripts to add debug:
```bash
set -x  # Add to top of script for debug output
```

Or run with bash debug:
```bash
bash -x ./scripts/targetvision.sh status
```