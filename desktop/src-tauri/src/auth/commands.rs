use super::{AgentCredentials, EnrollmentRequest};
use tauri::State;
use serde_json::json;

#[tauri::command]
pub async fn enroll_agent(
    enrollment_code: String,
    name: String,
    api_url: String,
) -> Result<AgentCredentials, String> {
    let client = reqwest::Client::new();

    // Get device fingerprint (simplified for MVP)
    let device_fingerprint = format!("{:x}", md5::compute(whoami::hostname()));

    let request = EnrollmentRequest {
        enrollment_code,
        name,
        device_fingerprint,
        version: "0.1.0".to_string(),
        platform: format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH),
    };

    let response = client
        .post(format!("{}/api/agent/enroll", api_url))
        .json(&request)
        .send()
        .await
        .map_err(|e| format!("Enrollment failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Enrollment failed: {}", error_text));
    }

    let result: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let credentials = AgentCredentials {
        agent_id: result["agent"]["id"].as_str().unwrap_or_default().to_string(),
        site_id: result["agent"]["siteId"].as_str().unwrap_or_default().to_string(),
        tenant_id: result["agent"]["tenantId"].as_str().unwrap_or_default().to_string(),
        access_token: result["accessToken"].as_str().unwrap_or_default().to_string(),
        refresh_token: result["refreshToken"].as_str().unwrap_or_default().to_string(),
        expires_at: chrono::Utc::now().timestamp() + 900, // 15 minutes
    };

    // Store credentials securely
    super::credential_store::store_credentials(&credentials)
        .map_err(|e| format!("Failed to store credentials: {}", e))?;

    Ok(credentials)
}

#[tauri::command]
pub async fn check_credentials() -> Result<AgentCredentials, String> {
    super::credential_store::load_credentials()
        .map_err(|e| format!("No credentials found: {}", e))
}
