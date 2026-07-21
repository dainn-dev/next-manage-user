# Parking Site Agent - Desktop Application

Desktop application for managing parking camera pipelines at site level.

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Rust (Tauri)
- **Camera Workers**: Python sidecars (reusing edge pipeline)

## Development

### Prerequisites

- Node.js 18+
- Rust 1.70+
- Python 3.9+ (for sidecars)

### Setup

```bash
cd desktop
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## Features

### Phase 2 (Current)
- ✅ Agent enrollment with one-time codes
- ✅ Secure credential storage
- ✅ Auto token refresh
- ✅ System tray integration
- ✅ Dashboard UI
- 🔄 Config sync (in progress)
- 🔄 Worker supervisor (in progress)
- 🔄 Camera preview (pending)

### Phase 3 (Planned)
- Python sidecar integration
- MJPEG preview server
- Health reporting
- Offline queue

## Directory Structure

```
desktop/
├── src/                    # React frontend
│   ├── features/
│   │   ├── enrollment/    # Enrollment screen
│   │   └── dashboard/     # Main dashboard
│   ├── components/        # Reusable UI components
│   └── lib/               # Utilities
├── src-tauri/             # Rust backend
│   └── src/
│       ├── auth/          # Authentication & credentials
│       ├── config/        # Config sync
│       ├── supervisor/    # Worker management
│       └── health/        # Health tracking
└── sidecars/              # Python camera workers
```

## Security

- Credentials stored in OS keyring (Windows Credential Manager)
- JWT tokens with auto-refresh
- RTSP passwords encrypted in transit
- No secrets in logs or command line

## Configuration

Default API URL: `http://localhost:8080`

Configure in enrollment screen or via environment:
```bash
export AGENT_API_URL=https://api.example.com
```
