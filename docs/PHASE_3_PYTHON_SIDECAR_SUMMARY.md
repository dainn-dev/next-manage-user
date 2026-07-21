# Phase 3: Python Sidecar Integration - Implementation Summary

## ✅ Completed Tasks

### 1. IPC Protocol (`edge/edge/ipc_protocol.py`)
**JSON Lines format** over stdout for Rust supervisor communication:

**Event Types:**
- `stream.connected` - RTSP connection successful with video metadata
- `stream.error` - RTSP/inference errors with standardized codes
- `frame.observed` - Frame health tracking (every 10s)
- `queue.depth` - Offline event queue status
- `worker.ready` - Worker initialization complete
- `worker.stopping/stopped` - Graceful shutdown lifecycle
- `preview.frame` - JPEG preview frames for UI

**Key Features:**
- Always flush stdout for immediate delivery
- UTC timestamps in ISO format
- No secrets in error messages

### 2. Error Code Standardization (`edge/edge/error_codes.py`)
**Enum-based error classification:**
- `RTSP_DNS_FAILED` - DNS resolution failure
- `RTSP_CONNECT_TIMEOUT` - Connection timeout
- `RTSP_CONNECTION_REFUSED` - Connection refused
- `RTSP_AUTH_FAILED` - 401/403 authentication failure
- `RTSP_UNSUPPORTED_CODEC` - Codec not supported
- `RTSP_NO_FRAMES` - Stream opened but no frames
- `MODEL_LOAD_FAILED` / `MODEL_INFERENCE_ERROR` - AI errors
- `INGEST_UNAUTHORIZED` / `BACKEND_UNREACHABLE` - Backend errors
- `WORKER_CRASHED` - Process crash

**Helper Functions:**
- `redact_url(url)` - Strip credentials from RTSP URLs
- `classify_opencv_error(msg)` - Map OpenCV errors to codes

### 3. Camera Pipeline Integration
**Modified Files:**
- `edge/edge/camera_processing_service.py`
  - Import `FrameEvents, QueueEvents, WorkerEvents`
  - Emit `frame.observed` every 150 frames (~10s at 15 FPS)
  
- `edge/edge/camera_runtime.py`
  - Import `StreamEvents, CameraErrorCode, redact_url`
  - Emit `stream.connected` on successful RTSP open (with width/height/fps/codec)
  - Emit `stream.error` on connection failure with error code
  - Redact RTSP URLs in logs

**Key Change:** Frame health events are **frame-based**, not time-based heartbeat. Backend determines camera online from `lastFrameAt` timestamp.

### 4. Sidecar Packaging
**PyInstaller Spec** (`edge/camera-edge.spec`):
- Entry point: `run_camera_pipeline.py`
- Includes all edge modules + dependencies (OpenCV, PyTorch, PaddleOCR)
- Console app for stdout IPC
- Excludes matplotlib, scipy, pandas to reduce size
- Output: `dist/camera-edge/camera-edge.exe`

**Build Script** (`edge/build_sidecar.py`):
```bash
python build_sidecar.py
# Output: dist/camera-edge/ with executable
```

### 5. Rust Supervisor with JSON Lines Parser
**Enhanced** `desktop/src-tauri/src/supervisor/mod.rs`:

**Features:**
- Spawn Python worker via `Command::new(sidecar_path)`
- Stdin for config delivery (JSON)
- Stdout piped to `BufReader` for JSON Lines parsing
- Background thread reads line-by-line and deserializes `IPCEvent`
- Handle all event types: stream connected/error, frame observed, queue depth, worker ready

**IPC Event Types:**
```rust
#[derive(Deserialize)]
#[serde(tag = "type")]
pub enum IPCEvent {
    #[serde(rename = "stream.connected")]
    StreamConnected { camera_id, width, height, fps, codec, at },
    
    #[serde(rename = "stream.error")]
    StreamError { camera_id, code, message, at },
    
    #[serde(rename = "frame.observed")]
    FrameObserved { camera_id, frame_number, at },
    // ... etc
}
```

