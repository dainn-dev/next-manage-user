# Phase 3 Complete - Implementation Summary

## ✅ What Was Built

### Phase 3: Python Sidecar Integration

Successfully implemented IPC protocol and sidecar packaging for camera worker processes.

---

## Files Created (Phase 3)

### Python IPC Layer (3 new files)
1. **edge/edge/ipc_protocol.py** (144 lines)
   - JSON Lines event emitters for stdout
   - StreamEvents: connected, error, disconnected
   - FrameEvents: observed (every 10s)
   - QueueEvents: depth tracking
   - WorkerEvents: ready, stopping, stopped
   - PreviewEvents: JPEG frames for UI

2. **edge/edge/error_codes.py** (71 lines)
   - Standardized CameraErrorCode enum
   - RTSP errors: DNS_FAILED, CONNECT_TIMEOUT, AUTH_FAILED, etc.
   - Model errors: LOAD_FAILED, INFERENCE_ERROR
   - Backend errors: UNAUTHORIZED, UNREACHABLE
   - URL redaction helper: `redact_url()`
   - Error classification: `classify_opencv_error()`

3. **edge/edge/preview_server.py** (143 lines)
   - MJPEG HTTP server on 127.0.0.1:8765
   - Thread-safe PreviewFrame containers
   - Multipart stream delivery at ~10 FPS
   - API: register_camera(), update_frame(), unregister_camera()

### Python Pipeline Integration (2 modified files)
4. **edge/edge/camera_processing_service.py**
   - Import IPC protocol modules
   - Emit `frame.observed` every 150 frames
   - Frame health tracking for backend

5. **edge/edge/camera_runtime.py**
   - Import StreamEvents, error codes
   - Emit `stream.connected` on RTSP open
   - Emit `stream.error` on connection failure
   - Redact credentials in logs

### PyInstaller Packaging (2 new files)
6. **edge/camera-edge.spec** (85 lines)
   - PyInstaller spec for camera worker executable
   - Includes: OpenCV, PyTorch, Ultralytics, PaddleOCR
   - Excludes: matplotlib, scipy, pandas
   - Console app for stdout IPC

7. **edge/build_sidecar.py** (30 lines)
   - Build script wrapper
   - Usage: `python build_sidecar.py`
   - Output: `dist/camera-edge/camera-edge.exe`

### Rust Supervisor Enhancement (1 modified file)
8. **desktop/src-tauri/src/supervisor/mod.rs**
   - IPCEvent enum with serde deserialization
   - JSON Lines parser via BufReader
   - Spawn Python process with stdin config
   - Background thread for stdout reading
   - Process lifecycle management
   - SIGTERM graceful shutdown (Unix)

### Rust Dependencies (1 modified file)
9. **desktop/src-tauri/Cargo.toml**
   - Added `nix = "0.27"` for Unix signal handling

---

## Technical Implementation Details

### IPC Protocol Architecture

**Transport**: JSON Lines over stdout
```json
{"type":"stream.connected","cameraId":"uuid","width":1920,"height":1080,"fps":15.0,"codec":"h264","at":"2026-07-21T10:00:00Z"}
{"type":"frame.observed","cameraId":"uuid","frameNumber":150,"at":"2026-07-21T10:00:10Z"}
{"type":"stream.error","cameraId":"uuid","code":"RTSP_AUTH_FAILED","message":"401 Unauthorized","at":"..."}
```

**Delivery Guarantees**:
- Always flush stdout immediately
- One event per line (newline-delimited)
- Parse failures logged, processing continues
- No secrets in messages

### Error Code System

**Standardized Codes** (frontend actionable):
- `RTSP_DNS_FAILED` → Check hostname
- `RTSP_AUTH_FAILED` → Check credentials
- `RTSP_CONNECT_TIMEOUT` → Check network/firewall
- `MODEL_LOAD_FAILED` → Check model files
- `BACKEND_UNREACHABLE` → Check API endpoint

**URL Redaction** (safe logging):
```python
# Before: rtsp://admin:password123@192.168.0.121:554/ch1
# After:  rtsp://***@192.168.0.121:554/ch1
redact_url(rtsp_url)
```

### Frame Health vs Heartbeat

