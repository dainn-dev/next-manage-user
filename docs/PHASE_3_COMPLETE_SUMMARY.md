# Phase 3 Implementation Complete ✅

## Summary

Phase 3 (Python Sidecar Integration) đã hoàn thành đầy đủ với tất cả các thành phần IPC, error handling, và sidecar packaging.

---

## Files Created/Modified

### Python IPC Layer (3 new files)

1. **edge/edge/ipc_protocol.py** (144 lines)
   - JSON Lines event emitters for stdout communication
   - Events: stream.connected, stream.error, frame.observed, queue.depth, worker.ready/stopping/stopped, preview.frame
   - Always flush stdout for immediate delivery

2. **edge/edge/error_codes.py** (71 lines)
   - Standardized CameraErrorCode enum
   - RTSP errors: DNS_FAILED, CONNECT_TIMEOUT, AUTH_FAILED, CONNECTION_REFUSED, UNSUPPORTED_CODEC, NO_FRAMES
   - Model errors: LOAD_FAILED, INFERENCE_ERROR
   - Backend errors: UNAUTHORIZED, UNREACHABLE
   - Helper: `redact_url()` strips credentials, `classify_opencv_error()` maps errors

3. **edge/edge/preview_server.py** (143 lines)
   - MJPEG HTTP server on 127.0.0.1:8765 (localhost only)
   - Thread-safe PreviewFrame containers
   - Multipart stream delivery at ~10 FPS
   - API: register_camera(), update_frame(), unregister_camera()

### Python Pipeline Integration (2 modified files)

4. **edge/edge/camera_processing_service.py**
   - Import IPC protocol modules
   - Emit `frame.observed` every 150 frames (~10s at 15 FPS)
   - Frame-based health tracking replaces heartbeat-based

5. **edge/edge/camera_runtime.py**
   - Import StreamEvents, error codes
   - Emit `stream.connected` on RTSP open with video metadata
   - Emit `stream.error` on connection failure with standardized codes
   - Redact RTSP credentials in all log messages

### PyInstaller Sidecar Packaging (2 new files)

6. **edge/camera-edge.spec** (85 lines)
   - PyInstaller spec for building camera worker executable
   - Includes: OpenCV, PyTorch, Ultralytics, PaddleOCR
   - Excludes: matplotlib, scipy, pandas (reduce size)
   - Output: dist/camera-edge/camera-edge.exe

7. **edge/build_sidecar.py** (30 lines)
   - Build script wrapper
   - Usage: `python build_sidecar.py`

### Rust Supervisor Enhancement (2 modified files)

8. **desktop/src-tauri/src/supervisor/mod.rs**
   - IPCEvent enum with serde deserialization
   - JSON Lines parser via BufReader
   - Spawn Python process with config via stdin
   - Background thread reads stdout line-by-line
   - Process lifecycle management
   - SIGTERM graceful shutdown on Unix

9. **desktop/src-tauri/Cargo.toml**
   - Added `nix = "0.27"` for Unix signal handling

---

## Technical Highlights

### IPC Protocol Architecture

**Transport**: JSON Lines over stdout
```json
{"type":"stream.connected","cameraId":"uuid","width":1920,"height":1080,"fps":15.0,"codec":"h264","at":"2026-07-21T10:00:00Z"}
{"type":"frame.observed","cameraId":"uuid","frameNumber":150,"at":"2026-07-21T10:00:10Z"}
{"type":"stream.error","cameraId":"uuid","code":"RTSP_AUTH_FAILED","message":"401 Unauthorized","at":"..."}
```

### Frame-Based Health (Not Heartbeat-Based)

**Key Design**: Camera online status proven by actual frame processing, not just heartbeat.

- Worker emits `frame.observed` every 150 frames (~10s at 15 FPS)
- Backend checks `last_frame_at` timestamp
- Camera online only if `now - last_frame_at < 30s`
- Proves actual video processing, not just process alive

### Error Code System

Standardized codes for frontend actionability:
- `RTSP_DNS_FAILED` → Check hostname
- `RTSP_AUTH_FAILED` → Check credentials
- `RTSP_CONNECT_TIMEOUT` → Check network/firewall
- `MODEL_LOAD_FAILED` → Check model files
- `BACKEND_UNREACHABLE` → Check API endpoint

