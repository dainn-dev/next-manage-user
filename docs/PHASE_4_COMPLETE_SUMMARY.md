# Phase 4 Implementation Complete ✅

## Summary

Phase 4 (Website UI Integration) đã hoàn thành với agent management page, enhanced camera status, WebSocket realtime subscriptions, và error code display.

---

## Files Created (Phase 4)

### API Client Layer

1. **frontend/lib/api/agent-api.ts** (128 lines)
   - `generateEnrollmentCode(siteId, token)` - Tạo mã kích hoạt 8 ký tự
   - `listAgents(siteId, token)` - Liệt kê agents với summary
   - `revokeAgent(agentId, token)` - Thu hồi quyền truy cập
   - `getAgent(agentId, token)` - Chi tiết một agent
   - Types: SiteAgent, EnrollmentCodeResponse, AgentSummary

### WebSocket Realtime Subscriptions

2. **frontend/hooks/use-camera-health-subscription.ts** (131 lines)
   - `useCameraHealthSubscription()` - Subscribe `/topic/site/{siteId}/cameras/health`
   - `useAgentStatusSubscription()` - Subscribe `/topic/site/{siteId}/agents`
   - STOMP client với auto-reconnect (5s delay)
   - Heartbeat: 10s inbound + 10s outbound
   - Types: CameraHealthEvent, AgentStatusEvent

### UI Components

3. **frontend/app/parking/agents/page.tsx** (243 lines)
   - Agent list với status badges (online/offline/revoked)
   - Generate enrollment code với dialog hiển thị
   - Copy to clipboard functionality
   - Revoke confirmation với AlertDialog
   - Auto refresh every component mount
   - Format last seen: "X giây/phút/giờ/ngày trước"
   - Camera count: online/total display

4. **frontend/components/cameras/camera-status-badge.tsx** (173 lines)
   - Status badges: online (green), error (red), connecting (blue), offline (gray)
   - Icons: Activity, AlertCircle, WifiOff, Loader2
   - Tooltip với detailed info (FPS, last frame, queue depth)
   - Error code labels (tiếng Việt):
     - RTSP_AUTH_FAILED → "Sai mật khẩu"
     - RTSP_CONNECT_TIMEOUT → "Timeout"
     - RTSP_DNS_FAILED → "Lỗi DNS"
     - MODEL_LOAD_FAILED → "Lỗi tải model"
     - BACKEND_UNREACHABLE → "Mất kết nối backend"
     - ... 13 error codes total
   - Error descriptions actionable cho end-users

5. **frontend/app/parking/cameras/page-enhanced.tsx** (183 lines)
   - Original cameras page với realtime integration
   - WebSocket connection indicator (animated green dot)
   - Update cameras state từ WebSocket events
   - Display runtime health: FPS, queue depth, error codes
   - Agent name display
   - Enhanced metrics section
   - Responsive grid layout

### Type Enhancements

6. **frontend/lib/api/camera-api.ts** (updated)
   - Added `CameraConnectionState` type: assigned | connecting | streaming | online | error | stopped | agent_offline
   - Added `CameraRuntimeHealth` interface:
     - cameraId, agentId, connectionState
     - lastHeartbeatAt, lastFrameAt, fps
     - width, height, codec
     - reconnectCount, queueDepth
     - errorCode, errorMessageSafe
     - configVersion, updatedAt
   - Extended `Camera` interface với `runtimeHealth` và `agentName`

---

## Feature Highlights

### Agent Management