**Key Design Change**: Camera online status is **frame-based**, not heartbeat-based.

**Old Approach** (removed):
- Worker sends heartbeat every 20s
- Backend marks online if heartbeat < 60s old
- **Problem**: Worker can heartbeat even when no frames received

**New Approach** (implemented):
- Worker emits `frame.observed` every 150 frames (~10s at 15 FPS)
- Backend checks `last_frame_at` timestamp
- Camera online only if `now - last_frame_at < 30s`
- **Benefit**: Online status proves actual video processing

### Process Management

**Worker Lifecycle**:
```
Rust Supervisor
    ↓ start_worker()
Command::new("camera-edge.exe")
    --run-camera --config -
    ↓ stdin: JSON config
    ↓ stdout: JSON Lines IPC
    ↓ stderr: logs
Python Worker
    ↓ parse config
    ↓ open RTSP
    ↓ emit stream.connected
    ↓ process frames
    ↓ emit frame.observed every 10s
    ↓ on SIGTERM
    ↓ emit worker.stopping
    ↓ flush event queue
    ↓ emit worker.stopped
    ↓ exit 0
```

**Graceful Shutdown**:
- Unix: SIGTERM via `nix::kill()`
- Windows: TODO (TerminateProcess alternative)
- Queue flush before exit
- 30s timeout before SIGKILL

### Preview Transport

**Design Choice**: MJPEG over HTTP (not WebRTC)

**Rationale**:
- Simple HTTP request from WebView
- No complex signaling
- Localhost only (127.0.0.1)
- 5-10 FPS sufficient for monitoring

**Flow**:
```
Python Worker
    ↓ cv2.resize(frame, (640, 360))
    ↓ cv2.imencode('.jpg', frame, quality=70)
    ↓ base64.b64encode(jpeg)
    ↓ emit preview.frame IPC
Rust Supervisor
    ↓ parse IPC event
    ↓ forward to MJPEG server
MJPEG Server
    ↓ update frame buffer
    ↓ serve GET /camera/{id}
Tauri WebView
    ↓ <img src="http://127.0.0.1:8765/camera/{id}">
```

---

## Integration Points

### Backend API Endpoints (Already Implemented in Phase 1)

**Camera Health**:
```http
POST /api/agent/cameras/{cameraId}/health
Authorization: Bearer {agentToken}
Content-Type: application/json

{
  "state": "STREAMING",
  "lastFrameAt": "2026-07-21T10:00:09.800Z",
  "fps": 15.0,
  "width": 1920,
  "height": 1080,
  "codec": "h264",
  "reconnectCount": 1,
  "queueDepth": 0,
  "configRevision": 7,
  "error": null
}
```

**Backend Processing**:
```java
@PostMapping("/cameras/{cameraId}/health")
public ResponseEntity<?> updateCameraHealth(
    @PathVariable UUID cameraId,
    @RequestBody CameraHealthRequest request
) {
    // Verify agent owns this camera
    // Update camera_runtime_health table
    // Publish WebSocket event
    return ResponseEntity.ok().build();
}
```

### WebSocket Events (Phase 4)

**Topics**:
- `/topic/site/{siteId}/cameras/health` - Camera status changes

**Payload**:
```json
{
  "type": "camera.health.changed",
  "cameraId": "uuid",
  "state": "ONLINE",
  "lastFrameAt": "2026-07-21T10:00:09.800Z",
  "fps": 15.0,
  "errorCode": null
}
```

---

## Build Instructions

### Python Sidecar
```bash
cd edge
python build_sidecar.py

# Output: dist/camera-edge/camera-edge.exe (Windows)
#         dist/camera-edge/camera-edge (Linux/Mac)

# Copy to Tauri sidecars directory
cp -r dist/camera-edge ../desktop/sidecars/
```

### Tauri App
```bash
cd desktop

# Install dependencies
npm install

# Development mode
npm run tauri dev

# Production build
npm run tauri build

# Output: desktop/src-tauri/target/release/parking-site-agent.exe
```

---

## Testing Strategy

### Unit Tests (Phase 4)