URL redaction for safe logging:
```python
# rtsp://admin:password123@192.168.0.121:554/ch1
# → rtsp://***@192.168.0.121:554/ch1
```

### Process Management

**Worker Lifecycle**:
```
Rust Supervisor
    ↓ start_worker()
Command::new("camera-edge.exe")
    --run-camera --config -
    ↓ stdin: JSON config
    ↓ stdout: JSON Lines IPC
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

### Preview Transport

MJPEG over HTTP (localhost only):
```
Python Worker
    ↓ cv2.resize(frame, (640, 360))
    ↓ cv2.imencode('.jpg', frame, quality=70)
    ↓ base64.b64encode(jpeg)
    ↓ emit preview.frame IPC
Rust Supervisor
    ↓ parse IPC event
    ↓ forward to MJPEG server
MJPEG Server (127.0.0.1:8765)
    ↓ update frame buffer
    ↓ serve GET /camera/{id}
Tauri WebView
    ↓ <img src="http://127.0.0.1:8765/camera/{id}">
```

---

## Integration Points

### Backend API (Already in Phase 1)

**Camera Health Endpoint**:
```http
POST /api/agent/cameras/{cameraId}/health
Authorization: Bearer {agentToken}

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

Backend updates `camera_runtime_health.last_frame_at` and publishes WebSocket event.

### WebSocket Topics (Phase 4)

```
/topic/site/{siteId}/cameras/health
```

Payload:
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
# Copy to Tauri sidecars directory
cp -r dist/camera-edge ../desktop/sidecars/
```

### Tauri App
```bash
cd desktop
npm install
npm run tauri dev       # Development
npm run tauri build     # Production
```

---

## Testing Strategy

### Unit Tests (Phase 4)

**Python**:
```python
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
}
```

### Integration Tests

**Scenario 1**: RTSP Connection Success
1. Start mock RTSP server
2. Start camera worker
3. Verify `stream.connected` IPC event
4. Verify `frame.observed` events
5. Stop worker
6. Verify `worker.stopped` event

**Scenario 2**: RTSP Auth Failure
1. Start RTSP server with auth
2. Start worker with wrong password
3. Verify `stream.error` with `RTSP_AUTH_FAILED`
4. Update config with correct password
5. Verify reconnect and `stream.connected`

**Scenario 3**: Preview Frame Delivery
1. Start worker
2. Register camera in preview server
3. Capture MJPEG stream
4. Verify frames at ~10 FPS
5. Verify JPEG decoding

---

## Code Statistics

### Phase 3 Additions
- **Python**: 388 lines (3 new + 2 modified)
- **Rust**: ~150 lines (1 modified)
- **Build**: 115 lines (2 new)
- **Total**: ~650 lines

### Cumulative (Phase 1-3)
- **Backend**: ~2,000 lines Java (12 files)
- **Desktop**: ~1,200 lines Rust + TypeScript (21 files)
- **Python**: ~400 lines (5 files)
- **Docs**: 3 markdown files
- **Total**: ~3,600 lines across 41 files

---

## Phase 3 Completion Checklist

- [x] IPC protocol with JSON Lines
- [x] Standardized error codes
- [x] URL redaction for safe logging
- [x] Frame-based health events
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
   - List agents with status
   - Generate enrollment codes
   - Revoke action
   - Last heartbeat display

2. **Enhanced Camera Status** (`frontend/app/parking/cameras/page.tsx`)
   - Show agent assignment
   - Display error codes
   - Online/offline indicators
   - Preview thumbnail (optional)

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
- Frame health proves camera processing
- Preview server ready for UI
- Sidecar packaging automated

### Phase 4 Goals
- Website shows agent list
- Website shows camera runtime health
- Realtime updates via WebSocket
- End-to-end enrollment flow tested
- RTSP error codes displayed

---

## Phase 3 Complete! 🎉

All IPC protocol, error handling, and sidecar packaging components implemented.
Ready to proceed with Phase 4: Website UI integration and realtime subscriptions.
