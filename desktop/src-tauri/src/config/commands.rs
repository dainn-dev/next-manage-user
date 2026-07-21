use super::AgentConfig;

#[tauri::command]
pub async fn get_config(api_url: String) -> Result<AgentConfig, String> {
    // Get valid token
    let token = ""; // TODO: Get from token manager

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/agent/config", api_url))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Config fetch failed: {}", e))?;

    if !response.status().is_success() {
        return Err("Failed to fetch config".to_string());
    }

    let config: AgentConfig = response.json().await
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    Ok(config)
}

#[tauri::command]
pub async fn sync_config(api_url: String, current_version: i32) -> Result<Option<AgentConfig>, String> {
    let token = ""; // TODO: Get from token manager

    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/agent/config?sinceVersion={}", api_url, current_version))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Config sync failed: {}", e))?;

    if response.status() == 304 {
        // Not modified
        return Ok(None);
    }

    if !response.status().is_success() {
        return Err("Failed to sync config".to_string());
    }

    let config: AgentConfig = response.json().await
        .map_err(|e| format!("Failed to parse config: {}", e))?;

    Ok(Some(config))
}