**Python**:
```python
# test_ipc_protocol.py
def test_stream_connected_event():
    # Capture stdout
    # Emit event
    # Parse JSON
    # Assert structure

def test_redact_url():
    assert redact_url("rtsp://user:pass@host") == "rtsp://***@host"
```

**Rust**:
```rust
#[test]
fn test_parse_ipc_event() {
    let json = r#"{"type":"frame.observed","cameraId":"123","frameNumber":1,"at":"..."}"#;
    let event: IPCEvent = serde_json::from_str(json).unwrap();
    // Assert fields
}
```

### Integration Tests (Phase 4)

**Scenario 1**: RTSP Connection Success
1. Start mock RTSP server
2. Start camera worker with test config
3. Verify `stream.connected` IPC event
4. Verify `frame.observed` events
5. Stop worker
6. Verify `worker.stopped` event

**Scenario 2**: RTSP Authentication Failure
1. Start RTSP server with auth required
2. Start worker with wrong password
3. Verify `stream.error` with `RTSP_AUTH_FAILED`
4. Update config with correct password
5. Verify reconnect and `stream.connected`

**Scenario 3**: Preview Frame Delivery
1. Start worker
2. Register camera in preview server
3. Capture MJPEG stream
4. Verify frames received at ~10 FPS
5. Verify JPEG decoding successful

---

## Code Statistics

### Phase 3 Additions
- **Python**: 388 lines (3 new files + 2 modified)
- **Rust**: ~150 lines (1 modified file)
- **Build Scripts**: 115 lines (2 new files)
- **Total Phase 3**: ~650 lines

### Cumulative (Phase 1-3)
- **Backend**: ~2,000 lines Java (12 files)
- **Desktop**: ~1,200 lines Rust + TypeScript (21 files)
- **Python**: ~400 lines (5 files)
- **Docs**: 3 markdown files
- **Total**: ~3,600 lines across 41 files

---

## Phase 3 Completion Checklist

- [x] IPC protocol with JSON Lines format
- [x] Standardized error codes
- [x] URL redaction for safe logging
- [x] Frame-based health events (not heartbeat-based)
- [x] Stream connection/error events
- [x] Preview MJPEG server
- [x] PyInstaller sidecar spec
- [x] Build script
- [x] Rust JSON Lines parser
- [x] Process lifecycle management
- [x] Graceful shutdown (Unix SIGTERM)
- [x] Documentation

---

## Next Steps: Phase 4

### Website UI Integration

1. **Agent Management Page** (`frontend/app/parking/agents/page.tsx`)
   ```typescript
   - List agents with status
   - Generate enrollment codes
   - Revoke action
   - Last heartbeat display
   ```

2. **Enhanced Camera Status** (`frontend/app/parking/cameras/page.tsx`)
   ```typescript
   - Show agent assignment
   - Display error codes
   - Online/offline indicators
   - Preview thumbnail (optional)
   ```

3. **WebSocket Subscriptions** (`frontend/hooks/use-dashboard-realtime.ts`)
   ```typescript
   stompClient.subscribe('/topic/site/{siteId}/cameras/health', (message) => {
     const event = JSON.parse(message.body);
     updateCameraStatus(event.cameraId, event.state);
   });
   ```

4. **API Client** (`frontend/lib/api/agent-api.ts`)
   ```typescript
   export const agentApi = {
     generateEnrollmentCode: (siteId) => 
       post(`/sites/${siteId}/agents/enrollment-codes`),
     listAgents: (siteId) => 
       get(`/sites/${siteId}/agents`),
     revokeAgent: (agentId) => 
       post(`/site-agents/${agentId}/revoke`),
   };
   ```

---

## Success Criteria

### Phase 3 Achieved ✅
- Python worker emits structured IPC events
- Rust supervisor parses JSON Lines
- Error codes standardized and actionable
- Frame health proves camera is processing video
- Preview server ready for UI integration
- Sidecar packaging automated

### Phase 4 Goals
- Website shows agent list
- Website shows camera runtime health
- Realtime updates via WebSocket
- End-to-end enrollment flow tested
- RTSP error codes displayed correctly

---

## Phase 3 Complete! 🎉

All foundational IPC and sidecar components implemented. Ready to proceed with Phase 4: Website UI integration.