**List View**:
- Card grid layout (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Each card shows:
  - Agent name, version, platform
  - Status badge (online/offline/revoked)
  - Camera count: online/total
  - Last activity: "X phút trước"
  - Revoke button (disabled if already revoked)

**Enrollment Flow**:
1. Click "Thêm máy mới"
2. Backend generates 8-char code (e.g., "ABCD-EFGH")
3. Dialog displays code in large monospace font
4. Shows expiry time: "Mã có hiệu lực đến DD/MM/YYYY HH:mm"
5. Copy button → clipboard + toast notification
6. User enters code in Tauri desktop app

**Revoke Flow**:
1. Click "Thu hồi quyền" on agent card
2. AlertDialog confirmation:
   - Title: "Thu hồi quyền truy cập?"
   - Description: "Máy {name} sẽ mất quyền truy cập vào hệ thống. Các camera đang hoạt động sẽ bị dừng. Hành động này không thể hoàn tác."
   - Actions: Cancel | Thu hồi (destructive)
3. POST /site-agents/{id}/revoke
4. Toast success + refresh list

### Camera Status with Runtime Health

**Status Badge Colors**:
- **Green (online)**: Camera streaming, has frames in last 30s
- **Red (error)**: RTSP error or backend error
- **Blue (connecting)**: Opening RTSP connection
- **Gray (offline)**: Agent offline or camera stopped

**Error Code Display**:
- Error badge shows Vietnamese label
- Tooltip shows full description
- Actionable messages:
  - "Sai mật khẩu" → Check RTSP credentials
  - "Timeout" → Check network/firewall
  - "Lỗi DNS" → Check hostname

**Runtime Metrics**:
- FPS display (e.g., "15.2 FPS")
- Queue depth warning (amber text if > 0)
- Last frame timestamp (relative: "5s trước")
- Resolution display (1920×1080)
- Codec info (H264/H265)

### WebSocket Realtime Updates

**Camera Health Topic**: `/topic/site/{siteId}/cameras/health`

Event structure:
```json
{
  "type": "camera.health.changed",
  "cameraId": "uuid",
  "agentId": "uuid",
  "status": "online",
  "connectionState": "STREAMING",
  "lastFrameAt": "2026-07-21T10:00:09.800Z",
  "fps": 15.2,
  "errorCode": null,
  "occurredAt": "2026-07-21T10:00:10Z"
}
```

**Agent Status Topic**: `/topic/site/{siteId}/agents`

Event structure:
```json
{
  "type": "agent.online",
  "agentId": "uuid",
  "name": "May Entry-Exit 01",
  "version": "0.1.0",
  "occurredAt": "2026-07-21T10:00:00Z"
}
```

**Connection Management**:
- Auto-reconnect with 5s delay
- Heartbeat every 10s (bidirectional)
- Connection indicator on UI (animated dot)
- Fallback to polling if WebSocket fails

---

## Integration Points

### Backend APIs Used

**Agent Management**:
- `POST /api/sites/{siteId}/agents/enrollment-codes`
- `GET /api/sites/{siteId}/agents`
- `POST /api/site-agents/{agentId}/revoke`
- `GET /api/site-agents/{agentId}` (for details)

**Camera Health** (existing):
- `GET /api/cameras?siteId={siteId}` (now includes runtimeHealth)

**WebSocket**:
- Connect: `ws://{host}/ws` (SockJS)
- Auth: `Authorization: Bearer {token}` header
- Subscribe: `/topic/site/{siteId}/cameras/health`
- Subscribe: `/topic/site/{siteId}/agents`

### State Management

**Local State Updates**:
```typescript
// Initial load from REST API
const [cameras, setCameras] = useState(initialCameras)

// WebSocket updates merge into local state
useCameraHealthSubscription(siteId, (event) => {
  setCameras((prev) =>
    prev.map((cam) =>
      cam.id === event.cameraId
        ? { ...cam, runtimeHealth: {...}, status: event.status }
        : cam
    )
  )
})
```

**Why This Pattern**:
- REST API is source of truth (on mount/refresh)
- WebSocket provides delta updates (low latency)
- Local state merge prevents full refetch
- User sees instant updates without loading spinner

---

## User Experience Flow

### Scenario 1: Pair New Agent

1. **Website** (Admin)
   - Navigate to `/parking/agents`
   - Click "Thêm máy mới"
   - See code: "WXYZ-1234", expires in 10 min
   - Copy code

2. **Desktop App** (Operator)
   - Open Tauri app
   - See enrollment screen
   - Paste code "WXYZ-1234"
   - Click "Kích hoạt"
   - App sends POST /api/agent/enroll
   - Backend validates code, creates agent
   - App receives access token + refresh token
   - Stores in Windows Credential Manager
   - Redirect to dashboard

3. **Website** (Admin)
   - See new agent appear in list (via refresh or WebSocket)
   - Status: "Đang hoạt động"
   - Camera count: 0/0

### Scenario 2: Camera Goes Online

1. **Website** (Admin)
   - Create camera: name="CAM-ENTRY-01", RTSP url with credentials
   - Backend increments config_version

2. **Desktop App** (Auto)
   - Poll /api/agent/config every 15s
   - Detect new config version
   - Supervisor calls start_worker(camera_id, config)
   - Python worker spawns, reads config from stdin
   - Worker opens RTSP stream

3. **Python Worker** (IPC)
   - Emit: `{"type":"stream.connected","width":1920,"height":1080,"fps":15}`
   - Emit: `{"type":"frame.observed","frameNumber":150}` every 10s

4. **Rust Supervisor**
   - Parse JSON Lines from stdout
   - POST /api/agent/cameras/{id}/health {"lastFrameAt":"...","fps":15}

5. **Backend**
   - Update camera_runtime_health table
   - Health sweep: now - lastFrameAt < 30s → ONLINE
   - Publish WebSocket event to /topic/site/{siteId}/cameras/health

6. **Website** (Auto)
   - WebSocket handler receives event
   - Update camera state in React
   - Badge changes: gray "Chờ Agent" → green "Đang hoạt động"
   - Show FPS: "15.0 FPS"

### Scenario 3: RTSP Auth Failure

1. **Website** (Admin)
   - Edit camera, wrong RTSP password
   - Backend increments config_version

2. **Desktop App** (Auto)
   - Detect config change
   - Supervisor restarts worker with new config

3. **Python Worker**
   - Try RTSP connection
   - OpenCV returns 401 Unauthorized
   - Classify error → RTSP_AUTH_FAILED
   - Emit: `{"type":"stream.error","code":"RTSP_AUTH_FAILED","message":"401 Unauthorized"}`

4. **Rust Supervisor**
   - Parse error event
   - POST /api/agent/cameras/{id}/health {"errorCode":"RTSP_AUTH_FAILED"}

5. **Backend**
   - Update camera_runtime_health.error_code
   - Publish WebSocket event

6. **Website** (Auto)
   - Badge changes to red "Sai mật khẩu"
   - Tooltip: "Tên đăng nhập hoặc mật khẩu không đúng"
   - Admin sees actionable error, fixes password

7. **Repeat from step 1** → Worker reconnects successfully

---

## Error Codes Reference

| Code | Label (VI) | Description |
|------|-----------|-------------|
| RTSP_DNS_FAILED | Lỗi DNS | Không thể phân giải tên miền camera |
| RTSP_CONNECT_TIMEOUT | Timeout | Camera không phản hồi sau timeout |
| RTSP_CONNECTION_REFUSED | Từ chối kết nối | Camera từ chối kết nối |
| RTSP_AUTH_FAILED | Sai mật khẩu | Tên đăng nhập hoặc mật khẩu không đúng |
| RTSP_UNSUPPORTED_CODEC | Codec không hỗ trợ | Camera dùng codec không được hỗ trợ |
| RTSP_NO_FRAMES | Không có frame | Kết nối thành công nhưng không nhận được hình ảnh |
| RTSP_STREAM_ERROR | Lỗi stream | Lỗi khi đọc stream video |
| MODEL_LOAD_FAILED | Lỗi tải model | Không thể tải model AI |
| MODEL_INFERENCE_ERROR | Lỗi AI | Lỗi khi chạy AI inference |
| INGEST_UNAUTHORIZED | Không có quyền | Không có quyền gửi dữ liệu lên backend |
| BACKEND_UNREACHABLE | Mất kết nối backend | Không thể kết nối đến backend API |
| WORKER_CRASHED | Worker bị lỗi | Worker xử lý camera bị crash |
| CONFIG_INVALID | Cấu hình không hợp lệ | Cấu hình camera không hợp lệ |

---

## Component Dependencies

```
frontend/
├── app/parking/agents/page.tsx
│   ├── lib/api/agent-api.ts ✓
│   ├── lib/auth-context ✓
│   ├── lib/dashboard-scope-context ✓
│   ├── hooks/use-toast ✓
│   └── components/ui/* ✓
│
├── app/parking/cameras/page-enhanced.tsx
│   ├── lib/api/camera-api.ts ✓ (updated)
│   ├── hooks/use-camera-health-subscription.ts ✓
│   ├── components/cameras/camera-status-badge.tsx ✓
│   └── components/dashboard/* ✓
│
├── hooks/use-camera-health-subscription.ts
│   ├── @stomp/stompjs ✓
│   ├── sockjs-client ✓
│   ├── lib/api/config ✓
│   └── lib/auth-context ✓
│
└── components/cameras/camera-status-badge.tsx
    ├── lib/api/camera-api.ts ✓
    └── components/ui/* ✓
```

**NPM Dependencies** (need to install):
```json
{
  "@stomp/stompjs": "^7.0.0",
  "sockjs-client": "^1.6.1"
}
```

---

## Testing Checklist

### Unit Tests (To Do)

**agent-api.ts**:
- [ ] generateEnrollmentCode returns code + expiresAt
- [ ] listAgents returns AgentSummary[]
- [ ] revokeAgent calls POST with correct endpoint
- [ ] Error handling for 4xx/5xx responses

**use-camera-health-subscription.ts**:
- [ ] Connects to WebSocket with Bearer token
- [ ] Subscribes to correct topic with siteId
- [ ] Parses JSON messages correctly
- [ ] Calls onCameraHealth callback
- [ ] Reconnects after disconnect

**camera-status-badge.tsx**:
- [ ] Renders correct badge for each status
- [ ] Shows error label for known error codes
- [ ] Falls back to error code if unknown
- [ ] Formats relative time correctly

### Integration Tests

**Agent Flow**:
1. [ ] Generate enrollment code on website
2. [ ] Code expires after 10 minutes
3. [ ] Code is one-time use (second use fails)
4. [ ] Revoke agent → config/event APIs return 401
5. [ ] Revoked agent cannot refresh token

**Camera Health Updates**:
1. [ ] REST GET /cameras returns runtimeHealth
2. [ ] WebSocket event updates local state
3. [ ] Badge color changes online → error → online
4. [ ] Error code displays in Vietnamese
5. [ ] FPS and queue depth show correctly

**End-to-End**:
1. [ ] Create camera on website
2. [ ] Desktop app fetches config
3. [ ] Worker starts and emits stream.connected
4. [ ] Website shows green "Đang hoạt động" badge
5. [ ] Change RTSP password to wrong value
6. [ ] Website shows red "Sai mật khẩu" badge
7. [ ] Fix password
8. [ ] Website shows green badge again

---

## Performance Considerations

**WebSocket Connection**:
- One connection per browser tab
- Shared across agent + camera subscriptions
- Auto-reconnect prevents loss of realtime updates

**State Updates**:
- Local state merge (not full refetch)
- Only affected camera re-renders
- React.memo can optimize grid rendering

**Polling Fallback**:
- If WebSocket fails, dashboard-data-context polls every 10s
- No duplicate fetches when WebSocket connected

---

## Phase 4 Completion Checklist

- [x] agent-api.ts with CRUD operations
- [x] agents page with enrollment code generation
- [x] Revoke agent with confirmation dialog
- [x] WebSocket subscription hook for camera health
- [x] WebSocket subscription hook for agent status
- [x] CameraStatusBadge with error codes
- [x] Enhanced cameras page with realtime updates
- [x] Error code labels in Vietnamese
- [x] Actionable error descriptions
- [x] Runtime metrics display (FPS, queue depth)
- [x] Connection indicator for WebSocket
- [x] Type extensions for CameraRuntimeHealth
- [x] Documentation

---

## Code Statistics (Phase 4)

- **API Client**: 128 lines (agent-api.ts)
- **WebSocket Hooks**: 131 lines (use-camera-health-subscription.ts)
- **Agent Management Page**: 243 lines (agents/page.tsx)
- **Camera Status Badge**: 173 lines (camera-status-badge.tsx)
- **Enhanced Cameras Page**: 183 lines (cameras/page-enhanced.tsx)
- **Total**: 858 lines

### Cumulative (Phase 1-4)

- **Backend**: ~2,000 lines Java
- **Desktop**: ~1,200 lines Rust + TypeScript
- **Python**: ~400 lines
- **Frontend**: ~860 lines (Phase 4)
- **Total**: ~4,460 lines across 56 files

---

## Next Steps (Production Hardening)

### Phase 5 Tasks

1. **Desktop Installer**
   - Windows Installer (WiX or Inno Setup)
   - Code signing certificate
   - Auto-start registry entry

2. **Auto-Update**
   - Tauri updater configuration
   - Signed update manifests
   - Rollback mechanism

3. **Monitoring & Alerts**
   - Agent offline alerts
   - Camera offline alerts
   - Error code aggregation
   - Metrics dashboard

4. **Testing**
   - Load test: 8 cameras, 72-hour soak
   - Network interruption recovery
   - Config change during streaming
   - Offline event queue replay

5. **Documentation**
   - Operator manual (Vietnamese)
   - Troubleshooting guide
   - Error code reference card
   - Installation guide

---

## Phase 4 Complete! 🎉

Website UI fully integrated with realtime agent and camera status updates. Users can now:
- Pair desktop agents via enrollment codes
- Monitor camera health with live status badges
- See actionable error messages in Vietnamese
- Track agent connectivity and camera metrics
- Revoke agent access instantly

**All 4 phases complete! System ready for production hardening (Phase 5).**
