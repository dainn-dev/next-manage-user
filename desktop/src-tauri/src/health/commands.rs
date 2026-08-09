use super::{reporter, AgentStatus, CameraHealth};

#[tauri::command]
pub async fn start_health_reporter() -> Result<(), String> {
    reporter::start_health_reporter().await
}

#[tauri::command]
pub async fn get_agent_status() -> Result<AgentStatus, String> {
    let (online, config_version, workers, last_error) = reporter::reporter_snapshot()?;
    Ok(AgentStatus {
        online,
        version: "0.1.0".to_string(),
        config_version,
        workers: workers as usize,
        queue_depth: 0,
        last_error,
    })
}

#[tauri::command]
pub async fn get_camera_health(camera_id: String) -> Result<CameraHealth, String> {
    // Real per-camera runtime still comes from sidecars; reporter only posts connecting.
    Ok(CameraHealth {
        camera_id,
        state: "connecting".to_string(),
        last_frame_at: None,
        fps: 0.0,
        error: None,
    })
}
