use super::{AgentStatus, CameraHealth};

#[tauri::command]
pub async fn get_agent_status() -> Result<AgentStatus, String> {
    // TODO: Get from supervisor
    Ok(AgentStatus {
        online: true,
        version: "0.1.0".to_string(),
        config_version: 1,
        workers: 0,
        queue_depth: 0,
    })
}

#[tauri::command]
pub async fn get_camera_health(camera_id: String) -> Result<CameraHealth, String> {
    // TODO: Get from supervisor
    Ok(CameraHealth {
        camera_id,
        state: "offline".to_string(),
        last_frame_at: None,
        fps: 0.0,
        error: None,
    })
}