**Process Management:**
- Graceful SIGTERM on Unix (via `nix` crate)
- Process lifecycle tracking (Starting → Running → Stopping → Stopped)
- Error state on crash

**Dependencies Added:**
- `nix = "0.27"` (Unix only) for signal handling

### 6. Preview Server (`edge/edge/preview_server.py`)
**MJPEG HTTP server** for camera preview in Tauri UI:

**Features:**
- Binds to `127.0.0.1:8765` (localhost only for security)
- Serves `/camera/{cameraId}` endpoints
- MJPEG multipart stream (`multipart/x-mixed-replace`)
- Thread-safe frame updates via `PreviewFrame` class
- ~10 FPS delivery rate
- Global singleton `get_preview_server()`

**API:**
```python
server = get_preview_server()
url = server.register_camera(camera_id)  # Returns stream URL
server.update_frame(camera_id, jpeg_base64)  # Update frame
server.unregister_camera(camera_id)  # Cleanup
```

**Integration:**
- Python worker emits `preview.frame` IPC events
- Rust forwards to preview server
- Tauri UI fetches `http://127.0.0.1:8765/camera/{id}`

---

## 📦 Files Created/Modified

### New Files (6)
1. `edge/edge/ipc_protocol.py` - IPC event emitters
2. `edge/edge/error_codes.py` - Standardized error codes + URL redaction
3. `edge/camera-edge.spec` - PyInstaller spec
4. `edge/build_sidecar.py` - Build script
5. `edge/edge/preview_server.py` - MJPEG server
6. (Updated) `desktop/src-tauri/src/supervisor/mod.rs` - JSON Lines parser

### Modified Files (3)
1. `edge/edge/camera_processing_service.py` - Frame health events
2. `edge/edge/camera_runtime.py` - Stream connection/error events
3. `desktop/src-tauri/Cargo.toml` - Added `nix` dependency

---

## 🔄 Data Flow

```
Python Worker (camera-edge.exe)
    ↓ (stdout JSON Lines)
Rust Supervisor (JSON Lines parser)
    ↓ (IPC events)
Health Tracker + Preview Server
    ↓ (HTTP POST)
Backend API (/api/agent/cameras/{id}/health)
    ↓ (WebSocket)
Website UI (realtime status)
```

**Preview Flow:**
```
Python Worker (downscale frame → JPEG)
    ↓ (preview.frame IPC event)
Rust Supervisor (forward to preview server)
    ↓ (HTTP POST to 127.0.0.1:8765)
MJPEG Server (update frame buffer)
    ↓ (MJPEG stream)
Tauri WebView (display in dashboard)
```

---

## 🎯 Phase 3 Status

### ✅ Completed
- [x] IPC protocol with JSON Lines
- [x] Standardized error codes
- [x] Frame-based health events
- [x] PyInstaller sidecar packaging
- [x] Rust JSON Lines parser
- [x] Process lifecycle management
- [x] Preview MJPEG server

### 🔄 Integration Points (Next Steps)
1. **Health Reporting**: Rust supervisor sends camera health to backend API
2. **Config Sync Loop**: Poll `/api/agent/config` every 15s, spawn/stop workers on changes
3. **Preview Integration**: Wire preview.frame IPC → MJPEG server → Tauri UI
4. **Error Handling**: Report stream errors to backend via `/api/agent/cameras/{id}/health`
5. **Build Pipeline**: Integrate `build_sidecar.py` into CI/CD
6. **Testing**: End-to-end test with real RTSP camera

---

## 📊 Code Statistics

**Phase 3 Additions:**
- Python: ~400 lines (ipc_protocol, error_codes, preview_server)
- Rust: ~150 lines (supervisor JSON Lines parser)
- PyInstaller spec: ~80 lines
- Total: **~630 lines**

**Cumulative (Phase 1-3):**
- Backend: ~2000 lines (Java)
- Desktop: ~1200 lines (Rust + TypeScript)
- Python: ~400 lines (IPC integration)
- **Total: ~3600 lines**

---

## 🚀 Ready for Integration Testing

Phase 3 foundation complete! Next: wire supervisor to backend API and test full flow.
