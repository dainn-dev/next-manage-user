#[tauri::command]
pub async fn start_camera(camera_id: String) -> Result<(), String> {
    // TODO: Get supervisor instance and start worker
    Ok(())
}

#[tauri::command]
pub async fn stop_camera(camera_id: String) -> Result<(), String> {
    // TODO: Get supervisor instance and stop worker
    Ok(())
}
